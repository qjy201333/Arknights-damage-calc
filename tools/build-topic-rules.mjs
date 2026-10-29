import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const SOURCE = join(process.cwd(), 'data', 'raw', 'gamedata', 'cn', 'gamedata', 'excel', 'roguelike_topic_table.json')
const OUT_FILE = join(process.cwd(), 'src', 'data', 'topicRules.json')

const TOPIC_LABEL = {
  rogue_1: '傀影与猩红孤钻',
  rogue_2: '水月与深蓝之树',
  rogue_3: '探索者的银凇止境',
  rogue_4: '萨卡兹的无终奇语',
  rogue_5: '岁的界园志异',
  rogue_6: '沉沦者的黑流树海',
}

const BUFF_TARGET = {
  char_attribute_mul: { target: 'ally', kind: 'mul' },
  char_attribute_add: { target: 'ally', kind: 'add' },
  char_squad_attribute_mul: { target: 'ally', kind: 'mul' },
  char_squad_attribute_add: { target: 'ally', kind: 'add' },
  layer_char_attribute_mul: { target: 'ally', kind: 'mul', stacked: true },
  layer_char_attribute_add: { target: 'ally', kind: 'add', stacked: true },
  enemy_attribute_add: { target: 'enemy', kind: 'add' },
  enemy_attribute_mul: { target: 'enemy', kind: 'mul' },
}

const ATTR_MAP = {
  atk: 'atk',
  max_hp: 'maxHp',
  def: 'def',
  magic_resistance: 'magicResistance',
  attack_speed: 'attackSpeed',
  cost: 'cost',
  block_cnt: 'blockCnt',
  respawn_time: 'respawnTime',
  move_speed: 'moveSpeed',
  sp: 'sp',
  hp_recovery_per_sec_by_max_hp_ratio: 'hpRecoveryByMaxHp',
}

const DAMAGE_SCALE_TYPE = {
  phy: 'physical',
  mag: 'arts',
  pure: 'true',
  ep: 'element',
}

const ENEMY_DOWN_ATTR = {
  enemy_atk_down: 'atk',
  enemy_def_down: 'def',
  enemy_max_hp_down: 'maxHp',
  enemy_attack_speed_down: 'attackSpeed',
  enemy_move_speed_down: 'moveSpeed',
}

const IGNORED_BB_KEYS = new Set([
  'key',
  'selector.profession',
  'selector.sub_profession',
  'selector.enemy_level_type',
  'selector.buildable',
  'count',
  'id',
  'value',
  'delta',
  'node',
  'zone',
  'trig_type',
  'rarity',
  'profession',
  'from',
  'to',
  'mask',
  'pr',
  'cnt',
  'max',
  'up',
  'interval',
  'duration',
  'limit',
])

const asArray = (value) => (Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : [])
const round6 = (value) => Math.round(value * 1e6) / 1e6

function blackboardValue(blackboard, key) {
  return blackboard.find((entry) => entry.key === key)?.value
}

function selectorProfession(blackboard) {
  const entry = blackboard.find((item) => item.key === 'selector.profession')
  if (!entry || !entry.valueStr) return null
  return entry.valueStr.split('|').filter(Boolean)
}

function buildRulesForRelic(topic, relic) {
  const rules = []
  const buffs = asArray(relic.buffs)

  buffs.forEach((buff, buffIndex) => {
    const blackboard = asArray(buff.blackboard)

    const mapping = BUFF_TARGET[buff.key]
    if (mapping) {
      const professions = selectorProfession(blackboard)
      blackboard.forEach((entry, entryIndex) => {
        const attribute = ATTR_MAP[entry.key]
        if (!attribute) return
        if (IGNORED_BB_KEYS.has(entry.key)) return
        if (typeof entry.value !== 'number') return
        rules.push({
          id: `${relic.id}-${buffIndex}-${entryIndex}`,
          relicId: relic.id,
          relicName: relic.name,
          topic,
          topicLabel: TOPIC_LABEL[topic] ?? topic,
          target: mapping.target,
          attribute,
          kind: mapping.kind,
          value: entry.value,
          stacked: Boolean(mapping.stacked),
          professionFilter: professions,
          source: 'excel',
          raw: `${buff.key} ${entry.key}=${entry.value}`,
        })
      })
      return
    }

    if (!/^global_buff/.test(buff.key)) return

    const keyField = blackboard.find((entry) => entry.key === 'key')
    const keyValue = keyField?.valueStr
    if (!keyValue) return

    const scaleMatch = keyValue.match(/^enemy_damage_scale\[(\w+)\]$/)
    if (scaleMatch) {
      const scale = blackboardValue(blackboard, 'damage_scale')
      if (typeof scale !== 'number') return
      rules.push({
        id: `${relic.id}-${buffIndex}-scale`,
        relicId: relic.id,
        relicName: relic.name,
        topic,
        topicLabel: TOPIC_LABEL[topic] ?? topic,
        target: 'enemy',
        attribute: 'damageTaken',
        damageType: DAMAGE_SCALE_TYPE[scaleMatch[1]] ?? null,
        kind: 'finalMul',
        value: round6(scale - 1),
        stacked: buff.key !== 'global_buff_stack_base_one',
        source: 'excel',
        raw: `${keyValue} damage_scale=${scale}`,
      })
      return
    }

    const resistance = blackboardValue(blackboard, 'damage_resistance')
    const usageText = relic.usage || ""
    const enemyTakenOnly =
      /^enemy_damage_resistance/.test(keyValue) ||
      /(敌人|敌方|敌军)[^，。；]*受到[^，。；]*伤害/.test(usageText)
    if (typeof resistance === 'number' && enemyTakenOnly) {
      const hasDuration = typeof blackboardValue(blackboard, 'duration') === 'number'
      const conditional = hasDuration || /enroll|difficulty/.test(keyValue)
      rules.push({
        id: `${relic.id}-${buffIndex}-resist`,
        relicId: relic.id,
        relicName: relic.name,
        topic,
        topicLabel: TOPIC_LABEL[topic] ?? topic,
        target: 'enemy',
        attribute: 'damageReduction',
        kind: 'add',
        value: resistance,
        stacked: false,
        conditional,
        conditionText: conditional ? `${keyValue}${hasDuration ? ` ${blackboardValue(blackboard, 'duration')}s` : ''}` : null,
        source: 'excel',
        raw: `${keyValue} damage_resistance=${resistance}`,
      })
      return
    }

    const downAttr = ENEMY_DOWN_ATTR[keyValue]
    if (downAttr) {
      const attrKey = Object.entries(ATTR_MAP).find(([, value]) => value === downAttr)?.[0]
      const rawValue = attrKey ? blackboardValue(blackboard, attrKey) : undefined
      if (typeof rawValue !== 'number') return
      const absoluteAttribute = downAttr === "attackSpeed"
      const value = absoluteAttribute ? rawValue : Math.abs(rawValue) >= 1 ? rawValue - 1 : rawValue
      rules.push({
        id: `${relic.id}-${buffIndex}-down`,
        relicId: relic.id,
        relicName: relic.name,
        topic,
        topicLabel: TOPIC_LABEL[topic] ?? topic,
        target: 'enemy',
        attribute: downAttr,
        kind: absoluteAttribute ? 'add' : 'mul',
        value: round6(value),
        stacked: buff.key !== 'global_buff_stack_base_one',
        source: 'excel',
        raw: `${keyValue} ${downAttr}=${value}`,
      })
    }
  })

  for (const rule of rules) rule.usage = relic.usage ?? null

  return rules
}

async function main() {
  const table = JSON.parse(await readFile(SOURCE, 'utf8'))
  const rules = []
  const relicCount = {}
  let totalRelics = 0

  for (const [topic, data] of Object.entries(table.details ?? {})) {
    const relics = data.relics ?? {}
    const items = data.items ?? {}
    relicCount[topic] = Object.keys(relics).length
    for (const relic of Object.values(relics)) {
      totalRelics += 1
      const item = items[relic.id]
      rules.push(
        ...buildRulesForRelic(topic, {
          ...relic,
          name: item?.name ?? relic.id,
          usage: item?.usage ?? null,
        }),
      )
    }
  }

  const byAttribute = {}
  for (const rule of rules) {
    const key = `${rule.target}.${rule.attribute}${rule.damageType ? '.' + rule.damageType : ''}`
    byAttribute[key] = (byAttribute[key] ?? 0) + 1
  }

  const output = {
    meta: {
      source: 'ArknightsAssets/ArknightsGamedata cn/gamedata/excel/roguelike_topic_table.json',
      generatedAt: new Date().toISOString(),
      note: 'excel 原生 buff 映射，优先级高于 PRTS 文本推断规则',
    },
    stats: {
      topics: relicCount,
      relics: totalRelics,
      rules: rules.length,
      byAttribute,
    },
    rules,
  }

  await mkdir(join(process.cwd(), 'src', 'data'), { recursive: true })
  await writeFile(OUT_FILE, JSON.stringify(output), 'utf8')
  const info = await stat(OUT_FILE)

  console.log(`藏品 ${totalRelics}，生成规则 ${rules.length}`)
  console.log('规则属性分布:', JSON.stringify(byAttribute))
  console.log(`topicRules.json: ${(info.size / 1048576).toFixed(2)} MB`)
}

main().catch((error) => {
  console.error('生成失败:', error)
  process.exitCode = 1
})