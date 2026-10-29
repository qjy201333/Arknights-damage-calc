import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { computeManualDamage } from '../src/engine/manual.js'
import { computeAttribute } from '../src/engine/damage.js'

const fixture = {
  base: 758,
  addRatio: 1.04,
  mulRatio: 0.6,
  finalAdd: 932.542,
  atkScale: 4.1125,
  dmgScale: 1.606,
  def: 1875,
  defCut: 0.3,
  dmgReduction: 0.15,
}

const expected = 17333.17
const result = computeManualDamage(fixture)

console.log('=== 手动口径（1+x）逐项明细 ===')
for (const step of result.steps) {
  console.log(`${step.label.padEnd(16)} ${step.formula.padEnd(46)} = ${step.value.toFixed(4)}`)
}
console.log(`\n最终攻击力: ${result.attack.toFixed(4)}`)
console.log(`单次伤害:   ${result.finalDamage.toFixed(2)}`)
console.log(`期望值:     ${expected}`)
console.log(`保底值:     ${result.floor.toFixed(2)} | 触发: ${result.floorTriggered}`)

assert.ok(
  Math.abs(result.finalDamage - expected) < 0.01,
  `回归失败: 得到 ${result.finalDamage}, 期望 ${expected}`,
)
console.log('\n✅ 回归通过：与 17333.17 一致')

const prtsStyle = computeAttribute(fixture.base, [
  { kind: 'add', value: 1.04 },
  { kind: 'mul', value: 0.6 },
  { kind: 'finalAdd', value: fixture.finalAdd },
])
console.log('\n=== 现有 PRTS 语义对照 ===')
console.log(`直接加算按"加项"处理时攻击力: ${prtsStyle.value.toFixed(4)}`)
console.log(`差异原因: PRTS 的 D_p 是加项(+1.04)，而表格口径是倍率 ×(1+1.04)`)

const baseline = JSON.parse(await readFile(new URL('../src/data/topicRules.json', import.meta.url), 'utf8'))
console.log(`\n规则库基准: ${baseline.stats.rules} 条 / ${baseline.stats.relics} 个藏品条目`)