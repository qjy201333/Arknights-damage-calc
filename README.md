# 明日方舟集成战略伤害计算器

桌面端（Electron + Vue 3 + Vite）的明日方舟集成战略伤害计算工具。当前为 `v0.2` 预览版，已完成藏品算法数据管道、六星干员面板与单次伤害计算。

## 功能进度

- [x] PRTS 藏品全量抓取与解析（741 个藏品、1575 个主题段、1773 条效果行）
- [x] 藏品运算类型结构化（直接加算 / 直接乘算 / 最终加算 / 最终乘算 / 藏品符文三类）
- [x] 属性公式与伤害试算内核
- [x] 藏品浏览与检索界面
- [x] 六星干员数据裁剪（147 名六星、432 个技能、1794 个敌人图鉴）
- [x] 面板计算内核（精英化 / 等级线性插值 / 潜能 / 信赖）
- [x] 干员 × 技能 × 敌人减免的单次伤害计算界面
- [ ] 天赋数值化与藏品规则库求值器
- [ ] 完整明细树与 exe 打包

## 开发

```bash
npm install
npm run dev          # 浏览器预览
npm run electron:dev # Electron 窗口（需先 npm run dev）
npm run build        # 构建前端
npm run dist         # 打包 Windows 安装包
```

## 数据管道

```bash
npm run fetch:prts   # 从 PRTS 抓取 分类:收藏品 全部页面
npm run parse:prts   # 解析为 data/relics.json
npm run build:gamedata # 裁剪六星干员 / 技能 / 敌人图鉴到 src/data
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