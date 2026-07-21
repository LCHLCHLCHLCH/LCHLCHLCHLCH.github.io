---
title: 塔罗占卜
date: 2026-07-05
tags: [交互, 塔罗, 占卜]
---

## 关于塔罗

这是一个交互式塔罗占卜工具。输入你的问题，从洗好的牌阵中凭直觉选出 3 张，它们分别对应**过去**、**现在**和**未来**。

选完后结果会显示在下方文本框中——**请手动复制结果，粘贴到任意 AI 对话框中让它为你解读**。本页面只负责随机抽牌，不内置 AI 解牌功能。

<div class="tarot-app">

## 开始占卜

<div class="tarot-form">
  <label>请输入你想问的问题</label>
  <div class="tarot-input-row">
    <input type="text" id="qInput" placeholder="例如：我最近的运势如何？">
    <button id="drawBtn">洗 牌</button>
  </div>
</div>

<div class="tarot-spread" id="spreadSection" style="display:none;">
  <div class="tarot-spread-header">
    <span>请凭直觉点击选择 <strong>3</strong> 张牌</span>
    <span>已选 <strong id="pickedCount">0</strong> / 3</span>
  </div>
  <div class="tarot-spread-area" id="spreadArea"></div>
  <p class="tarot-seed-info" id="seedInfo"></p>
</div>

<div class="tarot-result" id="resultSection" style="display:none;">
  <label>占卜结果</label>
  <textarea id="resultBox" readonly rows="10" placeholder="选完 3 张牌后结果将显示在这里..."></textarea>
  <div class="tarot-result-btns">
    <button id="resetBtn">重新洗牌</button>
    <button id="copyBtn">复制结果</button>
  </div>
</div>

<div id="tarotToast" class="tarot-toast"></div>

<style>
/* ═══════════════════════════════════════════
   塔罗占卜 — XP Luna 风格
   作用域限定在 .tarot-app 内
   ═══════════════════════════════════════════ */
.tarot-app {
  margin-top: 8px;
  font-size: 14px;
}

/* ── 表单行 ── */
.tarot-form { margin-bottom: 14px; }
.tarot-form label {
  display: block;
  margin-bottom: 6px;
  font-weight: bold;
}
.tarot-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.tarot-input-row input {
  flex: 1;
  min-width: 0;
}

/* ── 牌阵区 ── */
.tarot-spread { margin: 12px 0; }
.tarot-spread-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 13px;
  color: #444;
}
.tarot-spread-header strong { color: #1f60d0; }

.tarot-spread-area {
  display: grid;
  grid-template-columns: repeat(3, auto);
  justify-content: center;
  align-items: center;
  gap: 10px 14px;
  min-height: 180px;
  padding: 6px 0 18px;
  perspective: 1000px;
  max-width: 440px;
  margin: 0 auto;
}
/* 卡牌固定宽高比 */
.tarot-card { aspect-ratio: 82 / 126; }

.tarot-seed-info {
  text-align: center;
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

/* ── 卡牌槽位 ── */
.tarot-slot {
  cursor: pointer;
  animation: tarotFadeIn 0.5s ease forwards;
  opacity: 0;
}
.tarot-slot:hover { transform: translateY(-4px); }
.tarot-slot.selected { cursor: default; pointer-events: none; }

/* ── 卡牌（3D 翻转容器）── */
.tarot-card {
  width: 120px;
  height: 180px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
}
.tarot-card.flipped { transform: rotateY(180deg); }

/* ── 牌背 ── */
.tarot-card-back {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 8px;
  border: 2px solid #0e2d6b;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  background: #3874d0;
  overflow: hidden;
}
.tarot-slot:hover .tarot-card-back {
  border-color: #0a2060;
  box-shadow: 0 2px 14px rgba(30,80,200,0.4);
}
.tarot-slot.picked .tarot-card-back {
  opacity: 0.45;
  cursor: not-allowed;
}

/* ── 牌面 ── */
.tarot-card-front {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 8px;
  border: 2px solid #7f9cd9;
  transform: rotateY(180deg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 5px;
  text-align: center;
  box-shadow: 0 2px 10px rgba(0,0,0,0.15);
}
.tarot-card-front .tarot-suit-icon { font-size: 44px; margin-bottom: 4px; }
.tarot-card-front.major .tarot-suit-icon     { color: #b8860b; }
.tarot-card-front.wands .tarot-suit-icon     { color: #d46c3c; }
.tarot-card-front.cups .tarot-suit-icon      { color: #2b6cc4; }
.tarot-card-front.swords .tarot-suit-icon    { color: #6b6b8b; }
.tarot-card-front.pentacles .tarot-suit-icon { color: #3a8a40; }
.tarot-card-front .tarot-card-name {
  font-size: 18px;
  font-weight: bold;
  color: #1f3a6b;
  margin-bottom: 3px;
  line-height: 1.25;
}
.tarot-card-front .tarot-card-keyword {
  font-size: 9px;
  color: #666;
  line-height: 1.3;
}
.tarot-card-front .tarot-rev-badge {
  display: inline-block;
  font-size: 9px;
  color: #c00;
  border: 1px solid #d88;
  padding: 0px 5px;
  border-radius: 10px;
  margin-top: 3px;
}

/* 花色背景 + 边框颜色 */
.tarot-card-front.major     { border-color: #d4a020; background: #fef8e8; }
.tarot-card-front.wands     { border-color: #d46c3c; background: #fef2ec; }
.tarot-card-front.cups      { border-color: #4c8cd4; background: #ecf2fc; }
.tarot-card-front.swords    { border-color: #8888a0; background: #f2f2f7; }
.tarot-card-front.pentacles { border-color: #4ca860; background: #ecf7ef; }
/* 逆位牌偏灰 */
.tarot-card-front.rev.major     { background: #ece4d0; }
.tarot-card-front.rev.wands     { background: #ebe0da; }
.tarot-card-front.rev.cups      { background: #dde3ec; }
.tarot-card-front.rev.swords    { background: #e4e4ea; }
.tarot-card-front.rev.pentacles { background: #dee8e0; }

/* ── 结果区 ── */
.tarot-result { margin-top: 10px; }
.tarot-result label {
  display: block;
  margin-bottom: 6px;
  font-weight: bold;
}
.tarot-result textarea { width: 100%; }
.tarot-result-btns {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  justify-content: flex-end;
}

/* ── Toast ── */
.tarot-toast {
  position: fixed;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  background: InfoBackground;
  color: InfoText;
  padding: 8px 24px;
  border: 1px solid #7f9cd9;
  border-radius: 4px;
  font-size: 13px;
  z-index: 9999;
  opacity: 0;
  transition: opacity 0.35s;
  pointer-events: none;
  box-shadow: 0 2px 12px rgba(0,0,0,0.2);
}
.tarot-toast.show { opacity: 1; }

/* ── 动画 ── */
@keyframes tarotFadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes tarotPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(30,80,200,0.4); }
  50%      { box-shadow: 0 0 0 6px rgba(30,80,200,0); }
}
.tarot-slot.picked .tarot-card-back { animation: tarotPulse 0.7s ease-out; }

/* ── 响应式 ── */
@media (max-width: 700px) {
  .tarot-spread-area { gap: 8px 10px; max-width: none; grid-template-columns: repeat(3, 1fr); }
  .tarot-card { width: 100%; height: auto; }
  .tarot-card-front { padding: 6px 4px; }
  .tarot-card-front .tarot-suit-icon { font-size: 36px; }
  .tarot-card-front .tarot-card-name { font-size: 16px; }
  .tarot-spread-area { min-height: 160px; }
  .tarot-input-row { flex-direction: column; align-items: flex-end; }
  .tarot-input-row input { width: 100%; }
  .tarot-result-btns { justify-content: flex-end; }
}
@media (max-width: 420px) {
  .tarot-spread-area { gap: 6px 8px; }
  .tarot-card-front .tarot-card-name { font-size: 14px; }
  .tarot-card-front .tarot-suit-icon { font-size: 28px; }
  .tarot-spread-area { min-height: 130px; }
}
</style>

<script>
(function() {
  /* ═══════════════════════════════════════════
     塔罗牌数据
     ═══════════════════════════════════════════ */
  var DECK = [
    { id:0,  name:"愚者",       en:"The Fool",       suit:"major", keyword:"新的开始 · 冒险 · 天真 · 自由", keywordR:"鲁莽 · 轻率 · 赌博 · 愚蠢" },
    { id:1,  name:"魔术师",     en:"The Magician",   suit:"major", keyword:"创造力 · 技能 · 意志力 · 资源", keywordR:"欺骗 · 操控 · 能力不足 · 计划受阻" },
    { id:2,  name:"女祭司",     en:"The High Priestess", suit:"major", keyword:"直觉 · 潜意识 · 神秘 · 智慧", keywordR:"隐瞒 · 情绪封闭 · 无知 · 表面" },
    { id:3,  name:"女皇",       en:"The Empress",    suit:"major", keyword:"丰饶 · 母性 · 自然 · 感官", keywordR:"依赖 · 创造力受阻 · 空虚" },
    { id:4,  name:"皇帝",       en:"The Emperor",    suit:"major", keyword:"权威 · 秩序 · 稳定 · 领导力", keywordR:"专制 · 失控 · 僵化 · 滥用权力" },
    { id:5,  name:"教皇",       en:"The Hierophant", suit:"major", keyword:"传统 · 信仰 · 教育 · 指引", keywordR:"叛逆 · 打破常规 · 挑战传统" },
    { id:6,  name:"恋人",       en:"The Lovers",     suit:"major", keyword:"爱情 · 选择 · 结合 · 价值观", keywordR:"分离 · 背叛 · 错误选择 · 不和谐" },
    { id:7,  name:"战车",       en:"The Chariot",    suit:"major", keyword:"胜利 · 意志 · 决心 · 控制", keywordR:"失控 · 失败 · 侵略性 · 混乱" },
    { id:8,  name:"力量",       en:"Strength",       suit:"major", keyword:"勇气 · 耐心 · 内在力量 · 同理心", keywordR:"软弱 · 自我怀疑 · 失控情绪" },
    { id:9,  name:"隐士",       en:"The Hermit",     suit:"major", keyword:"内省 · 孤独 · 寻求真理 · 指引", keywordR:"孤僻 · 逃避 · 拒绝建议 · 迷失" },
    { id:10, name:"命运之轮",   en:"Wheel of Fortune",suit:"major", keyword:"转变 · 机遇 · 循环 · 命运", keywordR:"厄运 · 失控 · 不确定性 · 阻碍" },
    { id:11, name:"正义",       en:"Justice",        suit:"major", keyword:"公平 · 真理 · 因果 · 责任", keywordR:"不公 · 偏见 · 逃避责任" },
    { id:12, name:"倒吊人",     en:"The Hanged Man", suit:"major", keyword:"牺牲 · 放手 · 新视角 · 等待", keywordR:"停滞 · 抗拒 · 不肯牺牲" },
    { id:13, name:"死神",       en:"Death",          suit:"major", keyword:"结束 · 新生 · 转变 · 放下", keywordR:"抗拒改变 · 停滞 · 恐惧" },
    { id:14, name:"节制",       en:"Temperance",     suit:"major", keyword:"平衡 · 调和 · 中庸 · 耐心", keywordR:"失衡 · 过度 · 不协调" },
    { id:15, name:"恶魔",       en:"The Devil",      suit:"major", keyword:"束缚 · 欲望 · 沉迷 · 物质", keywordR:"解放 · 觉醒 · 摆脱束缚" },
    { id:16, name:"高塔",       en:"The Tower",      suit:"major", keyword:"突变 · 崩塌 · 启示 · 释放", keywordR:"避免灾难 · 延缓 · 恐惧改变" },
    { id:17, name:"星星",       en:"The Star",       suit:"major", keyword:"希望 · 治愈 · 灵感 · 宁静", keywordR:"绝望 · 失去信心 · 沮丧" },
    { id:18, name:"月亮",       en:"The Moon",       suit:"major", keyword:"幻象 · 恐惧 · 潜意识 · 直觉", keywordR:"真相 · 混乱消散 · 恐惧解除" },
    { id:19, name:"太阳",       en:"The Sun",        suit:"major", keyword:"成功 · 快乐 · 活力 · 清晰", keywordR:"暂时的挫折 · 扫兴 · 黯淡" },
    { id:20, name:"审判",       en:"Judgement",      suit:"major", keyword:"觉醒 · 重生 · 召唤 · 清算", keywordR:"拒绝召唤 · 遗憾 · 无法释怀" },
    { id:21, name:"世界",       en:"The World",      suit:"major", keyword:"圆满 · 完成 · 整合 · 旅行", keywordR:"未完成 · 拖延 · 空虚" },

    { id:22, name:"权杖王牌",   en:"Ace of Wands",   suit:"wands", keyword:"新开始 · 灵感 · 能量 · 机会", keywordR:"延误 · 精力不足 · 错失机会" },
    { id:23, name:"权杖二",     en:"Two of Wands",   suit:"wands", keyword:"规划 · 远见 · 决定 · 探索", keywordR:"恐惧未知 · 缺乏远见 · 拘束" },
    { id:24, name:"权杖三",     en:"Three of Wands", suit:"wands", keyword:"扩展 · 远见 · 探索 · 进步", keywordR:"障碍 · 失败 · 计划受阻" },
    { id:25, name:"权杖四",     en:"Four of Wands",  suit:"wands", keyword:"庆祝 · 稳定 · 归属 · 收获", keywordR:"不稳定 · 变动 · 家庭不和" },
    { id:26, name:"权杖五",     en:"Five of Wands",  suit:"wands", keyword:"竞争 · 冲突 · 分歧 · 挑战", keywordR:"和解 · 避免冲突 · 妥协" },
    { id:27, name:"权杖六",     en:"Six of Wands",   suit:"wands", keyword:"胜利 · 认可 · 自信 · 荣归", keywordR:"失败 · 傲慢 · 缺乏认可" },
    { id:28, name:"权杖七",     en:"Seven of Wands", suit:"wands", keyword:"坚持 · 防御 · 立场 · 勇气", keywordR:"退缩 · 放弃 · 被压垮" },
    { id:29, name:"权杖八",     en:"Eight of Wands", suit:"wands", keyword:"迅速 · 进展 · 行动 · 旅行", keywordR:"延迟 · 慌乱 · 失控" },
    { id:30, name:"权杖九",     en:"Nine of Wands",  suit:"wands", keyword:"韧性 · 坚持 · 最后防线 · 准备", keywordR:"固执 · 疲倦 · 放弃" },
    { id:31, name:"权杖十",     en:"Ten of Wands",   suit:"wands", keyword:"负担 · 责任 · 压力 · 完成", keywordR:"卸下重担 · 推卸责任" },
    { id:32, name:"权杖侍从",   en:"Page of Wands",  suit:"wands", keyword:"热情 · 新消息 · 探索 · 勇气", keywordR:"犹豫 · 坏消息 · 缺乏动力" },
    { id:33, name:"权杖骑士",   en:"Knight of Wands",suit:"wands", keyword:"冒险 · 热情 · 冲动 · 追逐", keywordR:"急躁 · 轻率 · 半途而废" },
    { id:34, name:"权杖皇后",   en:"Queen of Wands", suit:"wands", keyword:"自信 · 热情 · 魅力 · 领导力", keywordR:"自我中心 · 嫉妒 · 控制欲" },
    { id:35, name:"权杖国王",   en:"King of Wands",  suit:"wands", keyword:"领导 · 远见 · 企业家精神", keywordR:"专制 · 冲动 · 傲慢" },

    { id:36, name:"圣杯王牌",   en:"Ace of Cups",    suit:"cups", keyword:"新感情 · 直觉 · 爱 · 创造力", keywordR:"情感空虚 · 封闭 · 错过" },
    { id:37, name:"圣杯二",     en:"Two of Cups",    suit:"cups", keyword:"结合 · 合作 · 吸引力 · 和谐", keywordR:"分离 · 不平衡 · 误解" },
    { id:38, name:"圣杯三",     en:"Three of Cups",  suit:"cups", keyword:"友谊 · 庆祝 · 团体 · 欢乐", keywordR:"过度 · 孤立 · 散伙" },
    { id:39, name:"圣杯四",     en:"Four of Cups",   suit:"cups", keyword:"沉思 · 冷淡 · 不满 · 沉思", keywordR:"新动力 · 觉醒 · 抓住机会" },
    { id:40, name:"圣杯五",     en:"Five of Cups",   suit:"cups", keyword:"悲伤 · 失落 · 遗憾 · 关注缺失", keywordR:"释怀 · 向前看 · 接纳" },
    { id:41, name:"圣杯六",     en:"Six of Cups",    suit:"cups", keyword:"怀旧 · 回忆 · 纯真 · 馈赠", keywordR:"活在过去 · 无法前进" },
    { id:42, name:"圣杯七",     en:"Seven of Cups",  suit:"cups", keyword:"幻想 · 选择 · 白日梦 · 诱惑", keywordR:"清晰 · 决断 · 不再迷惑" },
    { id:43, name:"圣杯八",     en:"Eight of Cups",  suit:"cups", keyword:"离开 · 寻找 · 舍弃 · 更高追寻", keywordR:"滞留 · 恐惧改变 · 不敢走" },
    { id:44, name:"圣杯九",     en:"Nine of Cups",   suit:"cups", keyword:"满足 · 愿望成真 · 舒适 · 享乐", keywordR:"不满足 · 贪婪 · 虚幻幸福" },
    { id:45, name:"圣杯十",     en:"Ten of Cups",    suit:"cups", keyword:"家庭幸福 · 和谐 · 情感圆满", keywordR:"家庭不和 · 破灭 · 情感破裂" },
    { id:46, name:"圣杯侍从",   en:"Page of Cups",   suit:"cups", keyword:"想象力 · 直觉 · 创意 · 情感", keywordR:"情绪化 · 不成熟 · 逃避现实" },
    { id:47, name:"圣杯骑士",   en:"Knight of Cups", suit:"cups", keyword:"浪漫 · 魅力 · 追求 · 梦想家", keywordR:"不切实际 · 情感欺骗 · 善变" },
    { id:48, name:"圣杯皇后",   en:"Queen of Cups",  suit:"cups", keyword:"同理心 · 温柔 · 直觉力 · 关怀", keywordR:"情绪依赖 · 过度敏感 · 压抑" },
    { id:49, name:"圣杯国王",   en:"King of Cups",   suit:"cups", keyword:"情感成熟 · 宽容 · 创造力 · 外交", keywordR:"情绪操控 · 冷漠 · 酗酒" },

    { id:50, name:"宝剑王牌",   en:"Ace of Swords",  suit:"swords", keyword:"新思想 · 清晰 · 真理 · 决断", keywordR:"混乱 · 误解 · 错误判断" },
    { id:51, name:"宝剑二",     en:"Two of Swords",  suit:"swords", keyword:"僵局 · 抉择 · 逃避 · 平衡", keywordR:"信息过剩 · 选择困难 · 拖延" },
    { id:52, name:"宝剑三",     en:"Three of Swords",suit:"swords", keyword:"心碎 · 悲伤 · 背叛 · 创伤", keywordR:"疗愈 · 释放 · 宽恕 · 恢复" },
    { id:53, name:"宝剑四",     en:"Four of Swords", suit:"swords", keyword:"休息 · 反思 · 恢复 · 冥想", keywordR:"焦躁 · 无法休息 · 重返战场" },
    { id:54, name:"宝剑五",     en:"Five of Swords", suit:"swords", keyword:"冲突 · 失败 · 空虚的胜利 · 羞辱", keywordR:"和解 · 放下 · 停止冲突" },
    { id:55, name:"宝剑六",     en:"Six of Swords",  suit:"swords", keyword:"过渡 · 疗愈 · 离开困境 · 前行", keywordR:"无法前进 · 重回困境 · 拒绝帮助" },
    { id:56, name:"宝剑七",     en:"Seven of Swords",suit:"swords", keyword:"策略 · 狡黠 · 逃避 · 独自行动", keywordR:"坦白 · 真相曝光 · 重新思考" },
    { id:57, name:"宝剑八",     en:"Eight of Swords",suit:"swords", keyword:"束缚 · 受限 · 恐惧 · 无力感", keywordR:"挣脱 · 自由 · 新视角 · 自信" },
    { id:58, name:"宝剑九",     en:"Nine of Swords", suit:"swords", keyword:"焦虑 · 噩梦 · 内疚 · 恐惧", keywordR:"释然 · 希望 · 噩梦醒来 · 复原" },
    { id:59, name:"宝剑十",     en:"Ten of Swords",  suit:"swords", keyword:"终结 · 崩溃 · 谷底 · 背叛", keywordR:"重生 · 复苏 · 转机 · 吸取教训" },
    { id:60, name:"宝剑侍从",   en:"Page of Swords", suit:"swords", keyword:"好奇 · 新思想 · 沟通 · 警觉", keywordR:"流言 · 不谨慎 · 口无遮拦" },
    { id:61, name:"宝剑骑士",   en:"Knight of Swords",suit:"swords", keyword:"果决 · 行动 · 冲锋 · 勇气", keywordR:"鲁莽 · 好斗 · 不计后果 · 横冲直撞" },
    { id:62, name:"宝剑皇后",   en:"Queen of Swords",suit:"swords", keyword:"理性 · 独立 · 敏锐 · 诚实", keywordR:"冷漠 · 苛刻 · 怨毒 · 孤独" },
    { id:63, name:"宝剑国王",   en:"King of Swords", suit:"swords", keyword:"理智 · 权威 · 纪律 · 公正", keywordR:"暴政 · 滥用权力 · 冷酷无情" },

    { id:64, name:"星币王牌",   en:"Ace of Pentacles", suit:"pentacles", keyword:"新机会 · 财富 · 实质 · 稳定", keywordR:"错失机会 · 财务问题 · 不稳定" },
    { id:65, name:"星币二",     en:"Two of Pentacles", suit:"pentacles", keyword:"平衡 · 弹性 · 适应 · 兼顾", keywordR:"失衡 · 超负荷 · 财务困境" },
    { id:66, name:"星币三",     en:"Three of Pentacles", suit:"pentacles", keyword:"合作 · 技艺 · 成长 · 计划", keywordR:"缺乏合作 · 低质量 · 不团结" },
    { id:67, name:"星币四",     en:"Four of Pentacles", suit:"pentacles", keyword:"持有 · 节俭 · 控制 · 安全感", keywordR:"吝啬 · 恐惧失去 · 贪婪" },
    { id:68, name:"星币五",     en:"Five of Pentacles", suit:"pentacles", keyword:"困苦 · 贫乏 · 孤立 · 迷失", keywordR:"复原 · 援助 · 找到出路" },
    { id:69, name:"星币六",     en:"Six of Pentacles", suit:"pentacles", keyword:"施与受 · 慷慨 · 恩赐 · 平等", keywordR:"施舍 · 被利用 · 不平等" },
    { id:70, name:"星币七",     en:"Seven of Pentacles", suit:"pentacles", keyword:"耐心 · 耕耘 · 评估 · 等待收成", keywordR:"焦虑 · 无果 · 投资失败" },
    { id:71, name:"星币八",     en:"Eight of Pentacles", suit:"pentacles", keyword:"精进 · 专注 · 技艺 · 勤奋", keywordR:"倦怠 · 缺乏动力 · 粗制滥造" },
    { id:72, name:"星币九",     en:"Nine of Pentacles", suit:"pentacles", keyword:"富足 · 独立 · 享受 · 自信", keywordR:"依赖 · 挥霍 · 不安全感" },
    { id:73, name:"星币十",     en:"Ten of Pentacles", suit:"pentacles", keyword:"财富 · 传承 · 家族 · 长远", keywordR:"家庭纷争 · 破财 · 遗产纠纷" },
    { id:74, name:"星币侍从",   en:"Page of Pentacles", suit:"pentacles", keyword:"学习 · 务实 · 新机会 · 进步", keywordR:"懒惰 · 浪费机会 · 缺乏目标" },
    { id:75, name:"星币骑士",   en:"Knight of Pentacles", suit:"pentacles", keyword:"勤奋 · 可靠 · 稳重 · 责任心", keywordR:"停滞 · 乏味 · 固执 · 懒惰" },
    { id:76, name:"星币皇后",   en:"Queen of Pentacles", suit:"pentacles", keyword:"滋养 · 务实 · 慷慨 · 安全感", keywordR:"依赖 · 恐惧匮乏 · 过度物质" },
    { id:77, name:"星币国王",   en:"King of Pentacles", suit:"pentacles", keyword:"富足 · 稳健 · 成功 · 经营", keywordR:"贪婪 · 腐败 · 物质至上 · 挥霍" },
  ];

  var SUIT_EMOJI = { major:'★', wands:'♣', cups:'♥', swords:'♠', pentacles:'♦' };

  /* ═══════════════════════════════════════════
     种子随机
     ═══════════════════════════════════════════ */
  function hashCode(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function mulberry32(seed) {
    return function() {
      seed |= 0;
      seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffleDeck(rng) {
    var deck = DECK.slice();
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }
    return deck;
  }

  function buildSeed(question, timestamp, salt, ipHash, entropyBits) {
    return hashCode(question) ^ hashCode(String(timestamp)) ^ hashCode(String(salt)) ^ hashCode(entropyBits) ^ (ipHash || 0);
  }

  /* ═══════════════════════════════════════════
     全局状态
     ═══════════════════════════════════════════ */
  var gState = {
    ipHash: null,
    shuffled: null,
    question: '',
    timestamp: 0,
    salt: 0,
    entropyStr: '',
    spreadCards: [],
    picked: [],
    pickOrder: [],
  };

  function getBrowserEntropy() {
    var n = navigator;
    return [n.language||'', n.platform||'', screen.colorDepth||'', screen.width||'', screen.height||'', new Date().getTimezoneOffset(), n.hardwareConcurrency||''].join('|');
  }

  // 获取 IP
  (function fetchIP() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://api.ipify.org?format=json', true);
    xhr.timeout = 3000;
    xhr.onload = function() {
      if (xhr.status === 200) {
        try { gState.ipHash = hashCode(JSON.parse(xhr.responseText).ip || ''); } catch(e) {}
      }
    };
    xhr.send();
  })();

  /* ═══════════════════════════════════════════
     核心交互
     ═══════════════════════════════════════════ */
  function showToast(msg) {
    var el = document.getElementById('tarotToast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function() { el.classList.remove('show'); }, 2000);
  }

  function startDraw() {
    var q = document.getElementById('qInput').value.trim();
    if (!q) {
      q = '我最近的运势如何？';
      document.getElementById('qInput').value = q;
    }

    gState.question = q;
    gState.timestamp = Date.now();
    gState.salt = Math.random();
    gState.entropyStr = getBrowserEntropy();
    gState.picked = [];
    gState.pickOrder = [];

    var seed = buildSeed(q, gState.timestamp, gState.salt, gState.ipHash, gState.entropyStr);
    var rng = mulberry32(seed);
    gState.shuffled = shuffleDeck(rng);

    gState.spreadCards = [];
    for (var i = 0; i < 9; i++) {
      gState.spreadCards.push({ card: gState.shuffled[i], reversed: rng() > 0.5 });
    }

    renderSpread();

    document.getElementById('spreadSection').style.display = 'block';
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('resultBox').value = '';
    document.getElementById('pickedCount').textContent = '0';

    var shortQ = q.length > 12 ? q.slice(0,12) + '…' : q;
    document.getElementById('seedInfo').textContent = '洗牌完成，请从下方选 3 张牌';
    document.getElementById('spreadSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function renderSpread() {
    var area = document.getElementById('spreadArea');
    area.innerHTML = '';

    gState.spreadCards.forEach(function(item, i) {
      var delay = i * 0.05;

      var slot = document.createElement('div');
      slot.className = 'tarot-slot';
      slot.style.animationDelay = delay + 's';
      slot.dataset.index = i;

      var card = document.createElement('div');
      card.className = 'tarot-card';
      card.innerHTML =
        '<div class="tarot-card-back"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 180" style="display:block;width:100%;height:100%;border-radius:6px;"><ellipse cx="20" cy="155" rx="80" ry="45" fill="#5a9e3c"/><ellipse cx="105" cy="168" rx="85" ry="52" fill="#3e7a22"/><ellipse cx="100" cy="162" rx="75" ry="42" fill="#4a8c2a"/><path d="M22 55 a10 10 0 0 1 10-9 a14 14 0 0 1 26-1 a11 11 0 0 1 18 5 a8 8 0 0 1 4 8 a7 7 0 0 1-3 9 l-52 0 a8 8 0 0 1-3-12z" fill="rgba(255,255,255,0.88)"/><path d="M68 48 a8 8 0 0 1 7-7 a11 11 0 0 1 20 0 a9 9 0 0 1 15 4 a7 7 0 0 1 3 7 a6 6 0 0 1-2 7 l-41 0 a6 6 0 0 1-2-11z" fill="rgba(255,255,255,0.78)"/></svg></div>' +
        '<div class="tarot-card-front ' + item.card.suit + (item.reversed ? ' rev' : '') + '"></div>';

      // 预渲染牌面
      var front = card.querySelector('.tarot-card-front');
      var revBadge = item.reversed ? '<span class="tarot-rev-badge">逆位</span>' : '';
      front.innerHTML =
        '<div class="tarot-suit-icon">' + SUIT_EMOJI[item.card.suit] + '</div>' +
        '<div class="tarot-card-name">' + item.card.name + '</div>' + revBadge;

      slot.appendChild(card);
      slot.addEventListener('click', (function(idx, s, c) { return function() { pickCard(idx, s, c); }; })(i, slot, card));
      area.appendChild(slot);
    });
  }

  function pickCard(index, slotEl, cardEl) {
    if (gState.picked.length >= 3) return;
    if (gState.picked.indexOf(index) >= 0) return;

    gState.picked.push(index);
    gState.pickOrder.push(index);
    slotEl.classList.add('selected', 'picked');
    cardEl.classList.add('flipped');
    document.getElementById('pickedCount').textContent = gState.picked.length;

    if (gState.picked.length === 3) {
      setTimeout(function() {
        var slots = document.querySelectorAll('.tarot-slot:not(.selected)');
        for (var i = 0; i < slots.length; i++) {
          slots[i].style.opacity = '0.4';
          slots[i].style.pointerEvents = 'none';
        }
        generateResult();
      }, 500);
    }
  }

  function generateResult() {
    var positions = ['过去', '现在', '未来'];
    var text = '【塔罗占卜结果】\n问题：' + gState.question + '\n—— 三牌阵（过去 · 现在 · 未来）——\n\n';

    gState.pickOrder.forEach(function(idx, i) {
      var item = gState.spreadCards[idx];
      var dir = item.reversed ? '逆位' : '正位';
      var kw = item.reversed ? item.card.keywordR : item.card.keyword;
      text += positions[i] + '：' + item.card.name + '（' + dir + '）\n关键词：' + kw + '\n\n';
    });

    text += '请帮我解读这三张牌的含义，结合过去、现在、未来的牌阵，分析整体运势和关联。';

    document.getElementById('resultBox').value = text;
    document.getElementById('resultSection').style.display = 'block';
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function copyResult() {
    var ta = document.getElementById('resultBox');
    var text = ta.value.trim();
    if (!text) { showToast('暂无结果可复制'); return; }
    navigator.clipboard.writeText(text).then(function() {
      showToast('已复制到剪贴板');
      var btn = document.getElementById('copyBtn');
      btn.classList.add('copied');
      setTimeout(function() { btn.classList.remove('copied'); }, 1500);
    }).catch(function() {
      ta.select();
      document.execCommand('copy');
      showToast('已复制到剪贴板');
    });
  }

  /* ═══════════════════════════════════════════
     事件绑定
     ═══════════════════════════════════════════ */
  document.getElementById('drawBtn').addEventListener('click', startDraw);
  document.getElementById('resetBtn').addEventListener('click', startDraw);
  document.getElementById('copyBtn').addEventListener('click', copyResult);
  document.getElementById('qInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') startDraw();
  });
})();
</script>

</div>
