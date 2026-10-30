# 明日方舟集成战略伤害计算器

桌面端（Electron + Vue 3 + Vite）的明日方舟集成战略伤害计算工具。当前为 `v0.3` 预览版，已完成藏品算法数据管道、六星干员面板与单次伤害计算。

## 功能进度

- [x] PRTS 藏品全量抓取与解析（741 个藏品、1575 个主题段、1773 条效果行）
- [x] 藏品运算类型结构化（直接加算 / 直接乘算 / 最终加算 / 最终乘算 / 藏品符文三类）
- [x] 属性公式与伤害试算内核
- [x] 藏品浏览与检索界面
- [x] 六星干员数据裁剪（147 名六星、432 个技能、1794 个敌人图鉴）
- [x] 面板计算内核（精英化 / 等级线性插值 / 潜能 / 信赖）
- [x] 干员 × 技能 × 敌人减免的单次伤害计算界面
- [x] 藏品规则库：excel 原生 buff 1036 条（属性加成、敌方易伤、减防）
- [x] 藏品规则库：PRTS 文本推断 589 条（含 208 条无条件属性规则）
- [ ] 天赋数值化
- [ ] 完整明细树与 exe 打包

## 开发

```bash
npm install
npm run dev          # 浏览器预览
npm run electron:dev # Electron 窗口（需先 npm run dev）
npm run build        # 构建前端
npm run dist         # 打包 Windows 安装包
npm run selftest     # 回归基准 + 数据完整性自测
```

## 数据管道

```bash
npm run fetch:prts   # 从 PRTS 抓取 分类:收藏品 全部页面
npm run parse:prts   # 解析为 data/relics.json
npm run build:gamedata # 裁剪六星干员 / 技能 / 敌人图鉴到 src/data
npm run build:rules     # PRTS 文本 → 藏品规则（补充）
npm run build:topic-rules # excel roguelike_topic_table → 藏品原生规则（主）
npm run build:relics    # 藏品库过滤为仅输出相关
npm run check:sources   # 与 Kengxxiao 数据源交叉验证
```

数据来源：PRTS（https://prts.wiki/），授权协议 CC BY-NC-SA 4.0，仅用于非商业用途。藏品数值的权威来源为游戏 excel 表，PRTS 提供运算语义与公式定义。

## 计算内核

按 PRTS「游戏数据基础」定义实现：

```text
A_f = F_t[(A + D_p)(1 + D_t) + F_p]
A_+ = (A + C_p) * C_t * C_s
```

- `D_p` 直接加算，`D_t` 直接乘算（同类相加），`F_p` 最终加算，`F_t` 最终乘算（相乘）
- `C_p` 藏品符文加算，`C_t = 1 + Σct`（倍率叠加），`C_s` 藏品符文最终乘算

物理伤害 `max(攻击力 × 倍率 - 防御, 攻击力 × 倍率 × 5%)`，法术伤害按法抗同理计算。