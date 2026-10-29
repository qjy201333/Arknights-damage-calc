import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const EXCEL_DIR = join(process.cwd(), 'data', 'raw', 'gamedata', 'cn', 'gamedata', 'excel')
const OUT_DIR = join(process.cwd(), 'src', 'data')

const ATTR_KEYS = [
  'maxHp',
  'atk',
  'def',
  'magicResistance',
  'cost',
  'blockCnt',
  'attackSpeed',
  'baseAttackTime',
  'respawnTime',
  'moveSpeed',
]

const RARITY_SIX = 'TIER_6'
const EXCLUDED_PROFESSIONS = new Set(['TOKEN'])

const asArray = (value) => (Array.isArray(value) ? value : [])

async function readJson(name) {
  const text = await readFile(join(EXCEL_DIR, name), 'utf8')
  return JSON.parse(text)
}

function pickAttributes(data) {
  const result = {}
  for (const key of ATTR_KEYS) {
    if (data[key] !== undefined) result[key] = data[key]
  }
  return result
}

function cleanText(text) {
  if (!text) return ''
  return text
    .replace(/<@ba\.[a-z]+>/g, '')
    .replace(/<\/>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\{-([^}]*)\}/g, '$1')
}

function mapTalents(talents) {
  return asArray(talents).map((talent) => ({
    candidates: asArray(talent.candidates).map((candidate) => ({
      unlockCondition: candidate.unlockCondition,
      requiredPotentialRank: candidate.requiredPotentialRank,
      prefabKey: candidate.prefabKey,
      name: candidate.name,
      description: cleanText(candidate.description),
      blackboard: asArray(candidate.blackboard).map((entry) => ({
        key: entry.key,
        value: entry.value,
      })),
    })),
  }))
}

function mapPotential(potentialRanks) {
  return asArray(potentialRanks).map((rank) => ({
    type: rank.type,
    description: cleanText(rank.description),
    modifiers: asArray(rank.buff?.attributes?.attributeModifiers).map((modifier) => ({
      attributeType: modifier.attributeType,
      formulaItem: modifier.formulaItem,
      value: modifier.value,
    })),
  }))
}

function mapPhases(phases) {
  return asArray(phases).map((phase) => ({
    rangeId: phase.rangeId,
    attributesKeyFrames: asArray(phase.attributesKeyFrames).map((frame) => ({
      level: frame.level,
      data: pickAttributes(frame.data ?? {}),
    })),
  }))
}

function mapModules(modules) {
  return asArray(modules).map((module) => ({
    uniEquipId: module.uniEquipId,
    uniEquipName: module.uniEquipName,
    typeName1: module.typeName1,
    unlockEvolvePhase: module.unlockEvolvePhase,
    unlockLevel: module.unlockLevel,
  }))
}

function mapOperator(id, char) {
  return {
    id,
    name: char.name,
    appellation: char.appellation,
    profession: char.profession,
    subProfessionId: char.subProfessionId,
    position: char.position,
    rarity: char.rarity,
    nationId: char.nationId,
    tagList: asArray(char.tagList),
    trait: char.trait?.candidates?.[0]?.description ? cleanText(char.trait.candidates[0].description) : '',
    phases: mapPhases(char.phases),
    skills: asArray(char.skills).map((skill) => ({
      skillId: skill.skillId,
      unlockCond: skill.unlockCond,
    })),
    talents: mapTalents(char.talents),
    potentialRanks: mapPotential(char.potentialRanks),
    favorKeyFrames: asArray(char.favorKeyFrames).map((frame) => ({
      level: frame.level,
      data: pickAttributes(frame.data ?? {}),
    })),
    modules: mapModules(char.modules),
  }
}

function mapSkill(skillId, skill) {
  return {
    skillId,
    iconId: skill.iconId,
    levels: asArray(skill.levels).map((level) => ({
      name: level.name,
      rangeId: level.rangeId,
      description: cleanText(level.description),
      skillType: level.skillType,
      durationType: level.durationType,
      spData: {
        spType: level.spData?.spType,
        spCost: level.spData?.spCost,
        initSp: level.spData?.initSp,
        increment: level.spData?.increment,
        maxChargeTime: level.spData?.maxChargeTime,
      },
      duration: level.duration,
      blackboard: asArray(level.blackboard).map((entry) => ({
        key: entry.key,
        value: entry.value,
      })),
    })),
  }
}

function mapEnemy(enemyId, enemy) {
  return {
    id: enemyId,
    name: enemy.name,
    level: enemy.enemyLevel,
    sortId: enemy.sortId,
    damageType: asArray(enemy.damageType),
    tags: enemy.enemyTags,
    description: cleanText(enemy.description),
  }
}

async function main() {
  const characterTable = await readJson('character_table.json')
  const skillTable = await readJson('skill_table.json')
  const enemyTable = await readJson('enemy_handbook_table.json')

  const operators = []
  const skillIds = new Set()

  for (const [id, char] of Object.entries(characterTable)) {
    if (char.rarity !== RARITY_SIX || !char.profession) continue
    if (EXCLUDED_PROFESSIONS.has(char.profession)) continue
    operators.push(mapOperator(id, char))
    for (const skill of asArray(char.skills)) skillIds.add(skill.skillId)
  }

  const skills = {}
  for (const skillId of skillIds) {
    const skill = skillTable[skillId]
    if (!skill) continue
    skills[skillId] = mapSkill(skillId, skill)
  }

  const enemies = Object.entries(enemyTable.enemyData ?? {}).map(([id, enemy]) => mapEnemy(id, enemy))

  operators.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

  const meta = {
    source: 'ArknightsAssets/ArknightsGamedata cn/gamedata/excel',
    generatedAt: new Date().toISOString(),
  }

  const outputs = [
    ['operators.json', { meta: { ...meta, scope: '六星干员（含异格）' }, count: operators.length, operators }],
    ['skills.json', { meta, count: Object.keys(skills).length, skills }],
    [
      'enemies.json',
      {
        meta: { ...meta, note: '图鉴仅含名称与等级，防御/法抗等数值由计算器内手动输入' },
        count: enemies.length,
        enemies,
      },
    ],
  ]

  await mkdir(OUT_DIR, { recursive: true })

  for (const [name, data] of outputs) {
    const path = join(OUT_DIR, name)
    await writeFile(path, JSON.stringify(data), 'utf8')
    const info = await stat(path)
    console.log(`${name}: ${(info.size / 1048576).toFixed(2)} MB`)
  }

  console.log(`六星干员 ${operators.length}，技能 ${Object.keys(skills).length}，敌人 ${enemies.length}`)
}

main().catch((error) => {
  console.error('裁剪失败:', error)
  process.exitCode = 1
})