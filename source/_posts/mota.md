---
title: 从 conhost 到 SDL3：一个 C++ 魔塔游戏的三代渲染演进
date: 2026-08-11
tags: [技术, 游戏, C++, SDL, Lua, 开发]
---

经典魔塔游戏（Magic Tower）的 C++ 复刻项目，基于 SDL3 + SDL_ttf 渲染、Lua 脚本驱动。这篇文章记录其从 CMD 字符界面起步、横跨三代渲染平台的开发历程与最终架构。

> **GitHub**：[LCHLCHLCHLCH/mota](https://github.com/LCHLCHLCHLCH/mota)

---

## 项目概况

`mota` 是一个基于 SDL3 + SDL_ttf 渲染、Lua 脚本驱动的经典魔塔游戏复刻项目，使用 C++ 编写，以 MIT 协议开源。技术栈为 C++17、SDL3、SDL_ttf、Lua 5.5 与 CMake。

项目当前规模：0~50 层共 51 张地图，13×13 棋盘，40 余种怪物，20 余件道具，以及覆盖大部分楼层的 Lua 事件脚本。构建由 CMake `FetchContent` 自动拉取并编译 SDL3/SDL_ttf 源码，`cmake --build .` 一步产出可执行文件，运行时 DLL 与字体由构建脚本统一复制并裁剪。

这个项目的发展历程横跨三代渲染平台。渲染栈的更迭不仅是技术选择的变化，也在相当程度上决定了整个架构的形态。

## 发展历程

### 阶段一：conhost 时代

项目最初只是一个原型：主角能在 13×13 的地图上移动，地图上绘制了墙壁，但墙壁没有任何碰撞逻辑，角色可以穿墙而行。游戏运行于 Windows CMD 的 `conhost.exe`，采用纯字符渲染。

这一版本只能在 Windows 10 上正常显示。Windows 11 的 cmd 默认运行于 Windows Terminal，其字体渲染与 conhost 差异较大，导致画面完全错乱，无法使用。

在此阶段，基于 conhost 逐步实现了碰撞检测、上下楼、钥匙与门、彩色字符显示、若干基础怪物，并完成了 1~10 层的地图设计。

### 阶段二：转向 Windows Terminal

考虑到 conhost 的局限，项目开始同时适配 conhost 与 Windows Terminal，并引入了 ncurses 作为文本 UI 库。ncurses 在 Windows Terminal 下表现正常，但在 conhost 下存在严重的渲染问题，典型表现是字符只显示一半。由于双端适配的维护成本过高，最终放弃 conhost，仅适配 Windows Terminal。

同一时期，借助 [HTML版51层魔塔](https://h5mota.com/tower/?name=51)地图文件，补齐了 50 层的地形、门、宝石、血瓶、楼梯及大部分怪物，并实现了最初的简易背包功能。

### 阶段三：SDL3 时代

随后项目迁移至 SDL 平台。迁移初期的渲染结果基本无法辨认，经修复渲染管线后达到可用状态。借助 SDL_ttf 与中文字体渲染，SDL 版本还原了 conhost 时期的显示效果（此前的 Windows Terminal 版本在字体与配色上存在差异，属于当时做出的取舍）。

在 SDL3 版本中引入了 Lua，用于地图与事件的定义。此后经过较长周期的事件编写，游戏基本完成。

## 分层架构

项目采用分层结构，目录划分与职责对应如下：

```
src/game/      玩家、地图、怪物、道具状态（纯 C++）
src/event/     事件管理：触发器分发、flag 状态管理
src/script/    Lua 桥接：C API 注册、脚本状态管理
src/render/    渲染：网格显示、状态栏、区域绘制
src/ui/        背包、怪物手册、记事本、通关画面
terminal/      SDL 窗口层：字体、调色板、事件循环、控制台
map/           51 层地图与事件脚本（纯 Lua）
```

架构原则为：C++ 提供底层能力，Lua 负责玩法内容。引擎负责渲染、输入、战斗判定、存档等稳定功能；楼层结构、事件逻辑、道具效果等玩法数据全部由脚本定义。这一划分使玩法修改无需重新编译，仅修改对应 Lua 文件即可生效。

## Lua 桥接层

桥接层位于 `lua_bridge.cpp`，向 Lua 全局注册了 40 余个 C API，按用途可分为几类：

- 对话与提示：`say`、`msg`、`note`、`show_notebook`
- 地图操作：`get_tile`、`set_tile`、`replace_all`、`count_monsters`
- 数值操作：`add_health`、`add_attack`、`take_money`、`set`
- 道具接口：`backpack_add`、`backpack_has`、`battle_monster`、`freeze_lava`、`detonate`
- 调试与控制台：`tp`、`give`、`killall`、`save`、`load`、`light`

地图以 Lua 文件定义。每层一个 `map/floor_N.lua`，返回包含 `map` 与 `events` 两个字段的 table，其中 `map` 为 13×13 的数字矩阵：

```lua
return {
    map = {
        { 2,2,2,2,2,2,2,2,2,2,2,2,2 },
        { 2,9,1,101,102,101,1,1,1,1,1,1,2 },
        -- ...
    },
    events = { ... }
}
```

道具同样以 Lua 定义。`items.lua` 中统一注册，每个道具定义 `on_acquire` 与 `on_use` 两个处理函数：

```lua
M.register(74, {
    name = "中心对称飞行器",
    on_acquire = function()
        backpack_add(74, 3)
    end,
    on_use = function()
        local tx = 12 - player_x()
        local ty = 12 - player_y()
        if get_tile(tx, ty) == 1 then
            set("x", tx); set("y", ty)
            return true   -- 返回 true 表示消耗道具
        else
            return false
        end
    end,
})
```

调用链为：玩家接触道具 → C++ 依据 `pickup_map` 将地块映射为道具 ID → 调用 Lua 的 `on_acquire` → Lua 再通过 C API 修改玩家状态 → C++ 重新渲染。

## 事件系统与 flag

事件系统支持五种触发器：

| 触发器 | 触发时机 |
|---|---|
| `on_tile` | 玩家踩到指定坐标或指定地块 |
| `on_guard_kill` | 指定守卫全部被击杀 |
| `on_clear` | 本层怪物清空 |
| `on_step` | 每次移动或交互后（用于持续检查的谜题） |
| `first_arrive` | 玩家首次进入某层 |

flag 的设计包含两点：

1. **每层独立空间。** 系统维护 `flags_[51][16]` 数组，即 51 层 × 每层 16 个 flag，不同楼层互不影响，免除了跨层 flag 编号冲突的问题。
2. **`once = true` 自动管理。** 事件只需声明 `once = true`，系统自动分配内部 flag 并记录已触发状态，脚本无需手动维护编号：

```lua
{
    trigger = "on_tile",
    x = 6, y = 6,
    once = true,
    run = function()
        set("x", 6); set("y", 6)
        say("魔王：你终于来了，我很想与你立刻决斗，但我的部下不同意。")
    end
}
```

## 战斗与机制

与经典的50层魔塔相同，战斗采用确定性规则，不包含随机数。回合制伤害计算为双方互相扣除"攻击减去对方防御"的差值，先归零者败；攻击力不大于对方防御时判定为无法攻击。部分怪物具有先攻属性，战斗开始时先行动一次，如骑士队长及其 12 个手下。

基于确定性规则，所有战斗可在行动前完整预判，UI 层据此实现"怪物手册红绿灯"显示：绿表示无伤可击杀，黄表示有损耗但可击败，红表示无法击败。

区域伤害包含两类机制：

- **领域伤害**：初级巫师（100 点）与高级巫师（200 点）的四向相邻格构成伤害区域，进入即扣除生命；
- **夹击伤害**：两魔法警卫中间格构成夹击位，对扣除领域伤害后的剩余生命取半；
- **神圣盾**免疫上述魔法伤害，是流程中的关键装备。

多格 Boss 占据多个地块（15层的巨型章鱼和35层的魔龙），触碰任意身躯格即进入战斗，击败后身躯消失并开启后续通道。

存档采用纯文本 `.sav` 文件，序列化内容包括玩家属性、51×16 的 flag 表、背包及其道具次数、记事本对话记录，以及地图相对初始状态的改动。加载时逐行解析并重建状态。

## 渲染与 UI

SDL3 版本沿用字符游戏的显示形式：28 列 × 22 行字符网格，8 色调色板，以 cell 缓冲逐格渲染。具体实现包括：

- **巨型 Boss 跨格渲染**：检测多格 Boss 地块后，以较大字号在整块区域叠加首领字符；
- **怪物手册红绿灯**：持有怪物手册时，地图上每只怪物标记红黄绿状态灯；
- **记事本**：自动记录老人与商人的对话，按字符（UTF-8）换行，避免截断汉字；
- 支持高 DPI 自适应与浅色/暗色模式切换。

## 工程化

CMake 构建对 SDL3 进行了最小化配置：仅保留视频、渲染与事件模块，关闭音频、手柄、GPU 等无关子系统；SDL_ttf 仅启用 FreeType。构建后自动复制运行时 DLL 与字体，并执行 strip 去除调试符号。由于纯 Lua 改动不会触发 C++ 重链接，项目单独以 stamp 文件检测地图文件的变更并同步到输出目录。

CI 使用 GitHub Actions：推送 tag 时触发 MinGW 构建，打包 EXE、DLL、字体与地图为 zip 并发布 Release。
## 结语

该项目通过三次渲染平台迁移（conhost → Windows Terminal → SDL3），最终形成了"C++ 管能力、Lua 管内容"的分层架构。若对实现细节或 Lua 事件编写感兴趣，可参考仓库内 `docs/FLAGS.md` 与 `docs/LUA_EVENT_GUIDE.md`。

仓库地址：**https://github.com/LCHLCHLCHLCH/mota**
