import { computeAttribute } from './damage.js'

const PHASE_INDEX = { PHASE_0: 0, PHASE_1: 1, PHASE_2: 2 }

export const ATTRIBUTE_KEY = {
  MAX_HP: 'maxHp',
  ATK: 'atk',
  DEF: 'def',
  MAGIC_RESISTANCE: 'magicResistance',
  COST: 'cost',
  BLOCK_CNT: 'blockCnt',
  ATTACK_SPEED: 'attackSpeed',
  BASE_ATTACK_TIME: 'baseAttackTime',
  RESPAWN_TIME: 'respawnTime',
  MOVE_SPEED: 'moveSpeed',
}

export const ATTR_LABEL = {
  maxHp: '生命值',
  atk: '攻击力',
  def: '防御力',
  magicResistance: '法术抗性',
  cost: '部署费用',
  blockCnt: '阻挡数',
  attackSpeed: '攻击速度',
  baseAttackTime: '攻击间隔',
  respawnTime: '再部署时间',
  moveSpeed: '移动速度',
}

export function getPhase(operator, elite) {
  return operator.phases[Math.min(Math.max(elite, 0), operator.phases.length - 1)]
}

export function getLevelCap(operator, elite) {
  const phase = getPhase(operator, elite)
  const frames = phase?.attributesKeyFrames ?? []
  return frames.length > 0 ? frames[frames.length - 1].level : 1
}

function interpolate(frames, level) {
  if (!frames.length) return {}
  if (frames.length === 1) return { ...frames[0].data }
  let lower = frames[0]
  let upper = frames[frames.length - 1]
  for (let i = 1; i < frames.length; i += 1) {
    if (frames[i].level >= level) {
      lower = frames[i - 1]
      upper = frames[i]
      break
    }
    lower = frames[i]
  }
  if (upper.level === lower.level) return { ...upper.data }
  const ratio = (level - lower.level) / (upper.level - lower.level)
  const data = {}
  for (const key of Object.keys(lower.data)) {
    const from = lower.data[key] ?? 0
    const to = upper.data[key] ?? 0
    data[key] = from + (to - from) * ratio
  }
  return data
}

export function getTrustBonus(operator, trust) {
  const frames = operator.favorKeyFrames ?? []
  if (!frames.length) return {}
  const frameLevel = Math.min(trust / 2, frames[frames.length - 1].level)
  return interpolate(frames, frameLevel)
}

export function getPotentialBonus(operator, potential) {
  const ranks = operator.potentialRanks ?? []
  const bonus = {}
  const details = []
  for (let i = 0; i < Math.min(potential, ranks.length); i += 1) {
    for (const modifier of ranks[i].modifiers ?? []) {
      const key = ATTRIBUTE_KEY[modifier.attributeType]
      if (!key) continue
      if (modifier.formulaItem !== 'ADDITION') continue
      bonus[key] = (bonus[key] ?? 0) + modifier.value
      details.push({ description: ranks[i].description, key, value: modifier.value })
    }
  }
  return { bonus, details }
}

export function getSkillLevel(skill, levelIndex) {
  const levels = skill?.levels ?? []
  if (!levels.length) return null
  const index = Math.min(Math.max(levelIndex, 0), levels.length - 1)
  return levels[index]
}

export function extractSkillMultiplier(blackboard) {
  const find = (key) => blackboard?.find((entry) => entry.key === key)?.value
  const atkScale = find('atk_scale')
  if (typeof atkScale === 'number') return { key: 'atk_scale', value: atkScale }
  const damageScale = find('damage_scale')
  if (typeof damageScale === 'number') return { key: 'damage_scale', value: damageScale }
  return { key: null, value: 1 }
}

export function computeOperatorPanel(operator, options = {}) {
  const { elite = 2, level = 90, potential = 0, trust = 0 } = options
  const cap = getLevelCap(operator, elite)
  const safeLevel = Math.min(Math.max(level, 1), cap)

  const base = interpolate(getPhase(operator, elite).attributesKeyFrames, safeLevel)
  const trustBonus = getTrustBonus(operator, trust)
  const { bonus: potentialBonus, details: potentialDetails } = getPotentialBonus(operator, potential)

  const attributes = {}
  const keys = new Set([
    ...Object.keys(base),
    ...Object.keys(trustBonus),
    ...Object.keys(potentialBonus),
  ])

  for (const key of keys) {
    const mods = []
    const trustValue = trustBonus[key] ?? 0
    const potentialValue = potentialBonus[key] ?? 0
    if (trustValue) mods.push({ kind: 'add', value: trustValue })
    if (potentialValue) mods.push({ kind: 'add', value: potentialValue })
    const result = computeAttribute(base[key] ?? 0, mods)
    attributes[key] = result.value
  }

  const steps = []
  for (const [key, value] of Object.entries(attributes)) {
    const label = ATTR_LABEL[key] ?? key
    const parts = []
    if (base[key]) parts.push(`基础 ${round(base[key])}`)
    if (trustBonus[key]) parts.push(`信赖 +${round(trustBonus[key])}`)
    if (potentialBonus[key]) parts.push(`潜能 ${potentialBonus[key] > 0 ? '+' : ''}${round(potentialBonus[key])}`)
    steps.push({ key, label, value, detail: parts.join('，') || '基础值' })
  }

  return {
    attributes,
    steps,
    meta: {
      elite,
      level: safeLevel,
      levelCap: cap,
      potential,
      trust,
      potentialDetails,
    },
  }
}

function round(value) {
  return Math.round(value * 100) / 100
}