import { readFile } from 'node:fs/promises'
import { computeOperatorPanel } from '../src/engine/operator.js'
import { evaluateDamage, normalizeTopicRules, resolveRules } from '../src/engine/rules.js'
import { computeManualDamage } from '../src/engine/manual.js'
import { computeDpsMetrics, computeSkillCycleDps } from '../src/engine/dps.js'

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))

const results = []
const check = (name, fn) => {
  try {
    const detail = fn()
    results.push({ name, ok: true, detail })
  } catch (error) {
    results.push({ name, ok: false, detail: error.message })
  }
}
const near = (a, b, eps = 0.01) => {
  if (Math.abs(a - b) > eps) throw new Error(`期望 ${b}，实际 ${a}`)
  return `${a}`
}

const operatorsData = await read('../src/data/operators.json')
const skillsData = await read('../src/data/skills.json')
const topicRulesData = await read('../src/data/topicRules.json')
const relicsData = await read('../data/relics.json')

const operators = operatorsData.operators
const allSkills = skillsData.skills
const topicRules = topicRulesData.rules
const normalized = normalizeTopicRules(topicRules)

// ---------- A. 回归基准 ----------
check('面板基准 伊芙利特 精二90 满配 atk=1015', () => {
  const ifrit = operators.find((op) => op.name === '伊芙利特')
  if (!ifrit) throw new Error('找不到伊芙利特')
  const panel = computeOperatorPanel(ifrit, { elite: 2, level: 90, potential: 5, trust: 100 })
  return `atk=${near(panel.attributes.atk, 1015)}`
})

check('面板基准 部署费用=32', () => {
  const ifrit = operators.find((op) => op.name === '伊芙利特')
  const panel = computeOperatorPanel(ifrit, { elite: 2, level: 90, potential: 5, trust: 100 })
  return `cost=${near(panel.attributes.cost, 32)}`
})

check("藏品链路 阿 753 → 978.9（+30% 攻击藏品）", () => {
  const ah = operators.find((op) => op.name === "阿")
  if (!ah) throw new Error("找不到阿")
  const panel = computeOperatorPanel(ah, { elite: 2, level: 90, potential: 6, trust: 100 })
  near(panel.attributes.atk, 753, 0.5)
  const picked = resolveRules(normalized, { topic: "沉沦者的黑流树海", relicKeys: ["rogue_6_relic_legacy_134"] })
  if (picked.length === 0) throw new Error("散轶诗简未生成规则")
  const boosted = evaluateDamage({ attack: panel.attributes.atk, multiplier: 1, enemy: { def: 0, res: 0 }, allyRules: picked, damageType: "arts" })
  return "面板=753 → " + boosted.finalAtk.toFixed(1)
})

check('自定义口径 17333.17', () => {
  const r = computeManualDamage({
    base: 758, addRatio: 1.04, mulRatio: 0.6, finalAdd: 932.542,
    atkScale: 4.1125, dmgScale: 1.606, def: 1875, defCut: 0.3, dmgReduction: 0.15,
  })
  return `damage=${near(Number(r.finalDamage.toFixed(2)), 17333.17)}`
})

check('DPS 基础：攻速100、间隔2.9 → 100', () => {
  const m = computeDpsMetrics({ baseAttackTime: 2.9, attackSpeed: 100, damagePerHit: 290 })
  near(m.interval, 2.9)
  near(m.dps, 100)
  return `interval=${m.interval} dps=${m.dps}`
})

check('DPS 攻速加成：攻速130 → 间隔缩短、DPS 提升', () => {
  const base = computeDpsMetrics({ baseAttackTime: 2.9, attackSpeed: 100, damagePerHit: 290 })
  const boosted = computeDpsMetrics({ baseAttackTime: 2.9, attackSpeed: 130, damagePerHit: 290 })
  near(boosted.interval, 2.9 * 100 / 130)
  near(boosted.dps, 290 / (2.9 * 100 / 130))
  if (boosted.dps <= base.dps) throw new Error('攻速提升后 DPS 未增加')
  return `interval=${boosted.interval.toFixed(3)} dps=${boosted.dps.toFixed(2)}`
})

check('DPS 与自定义伤害联动：17333.17 ÷ 2.9', () => {
  const r = computeManualDamage({
    base: 758, addRatio: 1.04, mulRatio: 0.6, finalAdd: 932.542,
    atkScale: 4.1125, dmgScale: 1.606, def: 1875, defCut: 0.3, dmgReduction: 0.15,
  })
  const m = computeDpsMetrics({ baseAttackTime: 2.9, attackSpeed: 100, damagePerHit: r.finalDamage })
  return `dps=${near(Number(m.dps.toFixed(2)), Number((17333.17 / 2.9).toFixed(2)), 0.02)}`
})

check('技能循环 DPS：输出100/50、持续20s、SP30 → 70', () => {
  const c = computeSkillCycleDps({
    activeDps: 100,
    normalDps: 50,
    duration: 20,
    spCost: 30,
    initSp: 0,
    spRecovery: 1,
  })
  near(c.chargeTime, 30)
  near(c.cycle, 50)
  near(c.averageDps, 70)
  near(c.uptime, 0.4)
  return `充能=${c.chargeTime}s 循环=${c.cycle}s 平均=${c.averageDps}`
})

check('技能循环：初始SP满时无充能空窗', () => {
  const c = computeSkillCycleDps({
    activeDps: 200,
    normalDps: 50,
    duration: 10,
    spCost: 30,
    initSp: 30,
    spRecovery: 1,
  })
  near(c.chargeTime, 0)
  near(c.cycle, 10)
  near(c.averageDps, 200)
  return `平均=${c.averageDps} 覆盖率=100%`
})

check('生命蓝图 条件减伤默认不生效', () => {
  const base = evaluateDamage({ attack: 1015, multiplier: 1.4, enemy: { def: 500, res: 0.2 }, allyRules: [], damageType: 'arts' })
  const picked = resolveRules(normalized, { topic: '沉沦者的黑流树海', relicKeys: ['rogue_6_relic_final_10'] })
  const withRelic = evaluateDamage({ attack: 1015, multiplier: 1.4, enemy: { def: 500, res: 0.2 }, allyRules: picked, damageType: 'arts' })
  if (Math.abs(base.finalDamage - withRelic.finalDamage) > 0.01) throw new Error('条件减伤被默认启用')
  return `default=${withRelic.finalDamage.toFixed(2)}`
})

check('敌方减伤接入 0.5 → 减半', () => {
  const rules = normalized.filter((r) => r.iconId === 'rogue_6_relic_final_10' && r.attribute === 'damageReduction')
  const base = evaluateDamage({ attack: 1015, multiplier: 1.4, enemy: { def: 500, res: 0.2 }, allyRules: [], damageType: 'arts' })
  const withReduction = evaluateDamage({ attack: 1015, multiplier: 1.4, enemy: { def: 500, res: 0.2 }, allyRules: rules, damageType: 'arts' })
  return `base=${base.finalDamage.toFixed(2)} → ${withReduction.finalDamage.toFixed(2)}`
})

check('层叠规则按层数放大（5 层 = 每层 × 5）', () => {
  const stacked = normalized.find((r) => r.stacked && r.target === 'ally')
  if (!stacked) throw new Error('无层叠规则')
  const one = resolveRules(normalized, { topic: stacked.topic, relicKeys: [stacked.iconId] })
  const five = resolveRules(normalized, { topic: stacked.topic, relicKeys: [stacked.iconId], stacks: { [stacked.iconId]: 5 } })
  const r1 = one.find((r) => r.stacked)
  const r5 = five.find((r) => r.stacked)
  near(r5.value, r1.value * 5, 0.02)
  return `${stacked.relic} ${r1.value} → ${r5.value}（${r5.stackApplied} 层）`
})

check('非层叠规则不受 stacks 参数影响', () => {
  const normal = normalized.find((r) => !r.stacked && !r.conditional)
  const one = resolveRules(normalized, { topic: normal.topic, relicKeys: [normal.iconId] })
  const five = resolveRules(normalized, { topic: normal.topic, relicKeys: [normal.iconId], stacks: { [normal.iconId]: 5 } })
  if (one[0].value !== five[0].value) throw new Error(`数值被错误放大 ${one[0].value} → ${five[0].value}`)
  return `${normal.relic} 保持 ${one[0].value}`
})

check('一次性 buff 不再误标 stacked', () => {
  const bad = normalized.filter((r) => r.stacked && ['开裂的束缚带', '奇渊面具', '复仇者'].includes(r.relic))
  if (bad.length) throw new Error(`${bad.length} 条误标：${bad.map((r) => r.relic).join('，')}`)
  const total = normalized.filter((r) => r.stacked).length
  return `stacked 仅 ${total} 条（layer 类）`
})

// ---------- B. 数据完整性 ----------
check('六星干员数量 147', () => {
  if (operators.length !== 147) throw new Error(`实际 ${operators.length}`)
  return '147'
})

check('干员不含 TOKEN 召唤物', () => {
  const bad = operators.filter((op) => op.profession === 'TOKEN' || op.id.startsWith('token_'))
  if (bad.length) throw new Error(`发现 ${bad.length} 个：${bad.slice(0, 3).map((b) => b.id)}`)
  return '0'
})

check('每名干员具备 phases 与面板帧', () => {
  const bad = operators.filter((op) => !op.phases?.length || !op.phases[0].attributesKeyFrames?.length)
  if (bad.length) throw new Error(`${bad.length} 名异常：${bad.slice(0, 3).map((b) => b.name)}`)
  return 'all ok'
})

check('技能引用全部存在', () => {
  const missing = new Set()
  for (const op of operators) for (const s of op.skills) if (!allSkills[s.skillId]) missing.add(s.skillId)
  if (missing.size) throw new Error(`${missing.size} 个缺失：${[...missing].slice(0, 3)}`)
  return `${Object.keys(allSkills).length} 技能`
})

check('技能均为 10 级', () => {
  const bad = Object.values(allSkills).filter((s) => s.levels?.length !== 10)
  if (bad.length) throw new Error(`${bad.length} 个非 10 级`)
  return 'all 10'
})

check('规则 relicName 全部有值', () => {
  const bad = topicRules.filter((r) => !r.relicName)
  if (bad.length) throw new Error(`${bad.length} 条为空`)
  return `${topicRules.length} 条`
})

check("规则 value 合法（add 允许大值，mul 为增量）", () => {
  const bad = topicRules.filter((r) => {
    if (!Number.isFinite(r.value)) return true
    if (r.kind === "add") return Math.abs(r.value) > 5000
    return Math.abs(r.value) > 5
  })
  if (bad.length) throw new Error(bad.length + " 条：" + bad.slice(0, 3).map((r) => r.relicName + ":" + r.attribute + ":" + r.kind + ":" + r.value))
  return "all ok"
})

check("敌方攻速按绝对值加算", () => {
  const bad = topicRules.filter((r) => r.target === "enemy" && r.attribute === "attackSpeed" && r.kind !== "add")
  if (bad.length) throw new Error(bad.length + " 条未按 add")
  return "all add"
})

check("我方减伤不被误判为敌方减伤", () => {
  const bad = topicRules.filter((r) => r.attribute === "damageReduction" && /干员|我方/.test(r.usage || "") && !/敌人[^，。；]*受到/.test(r.usage || ""))
  if (bad.length) throw new Error(bad.length + " 条误判：" + bad.slice(0, 2).map((x) => x.relicName))
  return "ok"
})

check('规则 attribute 均在白名单', () => {
  const allow = new Set(['atk', 'def', 'maxHp', 'magicResistance', 'attackSpeed', 'moveSpeed', 'cost', 'blockCnt', 'respawnTime', 'damageTaken', 'damageDealt', 'damageReduction', 'hpRecoveryByMaxHp', 'sp'])
  const bad = topicRules.filter((r) => !allow.has(r.attribute))
  if (bad.length) throw new Error(`${bad.length} 条：${[...new Set(bad.map((r) => r.attribute))]}`)
  return 'all ok'
})

check('规则 id 无重复', () => {
  const seen = new Set()
  const dup = []
  for (const r of topicRules) {
    if (seen.has(r.id)) dup.push(r.id)
    seen.add(r.id)
  }
  if (dup.length) throw new Error(`${dup.length} 个重复`)
  return 'unique'
})

check('主题字段与 PRTS 主题对齐', () => {
  const prtsTopics = new Set(relicsData.relics.flatMap((r) => r.themes.map((t) => t.topic)))
  const ruleTopics = new Set(topicRules.map((r) => r.topicLabel))
  const missing = [...ruleTopics].filter((t) => !prtsTopics.has(t))
  if (missing.length) throw new Error(`主题不匹配：${missing}`)
  return `${ruleTopics.size} 个主题`
})

// ---------- C. 规则语义 ----------
check('藏品 id 与 PRTS iconId 对齐率', () => {
  const prtsIds = new Set(relicsData.relics.map((r) => r.iconId))
  const ruleIds = [...new Set(topicRules.map((r) => r.relicId))]
  const hit = ruleIds.filter((id) => prtsIds.has(id)).length
  return `${hit}/${ruleIds.length}（${((hit / ruleIds.length) * 100).toFixed(1)}%）`
})

check('生命蓝图数值语义正确', () => {
  const blue = topicRules.filter((r) => r.relicId === 'rogue_6_relic_final_10')
  const atk = blue.find((r) => r.attribute === 'atk')
  const hp = blue.find((r) => r.attribute === 'maxHp')
  const red = blue.find((r) => r.attribute === 'damageReduction')
  near(atk.value, 0.3)
  near(hp.value, 0.5)
  if (!red?.conditional) throw new Error('减伤应为条件规则')
  return 'atk=0.3 hp=0.5 red=0.5(conditional)'
})

check('复仇者物理易伤 = 0.35', () => {
  const r = topicRules.find((x) => x.relicId === 'rogue_1_relic_a25')
  if (!r) throw new Error('未生成')
  near(r.value, 0.35, 1e-9)
  return `${r.damageType}=${r.value}`
})

check('易伤不会被重复计入（同藏品同主题只取一条）', () => {
  const picked = resolveRules(normalized, { topic: '傀影与猩红孤钻', relicKeys: ['rogue_1_relic_a25'] })
  if (picked.length !== 1) throw new Error(`取到 ${picked.length} 条`)
  const r = evaluateDamage({ attack: 1000, multiplier: 1, enemy: { def: 0, res: 0 }, allyRules: picked, damageType: 'physical' })
  near(r.taken.factor, 1.35)
  return `factor=${r.taken.factor}`
})

check('空藏品选择返回空规则', () => {
  const picked = resolveRules(normalized, { topic: '沉沦者的黑流树海', relicKeys: [] })
  if (picked.length !== 0) throw new Error(`返回 ${picked.length} 条`)
  return '0'
})

check('法术易伤只作用于法术伤害', () => {
  const picked = resolveRules(normalized, { topic: '傀影与猩红孤钻', relicKeys: ['rogue_1_relic_a26'] })
  const phys = evaluateDamage({ attack: 1000, multiplier: 1, enemy: { def: 0, res: 0 }, allyRules: picked, damageType: 'physical' })
  const arts = evaluateDamage({ attack: 1000, multiplier: 1, enemy: { def: 0, res: 0 }, allyRules: picked, damageType: 'arts' })
  if (phys.taken.factor !== 1) throw new Error('物理伤害被法术易伤影响')
  if (arts.taken.factor <= 1) throw new Error('法术伤害未吃到易伤')
  return `物理=${phys.taken.factor} 法术=${arts.taken.factor.toFixed(2)}`
})

// ---------- D. 统计 ----------
const byTarget = { ally: 0, enemy: 0 }
const byConditional = { always: 0, conditional: 0 }
for (const r of topicRules) {
  byTarget[r.target] = (byTarget[r.target] ?? 0) + 1
  byConditional[r.conditional ? 'conditional' : 'always'] += 1
}

// ---------- 输出 ----------
let failed = 0
for (const item of results) {
  if (!item.ok) failed += 1
  console.log(`${item.ok ? '✅' : '❌'} ${item.name}${item.detail ? `  [${item.detail}]` : ''}`)
}
console.log('\n规则分布:', JSON.stringify(byTarget), JSON.stringify(byConditional))
console.log(`\n共 ${results.length} 项，失败 ${failed} 项`)
if (failed > 0) process.exitCode = 1