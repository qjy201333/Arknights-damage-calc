import { readFile, writeFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

const RELICS_FILE = join(process.cwd(), 'data', 'relics.json')
const RULES_FILE = join(process.cwd(), 'src', 'data', 'topicRules.json')
const OUT_FILE = join(process.cwd(), 'src', 'data', 'offenseRelics.json')

const OFFENSE_TEXT =
  /攻击力|攻击速度|攻速|受到的[^\n。]{0,20}?伤害|造成[^\n。]{0,20}?伤害|脆弱|易伤|防御力\s*[-−–]|法术抗性\s*[-−–]|防御力降低|法抗降低|无视[^\n。]{0,6}防御/

const asArray = (value) => (Array.isArray(value) ? value : [])
const lineTotal = (relics) => relics.reduce((sum, relic) => sum + relic.themes.reduce((acc, theme) => acc + asArray(theme.effectLines).length, 0), 0)
const lineCount = (relics, predicate) => relics.reduce((sum, relic) => sum + relic.themes.reduce((acc, theme) => acc + asArray(theme.effectLines).filter(predicate).length, 0), 0)

async function main() {
  const relicsData = JSON.parse(await readFile(RELICS_FILE, 'utf8'))
  const rulesData = JSON.parse(await readFile(RULES_FILE, 'utf8'))

  const offenseIds = new Set(rulesData.rules.map((rule) => rule.relicId))

  const kept = []
  const removed = []

  for (const relic of relicsData.relics) {
    const byId = relic.iconId ? offenseIds.has(relic.iconId) : false
    const byText = relic.themes.some((theme) =>
      asArray(theme.effectLines).some((line) => OFFENSE_TEXT.test(line.text ?? '')),
    )
    if (byId || byText) kept.push(relic)
    else removed.push(relic.name)
  }

  const output = {
    meta: {
      source: 'PRTS data/relics.json',
      generatedAt: new Date().toISOString(),
      note: '仅保留与输出伤害相关的藏品：excel 有输出规则，或效果文本含攻击/攻速/易伤/减防关键词',
    },
    stats: {
      total: relicsData.relics.length,
      parsed: kept.length,
      themes: kept.reduce((sum, relic) => sum + relic.themes.length, 0),
      effectLines: lineTotal(kept),
      linesWithOperators: lineCount(kept, (line) => line.ops.length > 0),
      linesWithDifficulty: lineCount(kept, (line) => line.difficulty !== null),
      kept: kept.length,
      removed: removed.length,
    },
    removedNames: removed.slice(0, 50),
    relics: kept,
  }

  await writeFile(OUT_FILE, JSON.stringify(output), 'utf8')
  const info = await stat(OUT_FILE)
  console.log(`藏品 ${relicsData.relics.length} → 保留 ${kept.length}，剔除 ${removed.length}`)
  console.log(`offenseRelics.json: ${(info.size / 1048576).toFixed(2)} MB`)
  console.log('剔除样例:', removed.slice(0, 8).join('、'))
}

main().catch((error) => {
  console.error('过滤失败:', error)
  process.exitCode = 1
})