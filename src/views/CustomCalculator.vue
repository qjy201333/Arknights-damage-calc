<script setup>
import { computed, ref } from 'vue'
import { computeManualDamage } from '../engine/manual.js'

const defaults = {
  base: 758,
  addRatio: 1.04,
  mulRatio: 0.6,
  finalAdd: 932.542,
  atkScale: 4.1125,
  dmgScale: 1.606,
  def: 1875,
  defCut: 0.3,
  dmgReduction: 0.15,
  enemyDefBonus: 0,
  enemyDefPct: 0,
  enemyReductionBonus: 0,
}

const form = ref({ ...defaults })
const result = computed(() => computeManualDamage(form.value))

function reset() {
  form.value = { ...defaults }
}

function applyBlueprint() {
  form.value.enemyReductionBonus = 0.5
}

function clearBlueprint() {
  form.value.enemyReductionBonus = 0
}

const round = (value) => Math.round(value * 100) / 100
const pct = (value) => `${round(value * 100)}%`
</script>

<template>
  <div class="page">
    <section class="panel form-panel">
      <div class="head">
        <h2>自定义计算</h2>
        <button class="reset" @click="reset">恢复示例</button>
      </div>
      <p class="hint">按 1+x 倍率口径：直接加算与直接乘算都按 ×(1+数值) 处理</p>

      <h3>攻击力构成</h3>
      <div class="grid">
        <label>基础面板<input v-model.number="form.base" type="number" /></label>
        <label>直接加算倍率<input v-model.number="form.addRatio" type="number" step="0.01" /></label>
        <label>直接乘算倍率<input v-model.number="form.mulRatio" type="number" step="0.01" /></label>
        <label>最终加算<input v-model.number="form.finalAdd" type="number" step="0.001" /></label>
      </div>

      <h3>伤害区</h3>
      <div class="grid">
        <label>攻击力倍率<input v-model.number="form.atkScale" type="number" step="0.0001" /></label>
        <label>伤害倍率（最终乘算）<input v-model.number="form.dmgScale" type="number" step="0.001" /></label>
      </div>

      <h3>敌人</h3>
      <div class="grid">
        <label>基础防御<input v-model.number="form.def" type="number" /></label>
        <label>减防比例<input v-model.number="form.defCut" type="number" step="0.01" /></label>
        <label>基础减伤<input v-model.number="form.dmgReduction" type="number" step="0.01" /></label>
      </div>

      <details class="enemy-mods" open>
        <summary>敌方藏品修正（负面藏品）</summary>
        <div class="presets">
          <button @click="applyBlueprint">生命蓝图 · 精英/领袖登场 30 秒内（减伤 50%）</button>
          <button v-if="form.enemyReductionBonus === 0.5" class="clear" @click="clearBlueprint">清除</button>
        </div>
        <div class="grid">
          <label>加防固定值<input v-model.number="form.enemyDefBonus" type="number" /></label>
          <label>加防百分比<input v-model.number="form.enemyDefPct" type="number" step="0.01" /></label>
          <label>追加减伤<input v-model.number="form.enemyReductionBonus" type="number" step="0.01" /></label>
        </div>
        <p class="hint">
          例如「生命蓝图」给敌方 +30% 攻击、+50% 生命；「坚固」类藏品会加防或加减伤，填在这里会同步影响最终伤害
        </p>
      </details>
    </section>

    <aside class="panel result-panel">
      <h3>结果</h3>
      <div class="result-block">
        <div class="result-row primary">
          <span>最终攻击力</span>
          <b>{{ round(result.attack) }}</b>
        </div>
        <div class="result-row">
          <span>单次伤害</span>
          <b class="damage">{{ round(result.finalDamage) }}</b>
        </div>
        <div class="result-row">
          <span>最低保底</span>
          <b>{{ round(result.floor) }}</b>
        </div>
        <div class="result-row">
          <span>有效防御 / 总减伤</span>
          <b>
            {{ round((form.def + form.enemyDefBonus) * (1 + form.enemyDefPct) * (1 - form.defCut)) }}
            / {{ pct(form.dmgReduction + form.enemyReductionBonus) }}
          </b>
        </div>
      </div>

      <h3>明细</h3>
      <div class="steps">
        <div v-for="(step, index) in result.steps" :key="index" class="step">
          <span class="step-label">{{ step.label }}</span>
          <code>{{ step.formula }} = {{ round(step.value) }}</code>
        </div>
      </div>

      <p class="footnote">口径：减防 → 最终乘算（伤害倍率）→ 减伤；保底为攻击区伤害的 5%</p>
    </aside>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 14px;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 16px;
  min-height: 0;
  overflow-y: auto;
  backdrop-filter: blur(10px);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.head h2 {
  margin: 0;
  font-size: 18px;
}

.reset {
  padding: 5px 12px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(8, 12, 20, 0.6);
  color: var(--cyan);
  cursor: pointer;
  font-size: 12px;
}

.hint {
  font-size: 12px;
  color: var(--muted);
  margin: 6px 0 0;
  line-height: 1.6;
}

h3 {
  margin: 16px 0 8px;
  font-size: 14px;
  color: #c7d2fe;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.grid label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  color: var(--muted);
}

.grid input {
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(8, 12, 20, 0.7);
  font-size: 14px;
  color: var(--text);
  outline: none;
}

.grid input:focus {
  border-color: rgba(34, 211, 238, 0.5);
  box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.12);
}

.enemy-mods {
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px dashed rgba(244, 114, 182, 0.4);
  background: rgba(244, 114, 182, 0.05);
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.presets button {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid rgba(244, 114, 182, 0.45);
  background: rgba(244, 114, 182, 0.1);
  color: #f9a8d4;
  font-size: 12px;
  cursor: pointer;
}

.presets button.clear {
  border-color: rgba(148, 163, 184, 0.4);
  background: transparent;
  color: var(--muted);
}

.enemy-mods summary {
  cursor: pointer;
  font-size: 13px;
  color: #f9a8d4;
  margin-bottom: 8px;
}

.result-panel h3 {
  margin-top: 0;
}

.result-block {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(8, 12, 20, 0.55);
  border: 1px solid var(--line);
}

.result-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 0;
  font-size: 13px;
  color: var(--muted);
}

.result-row b {
  font-size: 16px;
  color: var(--text);
}

.result-row.primary b {
  font-size: 20px;
  color: var(--cyan);
  text-shadow: 0 0 14px rgba(34, 211, 238, 0.45);
}

.result-row .damage {
  font-size: 24px;
  color: #f472b6;
  text-shadow: 0 0 16px rgba(244, 114, 182, 0.45);
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(8, 12, 20, 0.45);
  border-left: 2px solid rgba(34, 211, 238, 0.35);
}

.step-label {
  font-size: 12px;
  color: var(--muted);
}

.step code {
  font-size: 12px;
  color: #a5b4fc;
  word-break: break-all;
}

.footnote {
  margin-top: 14px;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.6;
}
</style>