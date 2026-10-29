import { computeAttribute } from './damage.js'

const DAMAGE_TYPE_MATCHERS = {
  physical: /物理/,
  arts: /法术/,
  true: /真实/,
  element: /元素/,
}

export function usableRelics(rules, topic) {
  const map = new Map()
  for (const rule of rules) {
    if (rule.conditional) continue
    if (topic && rule.topic !== topic) continue
    const key = rule.iconId ?? rule.relic
    if (!map.has(key)) {
      map.set(key, { key, name: rule.relic, iconId: rule.iconId, topic: rule.topic, attributes: new Set() })
    }
    map.get(key).attributes.add(rule.attribute)
  }
  return [...map.values()].map((item) => ({ ...item, attributes: [...item.attributes] }))
}

export function ruleTopics(rules) {
  return [...new Set(rules.map((rule) => rule.topic))]
}

export function normalizeTopicRules(rules) {
  return rules.map((rule) => ({
    relic: rule.relicName,
    iconId: rule.relicId,
    topic: rule.topicLabel,
    target: rule.target,
    attribute: rule.attribute,
    damageType: rule.damageType ?? null,
    kind: rule.kind,
    value: rule.value,
    conditional: false,
    difficulty: null,
    professionFilter: rule.professionFilter ?? null,
    stacked: Boolean(rule.stacked),
    raw: rule.raw,
  }))
}

export function resolveRules(rules, { topic, difficulty = 0, relicKeys = [] } = {}) {
  const selected = new Set(relicKeys)
  if (selected.size === 0) return []
  const groups = new Map()
  for (const rule of rules) {
    if (rule.conditional) continue
    if (topic && rule.topic !== topic) continue
    if (!selected.has(rule.iconId ?? rule.relic)) continue
    const key = `${rule.iconId ?? rule.relic}|${rule.attribute}|${rule.kind}|${rule.raw}`
    if (rule.difficulty === null || rule.difficulty === undefined) {
      if (!groups.has(key)) groups.set(key, rule)
      continue
    }
    if (rule.difficulty > difficulty) continue
    const current = groups.get(key)
    if (!current || (current.difficulty ?? 0) < rule.difficulty) groups.set(key, rule)
  }
  return [...groups.values()]
}

export function groupAllyMods(rules) {
  const map = {}
  for (const rule of rules) {
    if (rule.target !== 'ally') continue
    if (!map[rule.attribute]) map[rule.attribute] = []
    map[rule.attribute].push({ kind: rule.kind, value: rule.value, source: rule.relic })
  }
  return map
}

export function computedAllyAttributes(baseAttributes, rules) {
  const grouped = groupAllyMods(rules)
  const result = {}
  const steps = []
  for (const [attribute, baseValue] of Object.entries(baseAttributes)) {
    const mods = grouped[attribute] ?? []
    const computed = computeAttribute(baseValue, mods)
    result[attribute] = computed.value
    if (mods.length > 0) {
      steps.push({
        attribute,
        base: baseValue,
        value: computed.value,
        sources: mods.map((mod) => `${mod.source} ${formatMod(mod)}`),
        detail: computed.steps,
      })
    }
  }
  return { attributes: result, steps }
}

export function applyEnemyRules(enemy, rules) {
  const stats = {
    def: enemy.def ?? 0,
    res: enemy.res ?? 0,
    maxHp: enemy.maxHp ?? 0,
  }
  const steps = []
  const attributeMap = { def: 'def', magicResistance: 'res', maxHp: 'maxHp' }

  for (const key of Object.keys(stats)) {
    const mods = rules
      .filter((rule) => rule.target === 'enemy' && attributeMap[rule.attribute] === key)
      .map((rule) => ({ kind: rule.kind, value: rule.value, source: rule.relic }))
    if (mods.length === 0) continue
    const before = stats[key]
    const computed = computeAttribute(before, mods)
    stats[key] = computed.value
    steps.push({
      attribute: key,
      base: before,
      value: computed.value,
      sources: mods.map((mod) => `${mod.source} ${formatMod(mod)}`),
      detail: computed.steps,
    })
  }

  return { stats, steps }
}

export function damageTakenMultiplier(rules, damageType) {
  const matcher = DAMAGE_TYPE_MATCHERS[damageType]
  const matched = rules.filter(
    (rule) =>
      rule.target === 'enemy' &&
      rule.attribute === 'damageTaken' &&
      (!rule.damageType || !matcher || rule.damageType === damageType),
  )
  let factor = 1
  const sources = []
  for (const rule of matched) {
    const delta = rule.value < 0 ? rule.value + 1 : rule.value + 1
    factor *= delta
    sources.push({ name: rule.relic, value: rule.value })
  }
  return { factor, sources, count: matched.length }
}

export function evaluateDamage({ attack, multiplier, enemy, allyRules, damageType }) {
  const baseAttributes = { atk: attack }
  const allyResult = computedAllyAttributes(baseAttributes, allyRules)
  const finalAtk = allyResult.attributes.atk ?? attack

  const enemyResult = applyEnemyRules(enemy, allyRules)
  const stats = enemyResult.stats

  let rawDamage
  const steps = []
  if (damageType === 'physical') {
    const result = physicalDamageRaw(finalAtk, multiplier, stats.def)
    rawDamage = result.value
    steps.push(...result.steps)
  } else {
    const result = artsDamageRaw(finalAtk, multiplier, stats.res)
    rawDamage = result.value
    steps.push(...result.steps)
  }

  const taken = damageTakenMultiplier(allyRules, damageType)
  const finalDamage = rawDamage * taken.factor
  if (taken.count > 0) {
    steps.push({
      label: '伤害易伤',
      formula: `${round(rawDamage)} × ${round(taken.factor)}`,
      value: finalDamage,
    })
  }

  return {
    finalAtk,
    enemy: stats,
    rawDamage,
    finalDamage,
    taken,
    allySteps: allyResult.steps,
    enemySteps: enemyResult.steps,
    steps,
  }
}

function physicalDamageRaw(atk, multiplier, defense) {
  const raw = atk * multiplier
  const floor = raw * 0.05
  const value = Math.max(raw - defense, floor)
  return {
    value,
    steps: [
      { label: '攻击力 × 倍率', formula: `${round(atk)} × ${multiplier} = ${round(raw)}`, value: raw },
      { label: '减防御', formula: `max(${round(raw)} - ${round(defense)}, ${round(floor)})`, value },
    ],
  }
}

function artsDamageRaw(atk, multiplier, resistance) {
  const raw = atk * multiplier
  const floor = raw * 0.05
  const afterRes = raw * (1 - resistance)
  const value = Math.max(afterRes, floor)
  return {
    value,
    steps: [
      { label: '攻击力 × 倍率', formula: `${round(atk)} × ${multiplier} = ${round(raw)}`, value: raw },
      { label: '减法术抗性', formula: `max(${round(raw)} × (1 - ${round(resistance)}), ${round(floor)})`, value },
    ],
  }
}

const KIND_LABEL = {
  add: '直接加算',
  mul: '直接乘算',
  finalAdd: '最终加算',
  finalMul: '最终乘算',
  runeAdd: '符文加算',
  runeMul: '符文乘算',
  runeFinalMul: '符文最终乘算',
}

function formatMod(mod) {
  const label = KIND_LABEL[mod.kind] ?? mod.kind
  if (mod.kind === 'add' || mod.kind === 'finalAdd' || mod.kind === 'runeAdd') {
    return `${label} ${mod.value > 0 ? '+' : ''}${round(mod.value)}`
  }
  return `${label} ${round(mod.value * 100)}%`
}

function round(value) {
  return Math.round(value * 100) / 100
}