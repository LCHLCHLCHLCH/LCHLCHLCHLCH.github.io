---
title: 魔塔地图与事件脚本指南：Lua 文件结构与编写方法
date: 2026-08-11
tags: [技术, 游戏, Lua, 开发, 教程]
---

经典魔塔游戏（Magic Tower）的 C++ 复刻项目将地图与事件全部下沉到 Lua 脚本中。本文介绍地图 Lua 文件的结构、事件系统的触发器与 flag 机制，并给出地块 ID 速查表与完整示例。

> **GitHub**：[LCHLCHLCHLCH/mota](https://github.com/LCHLCHLCHLCH/mota)
> **相关阅读**：[从 conhost 到 SDL3：一个 C++ 魔塔游戏的三代渲染演进](/2026/08/11/mota/)

---

## 文件结构

每个楼层对应一个 Lua 文件：`map/floor_N.lua`（N 为楼层号，范围 0~50）。文件返回一个 table，包含 `map` 与 `events` 两个字段：

```lua
return {
    map = {
        -- 13×13 地图数据
    },
    events = {
        -- 事件列表
    }
}
```

除 `events` 外，楼层文件还可定义 `on_step` 函数，引擎会在每次移动/交互后调用它，用于开门谜题等需要持续检查的逻辑。未定义的楼层跳过该钩子。

## 地图格式

`map` 是 13 行 × 13 列的二维数组。数组中每个数字为地块 ID，第 1 行对应 y=0，第 1 列对应 x=0，每行必须恰好 13 个元素：

```lua
map = {
    { 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2 },
    { 2, 9, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2 },
    { 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2 },
    -- ... 共 13 行
    { 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2 },
}
```

## 事件结构

每个事件是一个 table。通用字段如下：

| 字段 | 类型 | 必需 | 说明 |
|---|---|---|---|
| `trigger` | string | 是 | 触发类型：`on_tile`、`on_guard_kill`、`on_clear`、`first_arrive` |
| `once` | bool | 否 | 设为 `true` 即自动一次性触发，无需手动管理 flag 编号 |
| `condition_flag` | int | 否 | 前置 flag ID（0~15），仅当本层该 flag 未设置时触发 |
| `set_flag` | int | 否 | 事件执行后设置的本层 flag ID（0~15） |
| `run` | function | 是 | 触发后执行的 Lua 函数，收到参数 `(x, y)`（触发坐标） |

`run` 函数可调用全部注册的 Lua API。不同 trigger 类型还有额外字段，见下。

## 触发器类型

### `on_tile` — 踩踏地块触发

支持两种匹配方式，互斥：同时指定时按坐标优先。

- **按坐标匹配**（推荐）：使用 `x`、`y` 字段。同一楼层多个相同 NPC 可提供不同服务。
- **按 tile ID 匹配**（兼容旧版）：使用 `tile` 字段。

```lua
{
    trigger = "on_tile",
    x = 5, y = 3,        -- 精确匹配 (5,3) 的商人
    run = function()
        say("买把黄钥匙吧，10金币。")
    end
}

{
    trigger = "on_tile",
    tile = 151,          -- 匹配所有"老人"地块
    once = true,
    run = function()
        say("我可以给你一本怪物手册。")
        set_tile(11, 4, 1)
    end
}
```

> **消失类 NPC 必须用 `tile` 匹配**：如果事件会让 NPC 消失（`set_tile` 改为空地），务必使用 `tile` 而非 `x`/`y` 坐标匹配。坐标匹配的事件无论地块变成什么都会一直拦截该位置的移动；按 `tile` 匹配则只在地块仍是该 NPC 时才拦截。
>
> **约定**：所有老人（tile 151）对话后都会消失。为老人添加对话事件时，在 `say()` 后调用 `set_tile(老人坐标, 1)` 将其移除。

### `on_guard_kill` — 击败全部守卫后触发

当玩家击败指定的**全部**守卫后触发，引擎检查每个守卫位置是否已变为空地（ID=1）。

额外字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `guards` | table | 守卫坐标列表，每个坐标为 `{x = 列, y = 行}` |

```lua
{
    trigger = "on_guard_kill",
    guards = {{x = 6, y = 2}, {x = 8, y = 2}},
    once = true,
    run = function()
        replace_all(player_floor(), 8, 1)   -- 守卫门 → 空地
    end
}
```

守卫必须是怪物（ID 101~150），通过战斗或炸药消灭均可触发。每个事件只有一个守卫组；若楼层有多组守卫门，需创建多个事件各配不同的 `condition_flag` 或 `once`。

### `on_clear` — 楼层怪物清空后触发

楼层中所有怪物被消灭后自动触发，没有额外字段：

```lua
{
    trigger = "on_clear",
    once = true,
    run = function()
        say("你已消灭了本层所有怪物！")
        replace_all(player_floor(), 8, 1)
    end
}
```

`on_clear` 在每次击杀怪物后都会检查。若一个楼层有多个 `on_clear` 事件，只会执行第一个未标记 flag 的事件。

### `first_arrive` — 首次到达触发

玩家第一次进入该楼层时触发（无论走楼梯、楼传还是 Lua 传送），同一楼层只触发一次。适合开局演出、守层 NPC 对话。

```lua
{
    trigger = "first_arrive",
    run = function()
        say("骑士队长：啊！又是你！！（转身逃跑）")
        set_tile(6, 10, 1)
        say("魔王：来与我决斗吧！")
    end
}
```

引擎内部用独立的"已到达"标记（每层 1 bit）控制只触发一次，该标记随存档保存。因此**不要**在此触发器上叠加 `once`/`condition_flag`/`set_flag`。

## Flag 机制

Flag 是按楼层隔离的布尔数组（每层 16 个，ID 0~15），用于：

- **防止事件重复触发**：使用 `once = true` 或 `condition_flag` / `set_flag`
- **跨事件状态**：同一楼层内多个事件共享 flag，实现"先触发 A 后 B 才生效"的顺序谜题

```lua
{
    trigger = "on_tile",
    x = 3, y = 7,
    condition_flag = 3,   -- 仅当本层 flag 3 == 0 时触发
    set_flag = 3,         -- 触发后将本层 flag 3 设为 1
    run = function()
        say("第一次来到这里吧？")
    end
}
```

在 `run` 中也可直接操作 flag：`has_flag(id)` 查询、`set_flag(id)` 设置。二者操作的始终是当前玩家所在楼层的 flag 空间。

> **`once` 与手动 flag 冲突**：`once = true` 自动占用内部 flag，编号等于该事件在 `events` 数组中的索引（0~15）。同一楼层若其他事件用了相同编号的手动 `set_flag`/`condition_flag` 会互相干扰。楼层里已有手动 flag 时，新事件建议改用不冲突的编号。

## Lua API 摘要

`run` 内可直接调用的常用函数：

- **对话与消息**：`say(text)`（模态对话框）、`msg(text)`（底部消息栏）、`note(label, content)`（记入记事本）、`show_notebook()`、`choose_menu(a, b, c, ...)`（最多 8 项选择，返回 0~7 或 255）、`drain()`
- **属性操作**：`add_health(n)`、`add_attack(n)`、`add_defence(n)`、`add_money(n)`、`take_money(n)`（不足返回 `false`）、`set(attr, value)`（支持 `health`/`attack`/`defence`/`money`/`yellow`/`blue`/`red`/`floor`/`x`/`y`）
- **地图操作**：`set_tile(x, y, value)`、`set_tile_floor(floor, x, y, value)`（跨楼层）、`replace_all(floor, from, to)`、`get_tile(x, y)`、`get_tile_floor(...)`、`count_monsters(floor)`、`freeze_lava()`、`detonate()`（返回击杀数）
- **标记操作**：`has_flag(id)`、`set_flag(id)`
- **道具**：`give(id)`、`add_yellow_key(n)` / `add_blue_key(n)` / `add_red_key(n)`、`take_yellow_key(n)`、`set_teleporter(v)`、`set_monster_book(v)`、`set_cross(v)`、`set_holy_shield(v)`、`set_lucky_coin(v)`、`set_dragon_slayer(v)`、`backpack_add(id[, uses])`、`backpack_has(id)`、`show_monster_book()`、`battle_monster(id)`（胜利扣血返回 `true`）、`show_victory()`
- **演出与调试**：`player_floor()`、`player_x()` / `player_y()` / `player_dir()`、`player_attack()` / `player_defence()`、`altar_times()` / `altar_tick()`、`sleep_ms(n)`（先刷新画面再等待）、`darken_map()` / `lighten_map()`、`debug_on()` / `debug_off()`

## 地块 ID 速查表

### 地形（1~11）

| ID | 符号 | 名称 | 说明 |
|---|---|---|---|
| 1 | ` ` | 空地 | 可通行 |
| 2 | ` ` | 墙壁 | 不可通行 |
| 3 | 〓 | 黄门 | 消耗黄钥匙打开 |
| 4 | 〓 | 蓝门 | 消耗蓝钥匙打开 |
| 5 | 〓 | 红门 | 消耗红钥匙打开 |
| 6 | ` ` | 岩浆 | 不可通行（可用冰霜魔法冻结） |
| 7 | ★ | 星星 | 装饰性地块 |
| 8 | 〓 | 守卫门 | 击败守卫后自动打开 |
| 9 | △ | 上行楼梯 | 通往上一层 |
| 10 | ▽ | 下行楼梯 | 通往下一层 |
| 11 | ` ` | 可破墙 | 踩踏后消失 |

### 道具（51~82）

| ID | 符号 | 名称 |
|---|---|---|
| 51 | 钥 | 黄钥匙 |
| 52 | 钥 | 蓝钥匙 |
| 53 | 钥 | 红钥匙 |
| 54 | ★ | 红血瓶 |
| 55 | ★ | 蓝血瓶 |
| 56 | ◆ | 红宝石 |
| 57 | ◆ | 蓝宝石 |
| 58~61 | 剑/盾 | 铁剑盾、银剑盾 |
| 62~65 | 剑/盾 | 骑士剑盾、圣剑盾 |
| 66 | 剑 | 神圣剑 |
| 67 | 盾 | 神圣盾（免疫魔法伤害） |
| 68 | 杖 | 楼层传送器 |
| 69 | 冰 | 冰霜魔法 |
| 70 | 炸 | 炸药 |
| 71 | 镐 | 镐子 |
| 72 | - | 怪物手册（纯背包道具，不出现在地图上） |
| 73 | 十 | 十字架（被动：对兽人/兽人武士/吸血鬼攻击力×2） |
| 74 | 飞 | 中心对称飞行器（可传送 3 次） |
| 75 | 飞 | 下楼飞行器（单次） |
| 76 | 飞 | 上楼飞行器（单次） |
| 77 | 钥 | 魔法钥匙（一次性，打开本层所有黄门） |
| 78 | 震 | 地震卷轴（一次性，摧毁本层所有墙） |
| 79 | 币 | 幸运金币（被动：金币×2） |
| 80 | 圣 | 圣水（生命增加攻击+防御） |
| 81 | 匕 | 屠龙匕首（被动：攻击魔龙伤害×2） |
| 82 | 记 | 记事本 |

### 怪物（101~141）

| ID | 符号 | 名称 |
|---|---|---|
| 101 | ⊙ | 绿史莱姆 |
| 102 | ⊙ | 红史莱姆 |
| 103 | 蝠 | 小蝙蝠 |
| 104 | 法 | 初级法师 |
| 105~106 | 骷 | 骷髅、骷髅士兵 |
| 107 | 卫 | 初级卫兵 |
| 108 | 骷 | 骷髅队长 |
| 109~110 | ⊙/蝠 | 大史莱姆、大蝙蝠 |
| 111 | 法 | 高级法师 |
| 112~113 | 兽 | 兽人、兽人武士 |
| 114 | 石 | 石头人 |
| 115 | 章 | 巨型章鱼 |
| 116 | 血 | 吸血鬼 |
| 117 | 师 | 大法师 |
| 118~120 | 鬼/战/幽 | 鬼战士、战士、幽灵 |
| 121 | 卫 | 中级卫兵 |
| 122 | 武 | 双手剑士 |
| 123 | 龙 | 魔龙 |
| 124 | 骑 | 骑士 |
| 125 | 骑 | 骑士队长（先攻） |
| 126~127 | 巫 | 初级巫师、高级巫师 |
| 128~129 | Θ/蝠 | 史莱姆王、吸血蝙蝠 |
| 130 | 骑 | 黑暗骑士 |
| 131 | 警 | 魔法警卫 |
| 132 | 卫 | 高级卫兵 |
| 133~135 | 王 | 魔王 |
| 136 | 巫 | 高级巫师（会逃亡，机制同 127） |
| 137~139 | - | 战士/骑士/鬼战士（先攻，数值同普通版） |
| 141 | 武 | 双手剑士（先攻） |

### NPC 与其他

| ID | 符号 | 名称 |
|---|---|---|
| 151 | 老 | 老人 |
| 152 | 商 | 商人 |
| 153 | 公 | 公主 |
| 154 | 偷 | 小偷 |
| 155 | 祭 | 祭坛 |
| 140 | - | 隐形墙（踩上后变为墙） |
| 156 | - | 怪物身躯（多格 Boss 的身体） |
| 255 | - | 勇者（玩家）——不要在地图数据中使用 |

> **多格 Boss**：15 层巨型章鱼、35 层魔龙用 3×3 的怪物身躯（156）表示。引擎会叠加一个覆盖整块的大号首领字符。对应事件用 `trigger = "on_tile", tile = 156` + `battle_monster(首领 id)`：胜利后清除整个身躯块并移动玩家。

## 完整示例

### 示例 1：NPC 对话（一次性，按坐标）

```lua
events = {
    {
        trigger = "on_tile",
        x = 3, y = 5,
        once = true,
        run = function()
            say("少年，前方的道路充满危险。")
            add_health(200)
            msg("获得老人的祝福，生命+200")
        end
    }
}
```

### 示例 2：守卫门

```lua
events = {
    {
        trigger = "on_guard_kill",
        guards = {{x = 1, y = 5}, {x = 3, y = 5}},
        once = true,
        run = function()
            replace_all(player_floor(), 8, 1)
        end
    }
}
```

### 示例 3：祭坛（选择分支）

```lua
events = {
    {
        trigger = "on_tile",
        tile = 155,
        run = function()
            local t = altar_times()
            local r = (player_floor() - 1) // 10 + 1
            local cost = 20 + 10 * (t + 1) * t
            local hp  = 100 * (t + 1)
            local atk = 2 * r
            local def = 4 * r

            say("供奉"..cost.."金币，便可以增加你的力量，你想要什么呢……")
            local c = choose_menu("生命+"..hp, "攻击+"..atk, "防御+"..def, "离开")

            if c < 3 and take_money(cost) then
                if c == 0 then add_health(hp)
                elseif c == 1 then add_attack(atk)
                elseif c == 2 then add_defence(def) end
                altar_tick()
                drain()
            elseif c < 3 then
                say("你的金币不足，无法供奉！")
            end
        end
    }
}
```

### 示例 4：商人（坐标匹配 + 选择分支）

```lua
events = {
    {
        trigger = "on_tile",
        x = 5, y = 3,   -- 精确匹配 (5,3) 的商人
        run = function()
            local c = choose_menu("黄钥匙(10金)", "蓝钥匙(20金)", "不买")
            if c == 0 and take_money(10) then
                give(51)
            elseif c == 1 and take_money(20) then
                give(52)
            elseif c < 2 then
                say("金币不足！")
            end
            drain()
        end
    }
}
```

## 注意事项

1. **执行优先级**：玩家移动时，引擎先查 Lua 事件。若该坐标有匹配的 `on_tile` 事件则执行其 `run` 函数（跳过 C++ 默认行为）；否则走 C++ 内置逻辑（开门/捡道具/战斗/移动）。因此 Lua 事件可完全覆盖任何地块类型的默认行为。同一 trigger 类型的多个事件只执行第一个满足条件的。
2. **Flag 范围**：ID 范围 0~15（按楼层隔离），不要超过 15。`once = true` 的自动 flag 由事件索引决定，每层最多 16 个事件。
3. **坐标系统**：x 是列号（0~12），y 是行号（0~12）。地图数组第 1 行是 y=0，第 1 列是 x=0。坐标匹配解决了"一楼层多商人"的问题。
4. **守卫门初始值**：守卫门必须在地图中写为 ID=8，否则 `replace_all` 的 `from=8` 匹配不到。
5. **run 中的错误**：`run` 内的 Lua 错误输出到 stderr，游戏不会崩溃。复杂逻辑建议先在控制台 REPL 中测试。
6. **文件编码**：地图文件使用 UTF-8 编码保存。

## 结语

完整的触发器说明、flag 机制与逐层事件清单可参考仓库内文档：`docs/LUA_EVENT_GUIDE.md` 与 `docs/FLAGS.md`。修改或新增玩法只需编辑对应楼层的 Lua 文件，无需重新编译。
