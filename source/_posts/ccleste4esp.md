---
title: ccleste4esp — 在单片机上跑 Celeste Classic
date: 2025-06-20
tags: [技术, ESP32, 嵌入式, 游戏, PICO-8, 移植]
---

将一个完整的 PICO-8 平台跳跃游戏塞进一块 ESP32-S3 单片机——128×128 的 LCD、6 个 GPIO 按键、没有操作系统、没有文件系统、没有动态内存分配。这篇文章记录了从黑屏到可玩的完整过程。

---

## 项目概述

**ccleste4esp** 把 Celeste Classic（PICO-8 原版《蔚蓝》）移植到了 ESP32-S3 微控制器上。游戏引擎来自 [lemon32767/ccleste](https://github.com/lemon32767/ccleste)——一个用 C 语言逐行从 PICO-8 Lua 代码手工翻译的版本，不依赖任何标准库以外的代码，不做动态内存分配。

> **GitHub**：[LCHLCHLCHLCH/ccleste4esp](https://github.com/LCHLCHLCHLCH/ccleste4esp)

| 组件 | 型号 / 规格 |
|---|---|
| 主控 | ESP32-S3（双核 240MHz, 8MB Flash, 8MB PSRAM） |
| 屏幕 | ST7735R 1.44" 128×128 SPI TFT |
| 按键 | 6 个轻触按键（左/右/上/下/跳/冲） |
| 帧率 | ~30fps |
| 音频 | 未实现 |
| 代码量 | ~3000 行 C（游戏引擎 ~2000 行 + 前端 ~400 行 + 驱动 ~600 行） |

---

## 架构

### 目录结构

```
ccleste4esp/
├── main.c                  ← 程序入口，初始化 + 30fps 游戏主循环
├── CMakeLists.txt          ← ESP-IDF 构建系统
├── sdkconfig.defaults      ← 芯片配置
│
├── main/
│   ├── main.c              ← app_main()
│   ├── esp32_frontend.c    ← PICO-8 API 回调实现（核心移植层）
│   ├── esp32_frontend.h
│   ├── font_data.h         ← PICO-8 4×6 位图字体（从 ROM 提取）
│   │
│   ├── celeste/            ← 游戏引擎（源自 ccleste，未经修改）
│   │   ├── celeste.c       ← 全部游戏逻辑（~2033 行）
│   │   ├── celeste.h       ← PICO-8 回调接口定义
│   │   ├── sprite.h        ← 精灵表单（PICO-8 16 色调色板）
│   │   └── map_data.h      ← 地图数据（4×8 房间，8192 字节）
│   │
│   └── Drivers/            ← 外设驱动
│       ├── LCD/            ← ST7735R 驱动（SPI DMA, 80MHz）
│       ├── button/         ← GPIO 按键（内部上拉）
│       ├── LED/            ← GPIO48 LED
│       └── delay/          ← vTaskDelay 封装
│
└── python/                 ← 资源转换工具（已删除，仅开发期使用）
```

### PICO-8 API 模拟

游戏引擎 `celeste.c` 不直接操作硬件。它通过 13 个回调函数与外界交互：

| 回调 | PICO-8 原语 | ESP32 实现 |
|---|---|---|
| `CELESTE_P8_SPR` | `spr()` 绘制精灵 | SPI framebuffer 逐像素写入，带透明色和翻转 |
| `CELESTE_P8_BTN` | `btn()` 按键 | GPIO 电平读取（上拉，低有效） |
| `CELESTE_P8_PAL` | `pal()` 色板置换 | `pal_map[16]` 映射表，绘制时即时转换 |
| `CELESTE_P8_MAP` | `map()` 绘制地图瓦片 | 16×16 瓦片循环写入 framebuffer |
| `CELESTE_P8_MGET` | `mget()` 读取地图 | 查 `map_data` 数组，`-1→0` 转换 |
| `CELESTE_P8_PRINT` | `print()` 文字 | 4×6 位图字体，逐像素渲染 |
| `CELESTE_P8_CAMERA` | `camera()` 视口 | 偏移量 + 震动衰减 |
| `CELESTE_P8_RECTFILL` | `rectfill()` | 填充矩形 |
| `CELESTE_P8_CIRCFILL` | `circfill()` | 实心圆 |
| `CELESTE_P8_LINE` | `line()` | Bresenham 画线 |
| `CELESTE_P8_FGET` | `fget()` 精灵属性 | 查 `sprite_flags[128]` 表 |
| `CELESTE_P8_MUSIC` | `music()` | 空操作（未实现） |
| `CELESTE_P8_SFX` | `sfx()` | 空操作（未实现） |

### 帧渲染管线

```
app_main()
 │
 ├─ 30fps 主循环 (delay_ms(33))
 │   ├─ Celeste_P8_update()        ← 游戏逻辑（物理/碰撞/AI）
 │   ├─ Celeste_P8_draw()          ← PICO-8 API → framebuffer
 │   └─ celeste_render_finish()    ← DMA 推送 128×128×16bit 到 LCD
 │        ├─ __builtin_bswap16()    ← 小端→大端字节序转换
 │        ├─ spi_device_polling_transmit()  ← DMA 传输
 │        └─ __builtin_bswap16()    ← 恢复字节序
```

---

## 开发历程：9 个关键 Bug 修复

整个过程经历了约 9000 行的对话调试。以下是按时间顺序记录的每一个关键问题。

### Bug 1：标题画面卡死

**现象**：游戏显示了标题画面，几个精灵闪烁出现并乱晃，然后冻结。

**根因**：`MUSIC` 和 `SFX` 回调虽然被设为空操作，但没有消费 `va_arg` 传进来的参数。`celeste.c` 用可变参数调用这些回调，未消费的参数破坏了 `va_list` 内部状态，导致后续回调的参数全部错乱——相当于随机改写函数调用的参数。

**修复**：在两个空操作回调中添加 `va_arg(args, int)` 消费掉参数：

```c
case CELESTE_P8_MUSIC:
case CELESTE_P8_SFX:
    (void)va_arg(args, int);  // 消费但不使用
    break;
```

这是一个非常隐蔽的 bug——空操作函数里什么都不做，看起来"应该没问题"。

### Bug 2：按钮无响应

**现象**：画面正常渲染，但按键没有任何反应，游戏停在标题画面。

**排查**：GPIO 上拉配置正确，但似乎硬件连接或电平逻辑有问题。浮空输入导致随机按键触发，角色自己乱动。

**临时方案**：加入测试 hack——前 40 帧自动按跳跃键，让游戏进入第一关以验证游戏逻辑是否正常。

### Bug 3：多个玩家 + 无限生成对象

**现象**：屏幕上出现了几十个 Madeline（玩家角色），云朵、绿色宝珠等游戏对象大量生成，一个玩家死亡就重置整个关卡。这是整个移植过程中最严重的 bug。

**根因**：ESP32 的 `map_data.h` 使用 `-1`（`int8_t`）表示空瓦片，而原版 ccleste 使用 `0`（`unsigned char`）表示空。问题出在 `load_room()` 函数中——它遍历所有瓦片寻找特定 tile 值来初始化对象：

```c
if (tile == OBJTYPE_prop[type].tile) { /* 创建对象 */ }
```

而 `PLAYER.tile = -1`、`SMOKE.tile = -1`、`ORB.tile = -1`……所以**每一个空瓦片（值为 -1）都匹配了所有这些对象类型**。游戏在每一块空白地板上生成了完整的玩家、烟雾粒子、宝珠和平台。

**修复**：在 `P8mget` 回调中添加一行转换：

```c
static int P8mget(int x, int y) {
    int ret = map_data[y * 128 + x];
    if (ret < 0) ret = 0;  // -1 → 0，不再匹配任何对象
    return ret;
}
```

这一行代码让游戏从"彻底崩溃"变成了"基本可玩"。

### Bug 4：精灵黑色背景

**现象**：跳跃烟雾和部分精灵渲染时带有黑色方块背景。

**根因**：PICO-8 中色号 0 表示透明，但 ESP32 的 SPR 和 MAP 绘制函数把所有像素（包括色号 0 的）都写入了 framebuffer。

**修复**：在精灵和地图瓦片绘制循环中添加透明判断：

```c
int col = sprite_data[...];
if (col != 0) {  // 色号 0 = 透明，跳过
    display_mem[...] = pico8_rgb565[pal_map[col]];
}
```

### Bug 5：色板延迟应用（头发不变蓝）

**现象**：冲刺后 Madeline 的头发应变蓝色（色板交换），但始终为白色。

**根因**：色板映射 `pal_map` 在 `commit_framebuffer()`（帧结束时）才应用。但 `unset_hair_color()` 在绘制结束时就已把 `pal_map[8]` 重置为默认值 8。到帧末真正写入 LCD 时，色板已经恢复原样了。

**修复**：重构整个渲染管线——从"先写原始色号到 framebuffer，帧末查表转换"改为"所有绘制函数立即通过 `pico8_rgb565[pal_map[color]]` 写入 `display_mem`"。色板置换在绘制时即时生效。`commit_framebuffer` 从 ~25 行缩减为仅做字节交换和 DMA 传输。

### Bug 6：P8fget 永远返回 true

`fget()` 查询精灵属性（固体、冰面等）。最初实现是空函数返回 true，导致所有物体都是固体、碰撞检测全部错乱。修复方法是添加 `sprite_flags[128]` 查找表，从原版 PICO-8 数据中逐位提取每个 tile 的 flag。

### Bug 7：P8print 空函数

最初的 `print()` 什么也不画，导致游戏里没有任何文字——标题画面、死亡提示、通关对话全是空白。修复需要实现完整的 4×6 位图字体渲染器。字体数据从 PICO-8 ROM 偏移 `0x5600` 处提取（而非猜测或手绘），确保与 PICO-8 原生字体像素级一致。

### Bug 8：P8pal 颜色替换无效

色板置换是 Celeste 的核心视觉效果——冲刺时角色头发变色、某些关卡有特殊色调。最初实现没考虑 `pal()` 函数，颜色替换完全不生效。修复使用 `pal_map[16]` 映射表，所有绘制函数在输出前先通过映射表转换色号。

### Bug 9：LCD 颜色与字节序

ST7735 LCD 的初始化序列、RGB565 颜色公式、SPI DMA 字节序这三个问题交织在一起，导致画面颜色完全错误（红色变蓝色、颜色偏移）。经过逐位测试对照商家代码后确定最终方案：

- RGB565 公式：`(R>>3)<<11 | (G>>2)<<5 | (B>>3)`
- 字节序：ESP32 小端 → DMA 发送前 `__builtin_bswap16()` → 发送后换回
- LCD 初始化：必须用商家的 `send_init_command2()` 序列
- MADCTL 寄存器：`0xC8`（MX=1, MY=1, RGB=1）

---

## PICO-8 16 色调色板

| # | 颜色 | PICO-8 色值 | RGB565 | 用途 |
|---|------|-----------|--------|------|
| 0 | 黑 | `#000000` | `0x0000` | 透明 |
| 1 | 深蓝 | `#1D2B53` | `0x194A` | 背景 |
| 2 | 紫 | `#7E2553` | `0x792A` | |
| 3 | 绿 | `#008751` | `0x042A` | 草/植物 |
| 4 | 棕 | `#AB5236` | `0xAA86` | 泥土 |
| 5 | 灰 | `#5F574F` | `0x5AA9` | 岩石 |
| 6 | 浅灰 | `#C2C3C7` | `0xC618` | 冰 |
| 7 | 米白 | `#FFF1E8` | `0xFF9D` | 雪 |
| 8 | 红 | `#FF004D` | `0xF809` | Madeline 头发（默认） |
| 9 | 橙 | `#FFA300` | `0xFD00` | |
| 10 | 黄 | `#FFEC27` | `0xFF64` | |
| 11 | 亮绿 | `#00E436` | `0x0726` | |
| 12 | 蓝 | `#29ADFF` | `0x2D7F` | Madeline 头发（冲刺） |
| 13 | 紫灰 | `#83769C` | `0x83B3` | |
| 14 | 粉 | `#FF77A8` | `0xFBB5` | |
| 15 | 肤色 | `#FFCCAA` | `0xFE75` | 皮肤 |

---

## 硬件连接

### LCD（SPI, 80MHz, Mode 3, DMA）

| ST7735R | ESP32-S3 GPIO |
|---------|--------------|
| SCL（时钟） | 14 |
| MOSI（数据）| 13 |
| RES（复位） | 12 |
| DC（数据/命令）| 11 |
| CS（片选） | 10 |
| BLK（背光） | 9 |

### 按键（GPIO 内部上拉，低电平有效）

| 功能 | GPIO | 游戏动作 |
|------|------|---------|
| 左 | 1 | 向左移动 |
| 上 | 2 | 向上看 |
| 右 | 3 | 向右移动 |
| 下 | 4 | 向下看 / 下穿平台 |
| 跳 | 5 | 跳跃（按住跳更高） |
| 冲 | 6 | 冲刺（可空中冲刺） |

---

## 当前状态与局限

| 维度 | 状态 |
|---|---|
| **游戏逻辑** | 完整——Celeste Classic 全部关卡可玩 |
| **渲染** | 完整——30fps, 128×128, PICO-8 原色调色板 |
| **输入** | 完整——6 键映射 |
| **文字** | 完整——4×6 PICO-8 位图字体 |
| **特效** | 色板置换、屏幕震动、透明精灵、翻转——均已实现 |
| **音频** | **未实现**——music/sfx 回调为空 |
| **暂停** | **未实现** |
| **存档** | **未实现**——引擎有 save/load 接口但前端未绑定按键 |

---

## 技术要点总结

### 为什么 ccleste 适合移植到单片机

ccleste 的 `celeste.c` 是一个教科书级的可移植游戏引擎：

- **零依赖**：不使用 `malloc`、不读文件、不调操作系统 API
- **回调解耦**：所有 I/O（绘制、输入、音频）通过 13 个函数指针回调
- **定点数模式**：支持 `CELESTE_P8_FIXEDP` 宏，用整数运算替代浮点
- **单文件**：~2000 行，结构清晰，变量命名与 PICO-8 Lua 源码一一对应

### 移植中最危险的 bug 模式

回顾 9 个 bug，有 3 个模式反复出现：

1. **"空操作"不空**：空函数如果不消费 `va_arg` 参数，会破坏调用栈（Bug 1）
2. **数据表示不匹配**：`-1` vs `0` 表示空值，差一个符号毁掉整个对象系统（Bug 3）
3. **时序假设不成立**：色板"先存后转"在单线程裸机上有竞态——因为绘制和转换之间还有游戏逻辑在改色板（Bug 5）

### 单片机移植的独特挑战

与传统平台移植不同，ESP32 移植多了几层硬件约束：

- **无文件系统**：资源必须编译进固件（`#include` 头文件数组），不能用 `fopen`
- **无 GPU**：128×128×16bit framebuffer 完全靠 CPU 逐像素填充
- **字节序**：ESP32 小端 vs ST7735 大端，每次 DMA 前后都要做 16KB 的字节交换
- **SPI 时序**：80MHz DMA 传输对时序要求苛刻，初始化序列必须精确匹配 LCD 面板型号

---

> 把一台 2001 年的游戏机塞进一块指甲盖大小的芯片里，这件事本身就很浪漫。更浪漫的是——那个游戏引擎的作者（lemon-sherbet）和移植者（LCH）都没有见过对方，他们的代码却在一颗 ESP32-S3 里安静地协同工作，画出了 Madeline 攀登蔚蓝山峰的第一个像素。
