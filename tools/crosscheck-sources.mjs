import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = process.cwd()
const A_DIR = join(ROOT, 'data', 'raw', 'gamedata', 'cn', 'gamedata', 'excel')
const B_DIR = join(ROOT, 'data', 'raw', 'gamedata-keng', 'zh_CN', 'gamedata', 'excel')

const load = async (dir, name) => JSON.parse(await readFile(join(dir, name), 'utf8'))
const sixStarIds = (table) =>
  Object.keys(table).filter(
    (id) => table[id].rarity === 'TIER_6' && table[id].profession && table[id].profession !== 'TOKEN',
  )
const lastFrame = (operator) => {
  const phase = operator.phases?.[operator.phases.length - 1]
  const frames = phase?.attributesKeyFrames ?? []
  return frames[frames.length - 1]?.data ?? {}
}

const findings = []
const same = (label, a, b) => {
  const ok = JSON.stringify(a) === JSON.stringify(b)
  if (!ok) findings.push({ label, a, b })
  return ok
}

const A_char = await load(A_DIR, 'character_table.json')
const B_char = await load(B_DIR, 'character_table.json')
const idsA = new Set(sixStarIds(A_char))
const idsB = new Set(sixStarIds(B_char))
const onlyA = [...idsA].filter((id) => !idsB.has(id))
const onlyB = [...idsB].filter((id) => !idsA.has(id))
console.log('干员表：A(Assets) 六星', idsA.size, '| B(Kengxxiao) 六星', idsB.size)
console.log('  仅 A 有:', onlyA.length ? onlyA.join(', ') : '无')
console.log('  仅 B 有:', onlyB.length ? onlyB.join(', ') : '无')

let attrDiffs = 0
const attrSamples = []
for (const id of [...idsA].filter((x) => idsB.has(x))) {
  const a = lastFrame(A_char[id])
  const b = lastFrame(B_char[id])
  const keys = ['atk', 'maxHp', 'def', 'magicResistance', 'baseAttackTime']
  const diff = keys.filter((k) => a[k] !== b[k])
  if (diff.length) {
    attrDiffs += 1
    if (attrSamples.length < 5) attrSamples.push({ id, name: A_char[id].name, diff: diff.map((k) => `${k}: ${a[k]} vs ${b[k]}`) })
  }
}
console.log('  面板差异干员数:', attrDiffs)
attrSamples.forEach((s) => console.log('   ', s.name, '|', s.diff.join('; ')))

const A_skill = await load(A_DIR, 'skill_table.json')
const B_skill = await load(B_DIR, 'skill_table.json')
const skillIdsA = new Set(Object.keys(A_skill))
const skillIdsB = new Set(Object.keys(B_skill))
const skillOnlyA = [...skillIdsA].filter((x) => !skillIdsB.has(x))
const skillOnlyB = [...skillIdsB].filter((x) => !skillIdsA.has(x))
console.log('\n技能表：A', skillIdsA.size, '| B', skillIdsB.size)
console.log('  仅 A:', skillOnlyA.length ? skillOnlyA.slice(0, 5).join(', ') : '无')
console.log('  仅 B:', skillOnlyB.length ? skillOnlyB.slice(0, 5).join(', ') : '无')

let skillDiffs = 0
for (const id of ['skchr_ifrit_3', 'skchr_amiya_1', 'skchr_silverash_2']) {
  if (!A_skill[id] || !B_skill[id]) continue
  const la = A_skill[id].levels?.[9]
  const lb = B_skill[id].levels?.[9]
  const sameBb = JSON.stringify(la?.blackboard) === JSON.stringify(lb?.blackboard)
  const sameMeta = la?.duration === lb?.duration && la?.spData?.spCost === lb?.spData?.spCost
  if (!sameBb || !sameMeta) {
    skillDiffs += 1
    console.log(`  差异 ${id}: blackboard ${sameBb ? '同' : '异'}，duration/sp ${sameMeta ? '同' : '异'}`)
  }
}
console.log('  抽查技能差异:', skillDiffs)

const A_rogue = await load(A_DIR, 'roguelike_topic_table.json')
const B_rogue = await load(B_DIR, 'roguelike_topic_table.json')
const checkRelic = (topic, id) => {
  const a = A_rogue.details?.[topic]?.relics?.[id]?.buffs
  const b = B_rogue.details?.[topic]?.relics?.[id]?.buffs
  const ok = JSON.stringify(a) === JSON.stringify(b)
  console.log(`  藏品 ${topic}/${id}: ${ok ? '一致' : '差异'}`)
  if (!ok) {
    console.log('    A:', JSON.stringify(a).slice(0, 260))
    console.log('    B:', JSON.stringify(b).slice(0, 260))
  }
  return ok
}
console.log('\n集成战略表：')
checkRelic('rogue_6', 'rogue_6_relic_final_10')
checkRelic('rogue_1', 'rogue_1_relic_a25')
checkRelic('rogue_1', 'rogue_1_relic_a02')
checkRelic('rogue_1', 'rogue_1_relic_q36')

const countRelics = (t) => Object.values(t.details ?? {}).reduce((sum, d) => sum + Object.keys(d.relics ?? {}).length, 0)
console.log('  藏品条目：A', countRelics(A_rogue), '| B', countRelics(B_rogue))

const A_uni = await load(A_DIR, 'uniequip_table.json')
const B_uni = await load(B_DIR, 'uniequip_table.json')
const equipA = Object.keys(A_uni.equipDict ?? {}).length
const equipB = Object.keys(B_uni.equipDict ?? {}).length
console.log('\n模组表：A', equipA, '| B', equipB)

console.log('\n结论：', findings.length === 0 && onlyA.length === 0 && onlyB.length === 0 && attrDiffs === 0 ? '两源数据一致' : '存在上述差异')
if (findings.length) console.log('差异明细:', findings.slice(0, 5).map((f) => f.label))