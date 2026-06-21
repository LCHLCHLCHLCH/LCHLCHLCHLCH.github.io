---
title: NESP & NESP2 — 把 NES 塞进单片机，两次
date: 2025-06-25
tags: [技术, ESP32, 嵌入式, 游戏, 移植, NES]
---

> **GitHub**：[LCHLCHLCHLCH/NES4esp](https://github.com/LCHLCHLCHLCH/NES4esp)（NESP 在 `main` 分支，NESP2 在 [`esp32-s3-320x240`](https://github.com/LCHLCHLCHLCH/NES4esp/tree/esp32-s3-320x240) 分支）

在 ccleste4esp 把 Celeste Classic 塞进 ESP32-S3 之后，一个自然的问题是：能不能跑 NES？Celeste Classic 毕竟是 PICO-8 游戏——128×128 分辨率、16 色调色板、不依赖文件系统——天生适合单片机。而 NES 是正儿八经的游戏主机：256×240 分辨率、6502 CPU + PPU 双芯片架构、数十种 Mapper 芯片、64 色调色板、音频处理器。把这一套搬上同一块芯片，要解决的问题多得多。

---

## NESP：同一块硬件，全新的挑战

### 硬件（与 ccleste4esp 完全相同）

| 组件 | 规格 |
|---|---|
| 主控 | ESP32-S3（双核 240MHz, 8MB Flash, 8MB PSRAM） |
| 屏幕 | ST7735R 1.44" 128×128 SPI TFT |
| 按键 | 6 个（左/右/上/下/跳/冲） |
| 帧率 | ~60fps（模拟速度），实际渲染 ~30fps（FrameSkip=1） |
| 音频 | 未实现 |

### 模拟器核心：infoNES

选择 [InfoNES](https://github.com/jay-kumogata/InfoNES) 作为模拟核心。InfoNES 用 C++ 写成，约 15,000 行，支持 86 种 Mapper。最关键的是：它的架构天然适合移植——所有平台相关代码通过 `InfoNES_System.h` 中的回调函数解耦，只需实现十几个函数就可以在新平台上运行。

```
InfoNES 架构：
  ┌────────────────────────────┐
  │  InfoNES.cpp  主循环/PPU   │
  │  K6502.cpp    6502 模拟    │
  │  InfoNES_Mapper.cpp 86种Mapper│
  └──────────┬─────────────────┘
             │ InfoNES_System.h 回调
  ┌──────────▼─────────────────┐
  │  nes_frontend.cpp          │  ← 唯一需要写的文件
  │  ├── ROM 加载 (从 Flash)    │
  │  ├── 画面缩放 (256→128)     │
  │  ├── 按键映射 (GPIO→NES手柄) │
  │  └── 存档管理 (NVS Flash)   │
  └────────────────────────────┘
```

### 画面缩放

NES 原生分辨率 256×240，但屏幕只有 128×128。方案：**整数 2:1 缩放**——每 2×2 的源像素合并为 1 个输出像素，得到 128×120 的画面，上下各留 4px 黑边居中。

```c
// 2:1 整数缩放，取偶数行/列
for (int dy = 0; dy < 120; dy++) {
    int sy = dy * 2;
    for (int dx = 0; dx < 128; dx++) {
        int sx = dx * 2;
        dst[dy+4][dx] = src[sy][sx];  // 无插值，纯采样
    }
}
```

无闪烁、无锯齿——比任何插值算法都干净。

### 内存布局

ESP32-S3 有 512KB 内部 SRAM + 8MB 外部 PSRAM。内存分配是关键决策：

| 数据 | 大小 | 位置 | 原因 |
|---|---|---|---|
| `ROM` (PRG) | 32-393KB | 内部 SRAM（优先）/ PSRAM（fallback） | CPU 每指令取指，需低延迟 |
| `VROM` (CHR) | 8KB | 内部 SRAM | PPU 每像素读 tile |
| `WorkFrame` | 256×240×2 = 120KB | PSRAM (`EXT_RAM_BSS_ATTR`) | 太大，放外部 |
| `ChrBuf` | 32KB | 内部 SRAM | sprite 0 命中检测需随机访问 |
| `display_mem` | 128×128×2 = 32KB | 内部 SRAM | DMA 推屏 |
| `DRAM` | 40KB | PSRAM | Mapper 扩展 RAM |

### ROM 如何存在于单片机里

没有文件系统。ROM 通过 **编译时嵌入**：

```
  zelda.nes (ROM 文件, 128KB)
       │  python convert_rom.py
       ▼
  main/nes_rom.h (C 头文件, ~2.5MB)
  ┌──────────────────────────────┐
  │ static const unsigned char   │
  │   nes_rom_data[131088] = {   │
  │     0x4E, 0x45, 0x53, ...    │  ← 整个 ROM 的 hex 数组
  │   };                         │
  └──────────────────────────────┘
       │  #include "nes_rom.h"
       ▼
  编译进固件 → 烧录到 Flash
```

替换 ROM 只需三步：`python convert_rom.py`（指定新 .nes 文件）→ 编译 → 烧录。

---

## 九个关键 Bug

### Bug 1：长按跳跃 = 暂停

**现象**：马里奥跳高时游戏突然"卡死"。

**根因**：只有 6 个按键，需要映射 NES 的 8 个功能键。最初方案是**长按跳跃键 0.67 秒触发 Start**。马里奥跳高时玩家自然会按住跳跃键——0.67 秒刚好触发暂停。更糟的是，NES 游戏的暂停是乒乓切换：Start 按下一次 = 暂停，再按一次 = 恢复。但长按逻辑只在帧 40-55 发送 Start 脉冲，之后就永远不再触发——游戏永久卡在暂停状态，必须 Reset。

**修复**：改为边沿触发——按住跳跃键 90 帧（约 1.5-2.5 秒）发一帧 Start 脉冲后计数器归零，继续按住会再次计时、再次触发。这样按住不动就能反复切换暂停/恢复。

### Bug 2：黑色背景变红色

**现象**：游戏本应是黑色的背景区域显示为中等红色。

**根因**：infoNES 用 `PalTable` 的 bit 15（`0x8000`）作为"背景透明像素"的标志位，所有 color-0 调色板入口被写为 `NesPalette[color] | 0x8000`。这在 PC 版的 **RGB555** 格式下完全无害——RGB555 的最高位恰好是空闲位。但在 ESP32 的 **RGB565** 格式下，bit 15 是红色通道的最高位。`0x0000 | 0x8000 = 0x8000`，在 RGB565 中解码为 R=16, G=0, B=0 → **中等红色**。

```
RGB555 (PC):  [X][RRRRR][GGGGG][BBBBB]   bit15 = 空闲!
RGB565 (ESP): [RRRRR][GGGGGG][BBBBB]     bit15 = 红色 MSB!
```

**修复**：在 `InfoNES_LoadFrame` 中添加 `& 0x7FFF` 剥离标志位。

### Bug 3：精灵穿透砖块

**现象**：蘑菇从问号块冒出来时，渲染在已被顶的砖块上面；马里奥从水管钻出时出现在砖块上面。图层顺序错乱。

**根因**：更深层的 RGB565 vs RGB555 问题。精灵优先级检查用 `pPoint[nX] & 0x8000` 判断背景像素是否透明。但 Firebrandx 调色板中**大量红/橙/棕色系的 bit 15 本来就是 1**——这些颜色的砖块和问号块被误判为"透明"，导致 sprite 穿透显示。

| 颜色 | NES 索引 | RGB565 | bit15 |
|---|---|---|---|
| 暗红 | $06 | `0x9240` | **1** |
| 亮红 | $16 | `0xF812` | **1** |
| 紫红 | $04 | `0xB00D` | **1** |
| 淡橙 | $17 | `0xDB60` | **1** |

**修复**：彻底弃用 `0x8000` 标志位。改为直接比较颜色值——所有 color-0 入口都镜像到 `PalTable[0]`，用 `pPoint[nX] == PalTable[0]` 替代 `pPoint[nX] & 0x8000`。

### Bug 4：Zelda 存档丢失

**现象**：塞尔达传说存档后重启丢失。

**根因**：NES 卡带使用电池供电的 SRAM 保存存档。ESP32 没有电池备份的 SRAM，SRAM 在掉电后清零。

**修复**：使用 ESP32 的 **NVS**（非易失性存储）——将 8KB SRAM 分两片存入 Flash。启动时自动加载，游戏过程中每 5 秒自动保存（CRC32 校验，只在变化时写入，避免磨损 Flash）。

### Bug 5：SMB3 花屏

**现象**：Super Mario Bros. 3 画面大面积花屏、瓦片错乱。

**根因**：MMC3 mapper 是 NES 最复杂的 mapper 之一，通过扫描线计数器在 HBlank 期间切换 CHR bank。SMB3 的状态栏和游戏区使用不同的 CHR bank，如果 MMC3 的 IRQ 时序不准确，bank 切换就会错位。

**修复**：调整 `sdkconfig` 中的 FreeRTOS tick 频率和任务优先级，确保 `MapperHSync()` 在正确的时机被调用。

### Bug 6：SPI 字节序

ESP32 是小端序，ST7735 期望大端序。最初方案是每次 DMA 前后对整个 framebuffer 做 `bswap16`——每帧两次 16KB 遍历。优化方案：在 `InfoNES_LoadFrame` 中直接写入 BE 格式的像素值，省去单独的全帧 swap 循环。

### Bug 7：帧率不足

**现象**：游戏运行速度明显慢于原版 NES，长按触发 Start 需要近 7 秒。

**根因**：CPU 模拟 + PPU 渲染 + SPI DMA 在一帧内无法在 16.67ms 内完成。

**修复**：设置 `FrameSkip=1`——PPU 渲染隔帧执行，但 6502 模拟全速运行。画面刷新降到 ~30fps，但游戏逻辑速度回归正常。这是"最大幅度的单行改动提速"。

### Bug 8：ChrBuf 缓存一致性问题

PPU 的 sprite 0 命中检测需要随机访问 pattern table 数据。将 `ChrBuf` 放在 PSRAM 中时，缓存未命中导致 sprite 0 hit 偶尔丢失，游戏随机卡死等待 sprite 0 hit。修复：将 `ChrBuf` 强制放在内部 SRAM。

### Bug 9：PC 卡死无诊断

NES 游戏有时会因未被发现的模拟 bug 而卡死在无限循环中（如等待 sprite 0 hit）。加入 PC 卡死检测：每 30 帧采样一次 Program Counter，连续 4 次不变则打印 CPU/PPU 状态诊断（寄存器、扫描线、sprite 状态等）。

---

## 兼容性

infoNES 支持 **86 种 Mapper**，覆盖绝大多数经典 NES 游戏：

| 游戏 | Mapper | 状态 |
|---|---|---|
| **Super Mario Bros.** | 0 (NROM) | ✅ 流畅 |
| **The Legend of Zelda** | 1 (MMC1) | ✅ 流畅（支持存档） |
| **Super Mario Bros. 3** | 4 (MMC3) | ✅ 流畅（自动跳帧） |
| Contra（魂斗罗） | 2 (UNROM) | ✅ |
| Mega Man 2（洛克人 2） | 1 (MMC1) | ✅ |
| Castlevania（恶魔城） | 2 (UNROM) | ✅ |
| Kirby's Adventure | 4 (MMC3) | ✅ |

---

## NESP2：全分辨率 NES

NESP 把 NES 跑起来了，但 128×128 屏幕上的 2:1 缩放画面始终是一种妥协——每个像素都是 4 合 1，细节被抹平。于是有了 NESP2。

### 新硬件

| 组件 | NESP | NESP2 |
|---|---|---|
| 屏幕 | ST7735R 128×128 | **320×240 TFT** |
| SPI 模式 | Mode 3, 80MHz | Mode 0, 60MHz |
| 按键 | 6 个（复用 Start/Select） | **8 个**（独立 Start/Select） |
| 显示方式 | 2:1 缩放 + 上下黑边 | **1:1 像素** + 左右黑边 |

核心升级是 **320×240 屏幕**。NES 原生 256×240 可以**点对点**显示——不需要任何缩放。画面居中，左右各留 32px 黑边。

```c
// NESP2: 直接推送 WorkFrame 到 LCD 的 32..287 列
LCD_Address_Set(32, 0, 287, 239);  // 居中显示
// WorkFrame 像素 1:1 映射，无缩放！
```

### 架构改进

相比 NESP，NESP2 做了多项架构优化：

**独立的 Start/Select 按键**：8 个 GPIO 按键直接映射 NES 手柄的全部 8 个功能键，不再需要长按组合键这种 hack。

**调色板预交换**：`NesPalette` 在编译时就存储为 BE（大端序）格式。`WorkFrame` 中的每个像素是 `PalTable` 查表得到的值，直接就是 DMA 可发送的格式——不再需要任何 `bswap16`。

```c
// NESP2: NesPalette 直接就是 BE 格式
WORD NesPalette[64] = {
    0x6D6B, 0x3201, 0x1B00, ...  // BE: 高字节在前，DMA 可直接发送
};
```

**队列化 DMA**：NESP 用单次 `spi_device_polling_transmit` 传输整个 framebuffer。NESP2 将 320×240 的帧拆分为多个 4KB 的 chunk，通过 `spi_device_queue_trans` 排队——DMA 引擎自动连续处理多个 chunk，CPU 在传输期间可以继续做其他事情。

**PSRAM 缓存一致性**：NESP2 的 `WorkFrame` 在 PSRAM 中，DMA 传输前用 `esp_cache_msync` 确保缓存中的数据已写回物理内存。

**FPS 计数器**：在右侧黑边区域绘制实时帧率，方便调试性能。

**启动画面**：`lotus.jpg` → `lotus_img.h` → 上电时显示一张 320×240 的启动图。

### NESP2 的目录结构

```
NESP2/
├── main/
│   ├── main.cpp              # 入口
│   ├── nes_frontend.cpp      # InfoNES 系统层 (320×240 1:1 输出)
│   ├── esp32_frontend.c      # Celeste PICO-8 前端 (保留)
│   ├── font_data.h           # PICO-8 字体 (保留)
│   ├── lotus_img.h           # 启动画面 (320×240 RGB565)
│   ├── nes_rom.h             # 嵌入式 ROM
│   ├── InfoNES/              # NES 模拟器核心 (同 NESP)
│   └── Drivers/
│       └── LCD/              # 320×240 LCD 驱动
│           ├── lcd.c         # 像素/线条/文字/填充
│           ├── lcd_init.c    # SPI+DMA 初始化 (Mode 0, 60MHz)
│           ├── lcdfont.h     # ASCII 字体
│           └── pic.h         # 图片数据
├── convert_rom.py            # ROM 转换工具
├── convert_lotus.py          # 启动图转换工具
├── lotus.jpg                 # 启动图源文件
└── _build.bat / _flash.bat   # 一键编译烧录
```

---

## 两个版本的对比

| 维度 | NESP | NESP2 |
|---|---|---|
| 屏幕 | 128×128 | **320×240** |
| NES 画面 | 2:1 缩放（128×120） | **1:1 点对点（256×240）** |
| 像素细节 | 4 合 1，模糊 | **完全保留** |
| 按键 | 6 键（Start/Select 需长按） | **8 键独立** |
| 调色板格式 | LE，每像素需 bswap | **BE 预交换，零开销** |
| DMA 方式 | 单次传输 | **队列化多 chunk** |
| 缓存一致性 | 无 | **esp_cache_msync** |
| FPS 显示 | 无 | **右侧栏实时显示** |
| 启动画面 | 无 | **Lotus 启动图** |
| Celeste 支持 | 代码保留但未编译 | **代码保留** |

---

## 技术要点总结

### infoNES 为什么适合移植

- **回调架构**：所有 I/O 通过 7 个函数指针回调——`ReadRom`、`LoadFrame`、`PadState`、`SoundOutput` 等
- **零依赖**：不调操作系统 API，不用文件系统，`malloc` 可以替换为静态分配
- **Mapper 覆盖广**：86 种 Mapper，涵盖几乎所有经典游戏
- **C++ 写成，C 可调用**：`extern "C"` 接口，直接嵌入 C 项目

### 移植中最深刻的教训

回顾两个项目，一条主线贯穿始终：**PC 上的假设在裸机上不成立**。

1. **RGB555 vs RGB565**：infoNES 用 `0x8000` 做 backdrop 标志，在 RGB555（PC 上常见的 16 位色格式）中 bit 15 是空闲位，完全不干扰颜色。但在 RGB565 中 bit 15 是红色 MSB——一个"巧妙"的设计在格式变化后变成了两个 bug（黑色变红 + 砖块穿透）。

2. **字节序**：x86 和 ESP32 都是小端，但 ST7735/ST7789 期望大端。每一帧的每个像素都要转换。

3. **PSRAM 的隐藏成本**：PSRAM 带宽远低于内部 SRAM，而且有缓存一致性问题。哪些数据放内部、哪些放外部，需要根据访问模式仔细权衡——不是"大的放外部"那么简单。

4. **时序假设**：PC 上的模拟器假设 VBlank 期间有充足时间完成所有渲染。ESP32 上渲染本身可能跨越 VBlank 边界，导致下一帧的 sprite 0 数据尚未就绪。

### 移植中最危险的 bug 模式

1. **"刚好能用"的巧合**：RGB555 的 bit 15 是空闲位，RGB565 不是——一个在其他平台上"刚好能用"的设计，在新平台上产生两个独立 bug
2. **资源饥饿**：内部 SRAM 不够用，PSRAM 太慢——在"不够快"和"不够大"之间反复权衡
3. **硬件协议的隐性约束**：SPI 时序、LCD 初始化序列、DMA 字节对齐——偏差一点就全屏花

---

> 从 Celeste Classic 到 Super Mario Bros.，从 128×128 到 320×240，从 6 键复用到 8 键独立——每一次迭代都在逼近真正的掌机体验。而所有这些，运行在一颗连 MMU 都没有的微控制器上。NES 诞生于 1983 年，ESP32-S3 诞生于 2023 年——四十年后，它们在同一块 PCB 上相遇了。
