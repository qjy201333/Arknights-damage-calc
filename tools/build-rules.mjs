import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const RELICS_FILE = join(process.cwd(), 'data', 'relics.json')
const OUT_FILE = join(process.cwd(), 'src', 'data', 'relicRules.json')

const OP_TO_KIND = {
  '+': 'add',
  '*': 'mul',
  '++': 'finalAdd',
  '**': 'finalMul',
  'r+': 'runeAdd',
  'r*': 'runeMul',
  'r**': 'runeFinalMul',
}

const ATTR_PATTERNS = [
  ['damageTaken', /受到的.{0,6}?(物理|法术|真实|元素)?伤害/],
  ['damageDealt', /造成.{0,6}?(物理|法术|真实|元素)?伤害/],
  ['respawnTime', /再部署时间/],
  ['baseAttackTime', /攻击间隔/],
  ['attackSpeed', /攻击速度|攻速/],
  ['magicResistance', /法术抗性|法抗/],
  ['maxHp', /生命值|生命上限|生命/],
  ['blockCnt', /阻挡数/],
  ['moveSpeed', /移动速度/],
  ['mass', /重量/],
  ['cost', /部署费用|费用/],
  ['atk', /攻击力/],
  ['def', /防御力|防御/],
  ['sp', /技力/],
  ['statusResistance', /状态抵抗/],
  ['dodge', /闪避/],
  ['heal', /治疗量|治疗/],
]

const NOISE_PATTERN =
  /所有|我方|敌方|敌军|敌人|干员|单位|的|值|上限|获得|提升|降低|增加|减少|额外|基础|其|并|且|与|和|全|每|在|上|中|时|后|前|但|而|则|使|令|给予|提供|进行|对|向|从|以|为|是|有|会|能|可|，|,|。|、|；|;|：|:|\+|-|%|／|\/|（|）|\(|\)|\s/g

const ATTR_WORDS =
  /生命值|生命上限|生命|攻击力|防御力|防御|法术抗性|法抗|攻击速度|攻速|部署费用|费用|阻挡数|阻挡|攻击间隔|再部署时间|移动速度|重量|技力|状态抵抗|闪避|治疗量|治疗|伤害|物理|法术|真实|元素/g

const CONDITION_PATTERN = /每有|每触发|每秒|每次|首次|当.{0,4}时|若|处于|期间|时，|后，|后获得|触发|依次|随机|依据|根据|战斗开始时|部署后|使用后|上场后/

function detectTarget(text) {
  if (/敌方|敌军|敌人/.test(text)) return 'enemy'
  if (/我方|干员/.test(text)) return 'ally'
  return null
}

function detectAttribute(text) {
  for (const [key, pattern] of ATTR_PATTERNS) {
    if (pattern.test(text)) return key
  }
  return null
}

function detectDamageType(text) {
  if (/物理/.test(text)) return 'physical'
  if (/法术/.test(text)) return 'arts'
  if (/真实/.test(text)) return 'true'
  if (/元素/.test(text)) return 'element'
  return null
}

function parseNumber(display, expanded) {
  const raw = (expanded && expanded.trim()) || (display ?? '')
  const stripped = raw
    .replace(/[()（）\s]/g, '')
    .replace(/[+]/g, '')
  const isPercent = stripped.includes('%')
  const value = Number(stripped.replace('%', ''))
  if (!Number.isFinite(value)) return null
  return isPercent ? value / 100 : value
}

function extractOps(text) {
  const results = []
  const regex = /〔([a-z*+]+):([^〕]*)〕/g
  let lastIndex = 0
  let match
  while ((match = regex.exec(text)) !== null) {
    results.push({
      op: match[1],
      display: match[2],
      preceding: text.slice(lastIndex, match.index),
      fullIndex: match.index,
    })
    lastIndex = regex.lastIndex
  }
  return results
}

function isConditional(segment) {
  if (CONDITION_PATTERN.test(segment)) return true
  const cleaned = segment.replace(ATTR_WORDS, '').replace(NOISE_PATTERN, '').trim()
  return cleaned.length > 0
}

function buildRules(relic, theme, line, lineIndex) {
  if (!line.ops?.length) return []
  const parsed = extractOps(line.text)
  const rules = []
  const wholeAttr = detectAttribute(line.text)
  const wholeTarget = detectTarget(line.text)

  parsed.forEach((entry, index) => {
    const kind = OP_TO_KIND[entry.op]
    if (!kind) return
    const fallbackOp = line.ops[index]
    const value = parseNumber(entry.display, fallbackOp?.expanded)
    if (value === null) return

    const context = entry.preceding || ''
    const attribute = detectAttribute(context) ?? wholeAttr
    const target = detectTarget(context) ?? wholeTarget
    if (!attribute || !target) return

    const conditional = isConditional(context)

    rules.push({
      id: `${relic.iconId ?? relic.page}-${theme.topic}-${lineIndex}-${index}`,
      relic: relic.name,
      iconId: relic.iconId,
      topic: theme.topic,
      difficulty: line.difficulty,
      variant: line.variant,
      target,
      attribute,
      damageType: attribute === 'damageTaken' || attribute === 'damageDealt' ? detectDamageType(context || line.text) : null,
      kind,
      value,
      conditional,
      conditionText: conditional ? line.text : null,
      raw: line.text,
    })
  })

  return rules
}

const INFERRED_PATTERNS = [
  {
    pattern: /受到.{0,8}?(物理|法术|真实|元素)?伤害\s*([+\-]?\d+(?:\.\d+)?)\s*%/,
    target: 'enemy',
    attribute: 'damageTaken',
    kind: 'finalMul',
  },
  {
    pattern: /造成.{0,8}?(物理|法术|真实|元素)?伤害\s*([+\-]?\d+(?:\.\d+)?)\s*%/,
    target: 'ally',
    attribute: 'damageDealt',
    kind: 'finalMul',
  },
]

const DAMAGE_TYPE_LABEL = { 物理: 'physical', 法术: 'arts', 真实: 'true', 元素: 'element' }

function buildInferredRules(relic, theme, line, lineIndex) {
  if (line.ops?.length) return []
  const rules = []
  INFERRED_PATTERNS.forEach((item, index) => {
    const match = item.pattern.exec(line.text)
    if (!match) return
    const value = Number(match[2]) / 100
    if (!Number.isFinite(value)) return
    const conditional = CONDITION_PATTERN.test(line.text)
    rules.push({
      id: `${relic.iconId ?? relic.page}-${theme.topic}-${lineIndex}-inf${index}`,
      relic: relic.name,
      iconId: relic.iconId,
      topic: theme.topic,
      difficulty: line.difficulty,
      variant: line.variant,
      target: item.target,
      attribute: item.attribute,
      damageType: match[1] ? DAMAGE_TYPE_LABEL[match[1]] ?? null : null,
      kind: item.kind,
      value,
      conditional,
      conditionText: conditional ? line.text : null,
      confidence: 'inferred',
      raw: line.text,
    })
  })
  return rules
}

async function main() {
  const relics = JSON.parse(await readFile(RELICS_FILE, 'utf8'))
  const rules = []
  const unmatched = []
  let opLineTotal = 0

  for (const relic of relics.relics) {
    for (const theme of relic.themes) {
      theme.effectLines.forEach((line, lineIndex) => {
        if (!line.text) return
        if (line.ops?.length) {
          opLineTotal += 1
          const built = buildRules(relic, theme, line, lineIndex)
          if (built.length === 0) {
            unmatched.push({ relic: relic.name, topic: theme.topic, text: line.text })
            return
          }
          rules.push(...built)
          return
        }
        const inferred = buildInferredRules(relic, theme, line, lineIndex)
        if (inferred.length > 0) rules.push(...inferred)
      })
    }
  }

  const unconditional = rules.filter((rule) => !rule.conditional)
  const byAttribute = {}
  for (const rule of unconditional) {
    byAttribute[rule.attribute] = (byAttribute[rule.attribute] ?? 0) + 1
  }

  const meta = {
    source: 'PRTS 藏品页解析结果（data/relics.json）',
    generatedAt: new Date().toISOString(),
    note: 'value 已由 expanded 字段换算：百分比转小数，r* 等倍率项按增量处理',
  }

  const output = {
    meta,
    stats: {
      opLines: opLineTotal,
      rules: rules.length,
      unconditional: unconditional.length,
      conditional: rules.length - unconditional.length,
      unmatched: unmatched.length,
      byAttribute,
    },
    rules,
    unmatched: unmatched.slice(0, 200),
  }

  await mkdir(join(process.cwd(), 'src', 'data'), { recursive: true })
  await writeFile(OUT_FILE, JSON.stringify(output), 'utf8')
  const info = await stat(OUT_FILE)

  console.log(`带运算效果行 ${opLineTotal}，生成规则 ${rules.length} 条`)
  console.log(`无条件 ${unconditional.length}，有条件 ${rules.length - unconditional.length}，未匹配行 ${unmatched.length}`)
  console.log('无条件规则属性分布:', JSON.stringify(byAttribute))
  console.log(`relicRules.json: ${(info.size / 1048576).toFixed(2)} MB`)
}

main().catch((error) => {
  console.error('规则生成失败:', error)
  process.exitCode = 1
})