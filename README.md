# MYTHOS · 神话人格研究所

面向小红书的娱乐测试 H5：纯前端、零依赖、零后端，一个文件夹即可部署。
内置三款测试 + 每日抽签（对应不同内容定位）：

| 模块 | 定位 | 内容 |
|---|---|---|
| 测测你是奥林匹斯十二主神中的谁 | 流量款（认知度最高） | 12 神格 · 爱琴海蓝+鎏金 |
| 测测你的命运北欧符文 | 玄学款（可接咨询变现） | 8 符文 · 极夜黑+冰银 |
| 测测你是哪一幅传世名画 | 审美款（晒图率优先） | 8 名画 · 美术馆酒红+暖金 |
| 今日符文 · 每日一抽 | 回访钩子 | 按日期全网同款 · 连签记录 |

功能：8 题答题流（方向滑动过渡、选中脉冲、音效振动）→ 命运编织过场 →
结果页（符印描画动画 / 契合度 / 稀有度 / 四维条 / 稀有人格专属音效）→
Canvas 生成 3:4 分享卡 → 人格图鉴收集 → 测试间互导 → 每日符文（连签）。

**版权红线**：所有人格原型（希腊神话、北欧符文、世界名画）均为公版内容，可安全商用。
不要添加任何动漫、影视剧的专有角色名。

---

## 一、本地预览

```bash
python -m http.server 8642     # 或 npx serve .
```

打开 http://127.0.0.1:8642 （手机模式查看最佳）。直接双击 index.html 也能运行。

## 二、部署（三选一，可同时存在）

| 平台 | 国内可达性 | 操作 |
|---|---|---|
| **EdgeOne Pages（腾讯）** | ★★★ 直连 | 控制台拖拽整个文件夹即可 |
| **Vercel** | ★ 默认域名需代理 | `vercel deploy --prod` 或网页拖拽；绑定自定义域名可改善 |
| **GitHub Pages** | ★★ 基本直连 | 见下方 |

**GitHub Pages 步骤**：

```bash
git init -b main && git add -A && git commit -m "MYTHOS 上线"
gh repo create mythos --public --source=. --push
gh api -X POST repos/{owner}/mythos/pages -f "source[branch]=main" -f "source[path]=/"
# 片刻后访问 https://<用户名>.github.io/mythos/
```

注意：所有资源引用都是相对路径，放在仓库子路径下无需任何修改。

## 三、上线前必改清单

- [ ] `index.html` 底部取消注释 `window.MYTHOS_HANDLE`，改成你的小红书账号名
  （显示在所有分享卡底部，是唯一引流入口）
- [ ] 取消注释 `window.MYTHOS_QR_URL` 并填你的分发链接（分享卡右下二维码指向它，
  不填则自动用当前部署地址）
- [ ] （可选）放入 AI 主视觉图，见「五、AI 主视觉接入」
- [ ] （可选）打开统计，见「九、数据统计」
- [ ] `node tools/verify.mjs` 跑一遍，确认全部通过

## 四、如何新增一款测试（10 分钟）

新建 `js/quiz-xxx.js`，照抄以下骨架（完整字段参考 `js/quiz-olympus.js`）：

```js
window.MYTHOS_QUIZZES = window.MYTHOS_QUIZZES || [];
window.MYTHOS_QUIZZES.push({
  id: 'xxx', theme: 'olympus',            // theme 复用现有三套配色之一
  title: '……', short: '……', badge: '……',
  tagline: '……', intro: '……', meta: '8 道题 · N 人格 · 约 2 分钟',
  dims: [{ key: 'pow', label: '权柄' }, /* 4 个维度 */],
  shareTemplate: '……{name}……{epithet}……{rarity}……',
  questions: [ { q: '……', options: [ { t: '选项', d: 'pow', p: { personaA: 2, personaB: 1 } } ] } ],
  personas: [ { id, name, en, epithet, rarity, tags, desc, glint, quote, sigil, art } ]
});
```

然后在 `index.html` 加一行 `<script src="js/quiz-xxx.js"></script>`，首页自动出现新卡片。

**计分规则**：每个选项 = 主推人格 +2、两个相关人格 +1。写完必须跑
`node tools/verify.mjs`（10 万次随机作答，检查"有没有人格永远抽不到"和分布集中度），
不达标就给冷门人格多加几处 +1。

**符印 sigil**：100×100 视窗 SVG path；`pathLength="1"` 已内置，描画动画自动生效。

## 五、AI 主视觉接入（图在即用）

每个 persona 支持 `art` 字段（可选）。**不放图时自动回退符印线稿，功能不受影响。**

**约定**：图片放 `images/<quiz>/<personaId>.png`（建议 512×512 以上、方图），然后在
对应 quiz 文件的 persona 里加一行：`art: 'images/olympus/zeus.png',`
结果页圆框和分享卡会自动用图（圆裁剪、加载失败自动回退符印）。

**生成提示词模板**（即梦 / Midjourney 通用，替换 【】 部分）：

- 奥林匹斯（油画风）：`古典油画肖像，【人格视觉关键词】，希腊神话【神名】，深蓝底色，
  鎏金装饰，明暗对照法，庄重神秘，正方形构图，高质量细节`
- 北欧符文（暗黑插画风）：`北欧神话暗黑插画，【人格视觉关键词】，极夜深蓝背景，
  冰晶与月光质感，冷银色调，神秘符文氛围，正方形构图`
- 名画（原作复刻风）：`世界名画风格插画，致敬【画家】笔触，【画面关键词】，
  博物馆质感，古典构图，正方形`

**人格视觉关键词速查**：

| quiz | persona | 关键词 |
|---|---|---|
| olympus | zeus | 白须王者持雷霆，金冠 |
| olympus | hera | 白孔雀与王冠的冷艳王后 |
| olympus | poseidon | 怒海中的三叉戟持君 |
| olympus | demeter | 麦穗与丰收篮的温柔女神 |
| olympus | apollo | 金色竖琴与阳光的青年 |
| olympus | artemis | 月下持弓猎手与鹿 |
| olympus | athena | 持矛猫头鹰铠甲女神 |
| olympus | ares | 血色披风战神持剑 |
| olympus | aphrodite | 浪花中诞生的美神 |
| olympus | hephaestus | 火焰锻炉前的铁匠 |
| olympus | hermes | 带翼凉鞋持双蛇杖信使 |
| olympus | dionysus | 葡萄藤与酒杯的狂欢少年 |
| runes | fehu/uruz/ansuz/kenaz/wunjo/hagalaz/isa/sowilo | 以对应符文发光浮雕为画面中心 + 丰饶金币/野牛/风语者/火炬/暖光/冰雹风暴/冰原/烈日 意象 |
| paintings | 全部 | 直接用公版原作图片即可（公有领域），无需生成 |

## 六、每日符文模式说明

- 结果由**日期字符串哈希**决定：同一天全网所有用户抽到同一枚符文——天然的小红书
  每日话题（"今天的符文是温乔"），可在笔记里做每日打卡互动。
- 连签记录存 localStorage（`mythos_daily_v1`），断一天自动清零——制造回访动机。
- 专属分享卡：`MYTHOS_CARD.drawDaily(rune, dateLabel, streak)`。

## 七、小红书运营 SOP（第一个月）

**账号**：开专业号（免费）→ 账号名与 H5 品牌一致。链接投放只用合规通道：
私信自动回复（评论"1"自动发）、群聊置顶、主页简介。
**不要在笔记正文/图片里贴外链，不要引导加微信。**

**首发（第 1–2 周）**：只推主神款，同一测试发 3–5 篇，封面标题 A/B：
- 「测测你是奥林匹斯十二主神中的谁」
- 「我在神话里是雅典娜，全网只有 2%｜你呢」
- 「8 道题测出你的神格，评论区对答案」

笔记图片直接用结果卡（3:4 原生适配）。

**评论区**：置顶「扣 1 拿测试链接」；小号带节奏晒结果；每个晒结果的评论都回一句
人格相关的话（涨互动权重）。

**第 3 周起**：加入「今日符文」每日打卡笔记（成本最低的日更内容）。

**数据判断（第 3–4 周定去留）**：单篇小眼睛 > 500 且有人求链接 → 加码做矩阵；
数据平平 → 换封面标题再测 2 轮，仍不行换选题（中世纪贵族、塔罗、哥特）。

**变现节奏**:影之人格走「面包多自动收款」——买家付款后拿订单号回 H5 核验解锁(见下),零人工;前 4 周主推免费款攒流量 → 数据稳了加码影之人格笔记 → 再考虑符文/塔罗咨询导流(走小红书群聊/私信通承接)。

### 影之人格 · 面包多收款配置(一次性)

1. 面包多(需实名)创建商品「影之人格解锁码」¥6.6 → 把商品页地址填进 `index.html` 的 `MYTHOS_SHOP_URL`
2. 面包多商品「自动发货内容」写:`支付成功!请复制你的订单号(在支付完成页或"我的订单"),回到测试页粘贴即可立即解锁`
3. 后台开放平台拿 `developer_key`,和商品 urlkey 一起配到 whoyouare 项目的 Vercel 环境变量:
   `MBD_DEVELOPER_KEY`、`MBD_PRODUCT_KEY`(多个商品用逗号分隔)
4. 原理:MYTHOS 纯前端,订单核验借用 whoyouare 的 Vercel Edge + KV(`MYTHOS_MBD_API`):
   `order-detail` 验真伪 → 一单一设备(KV 记账,防一号多机)→ 放行本地解锁
5. `MYTHOS_UNLOCK_CODE` 保留为人工兜底通道(网络故障/特殊客服场景),改掉默认值再用!

## 八、技术说明

```
index.html          入口（上线前改 MYTHOS_HANDLE）
css/style.css       三套主题色 + 全部样式 + 动效
js/scoring.js       计分引擎（浏览器/Node 双端）
js/quiz-*.js        测试内容配置（改内容只动这里）
js/juice.js         音效/振动/主题粒子
js/sharecard.js     Canvas 分享卡（结果卡 + 今日符文卡）
js/engine.js        视图引擎（事件委托，含每日抽签）
tools/verify.mjs    分布验证：node tools/verify.mjs
images/             AI 主视觉目录（可选，见第五节）
```

无构建、无依赖、无数据上报；用户数据只存本地 localStorage。

## 九、数据统计（漏斗埋点）

产品内置漏斗事件（`js/track.js`）：`visit → quiz-start → quiz-complete →
share-card / share-copy`，以及 `daily-open / daily-share / daily-copy`、
`gallery-open / retest`。未配置后端时事件只镜像在访客本地 localStorage，零上报。

**方案 A · Vercel Web Analytics（推荐，零代码）**：
打开 Vercel 控制台 → 项目 mythos → Analytics 标签 → Enable。
在 `*.vercel.app` 域名上会自动生效，事件在 vercel.com/analytics 查看。

**方案 B · GoatCounter（免费、轻量、不依赖 Vercel）**：
goatcounter.com 注册 → `index.html` 里取消注释并填站点：
```html
<script>window.MYTHOS_STATS = { goatcounter: 'https://你的站点.goatcounter.com' };</script>
```

**看漏斗的方法**：`visit` 到 `quiz-start` 的损耗 = 封面文案问题；
`quiz-start` 到 `quiz-complete` 的损耗 = 题目太长/太难；
`quiz-complete` 到 `share-card` 的比例 = 分享率（晒图意愿）。
每日符文的 `daily-open` 复访曲线 = 回访钩子是否生效。
