<script setup>
import { computed, ref } from 'vue'
import dataset from '../data/relics.json'
import { computeAttribute, physicalDamage, artsDamage } from './engine/damage.js'

const relics = dataset.relics
const stats = dataset.stats

const keyword = ref('')
const topic = ref('')
const selected = ref(null)
const activeTheme = ref(0)

const topics = computed(() => [...new Set(relics.flatMap((relic) => relic.themes.map((theme) => theme.topic)))])
const filtered = computed(() => {
  const word = keyword.value.trim().toLowerCase()
  return relics.filter((relic) => {
    const matchWord =
      !word ||
      relic.name.toLowerCase().includes(word) ||
      (relic.iconId ?? '').toLowerCase().includes(word)
    const matchTopic = !topic.value || relic.themes.some((theme) => theme.topic === topic.value)
    return matchWord && matchTopic
  })
})

const rarityLabel = (rarity) => ({ '0': 'N', '1': 'R', '2': 'SR' })[String(rarity)] ?? rarity
const rarityClass = (rarity) => ({ '0': 'n', '1': 'r', '2': 'sr' })[String(rarity)] ?? 'n'

const opColor = {
  '+': '#94a3b8',
  '*': '#34d399',
  '++': '#fb923c',
  '**': '#f59e0b',
  'r+': '#38bdf8',
  'r*': '#60a5fa',
  'r**': '#a78bfa',
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatLine(text) {
  return escapeHtml(text).replace(/〔([a-z*+]+):([^〕]*)〕/g, (_, op, value) => {
    const color = opColor[op] ?? '#60a5fa'
    return `<span class="op-chip" style="color:${color};border-color:${color}44;background:${color}14">${value}</span>`
  })
}

function selectRelic(relic) {
  selected.value = relic
  activeTheme.value = 0
}

const calc = ref({
  base: 1000,
  mult: 1,
  directAdd: 0,
  directMul: 0,
  finalAdd: 0,
  finalMul: 0,
  defense: 500,
  res: 20,
})

const mods = computed(() =>
  [
    { kind: 'add', value: calc.value.directAdd },
    { kind: 'mul', value: calc.value.directMul / 100 },
    { kind: 'finalAdd', value: calc.value.finalAdd },
    { kind: 'finalMul', value: calc.value.finalMul / 100 },
  ].filter((mod) => mod.value !== 0),
)

const atkResult = computed(() => computeAttribute(calc.value.base, mods.value))
const physResult = computed(() =>
  physicalDamage(atkResult.value.value, calc.value.mult, calc.value.defense),
)
const artsResult = computed(() =>
  artsDamage(atkResult.value.value, calc.value.mult, calc.value.res / 100),
)

const round = (value) => Math.round(value * 100) / 100
</script>

<template>
  <div class="app">
    <header class="titlebar">
      <div class="brand">
        <span class="logo">◈</span>
        <h1>集成战略 · 伤害计算</h1>
      </div>
      <span class="version">v0.1 · 藏品算法预览</span>
    </header>

    <section class="stats">
      <div class="stat"><b>{{ stats.parsed }}</b><span>藏品</span></div>
      <div class="stat"><b>{{ stats.themes }}</b><span>主题段</span></div>
      <div class="stat"><b>{{ stats.effectLines }}</b><span>效果行</span></div>
      <div class="stat"><b>{{ stats.linesWithOperators }}</b><span>已标注运算</span></div>
      <div class="stat"><b>{{ stats.linesWithDifficulty }}</b><span>难度条件</span></div>
      <div class="stat license"><b>PRTS</b><span>CC BY-NC-SA 4.0</span></div>
    </section>

    <main class="layout">
      <aside class="panel list-panel">
        <div class="filters">
          <input v-model="keyword" class="search" placeholder="搜索藏品名称 / iconId" />
          <select v-model="topic" class="topic">
            <option value="">全部主题</option>
            <option v-for="item in topics" :key="item" :value="item">{{ item }}</option>
          </select>
        </div>
        <div class="count">共 {{ filtered.length }} 个藏品</div>
        <ul class="relic-list">
          <li
            v-for="relic in filtered"
            :key="relic.page"
            :class="{ active: selected && selected.page === relic.page }"
            @click="selectRelic(relic)"
          >
            <span class="relic-name">{{ relic.name }}</span>
            <span class="rarity" :class="rarityClass(relic.rarity)">{{ rarityLabel(relic.rarity) }}</span>
          </li>
        </ul>
      </aside>

      <section class="panel detail-panel">
        <div v-if="!selected" class="empty">
          <p>从左侧选择一个藏品</p>
          <p class="hint">共 {{ relics.length }} 个藏品已从 PRTS 解析入库</p>
        </div>

        <template v-else>
          <div class="detail-head">
            <div>
              <h2>{{ selected.name }}</h2>
              <p class="meta">{{ selected.iconId }} · 稀有度 {{ rarityLabel(selected.rarity) }}</p>
            </div>
            <span class="rarity big" :class="rarityClass(selected.rarity)">{{ rarityLabel(selected.rarity) }}</span>
          </div>
          <p class="description">{{ selected.description }}</p>

          <div class="theme-tabs">
            <button
              v-for="(theme, index) in selected.themes"
              :key="theme.topic"
              :class="{ active: activeTheme === index }"
              @click="activeTheme = index"
            >
              {{ theme.topic }}
            </button>
          </div>

          <div v-if="selected.themes[activeTheme]" class="theme-body">
            <div class="theme-meta">
              <span v-if="selected.themes[activeTheme].price">售价 {{ selected.themes[activeTheme].price }}</span>
              <span v-for="badge in selected.themes[activeTheme].badges" :key="badge" class="badge">{{ badge }}</span>
            </div>

            <div
              v-for="(line, index) in selected.themes[activeTheme].effectLines"
              :key="index"
              class="effect-line"
            >
              <div class="line-head">
                <span v-if="line.difficulty !== null" class="tag diff">难度 {{ line.difficulty }}+</span>
                <span v-if="line.variant" class="tag variant">{{ line.variant }}</span>
              </div>
              <p class="effect-text" v-html="formatLine(line.text)"></p>
              <div v-if="line.ops.length" class="op-tags">
                <span
                  v-for="(op, opIndex) in line.ops"
                  :key="opIndex"
                  class="op-tag"
                  :style="{ color: opColor[op.op], borderColor: opColor[op.op] + '55' }"
                >
                  {{ op.kind }} {{ op.display }}
                </span>
              </div>
            </div>

            <p v-if="selected.note" class="note">备注：{{ selected.note }}</p>
          </div>
        </template>
      </section>

      <aside class="panel calc-panel">
        <h3>伤害试算</h3>
        <p class="hint">按 PRTS 属性公式计算，仅作内核验证</p>

        <div class="calc-grid">
          <label>基础攻击力<input v-model.number="calc.base" type="number" /></label>
          <label>技能倍率<input v-model.number="calc.mult" type="number" step="0.05" /></label>
          <label>直接加算<input v-model.number="calc.directAdd" type="number" /></label>
          <label>直接乘算 %<input v-model.number="calc.directMul" type="number" /></label>
          <label>最终加算<input v-model.number="calc.finalAdd" type="number" /></label>
          <label>最终乘算 %<input v-model.number="calc.finalMul" type="number" /></label>
          <label>敌人防御<input v-model.number="calc.defense" type="number" /></label>
          <label>法术抗性 %<input v-model.number="calc.res" type="number" /></label>
        </div>

        <div class="result-block">
          <div class="result-row primary">
            <span>最终攻击力</span>
            <b>{{ round(atkResult.value) }}</b>
          </div>
          <details>
            <summary>计算明细</summary>
            <p v-for="step in atkResult.steps" :key="step.label" class="step">
              <span>{{ step.label }}</span>
              <code>{{ step.formula }} = {{ round(step.value) }}</code>
            </p>
          </details>
        </div>

        <div class="result-block">
          <div class="result-row">
            <span>物理伤害</span>
            <b class="phys">{{ round(physResult.value) }}</b>
          </div>
          <div class="result-row">
            <span>法术伤害</span>
            <b class="arts">{{ round(artsResult.value) }}</b>
          </div>
        </div>

        <p class="footnote">数值未含藏品实战加成，藏品规则库下一步接入</p>
      </aside>
    </main>
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px 20px 20px;
  gap: 14px;
}

.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-radius: 18px;
  background: linear-gradient(120deg, rgba(168, 85, 247, 0.28), rgba(34, 211, 238, 0.22) 55%, rgba(244, 114, 182, 0.22));
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 32px rgba(99, 102, 241, 0.25), inset 0 0 24px rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(14px);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo {
  font-size: 20px;
  color: var(--cyan);
  text-shadow: 0 0 12px rgba(34, 211, 238, 0.8);
}

h1 {
  margin: 0;
  font-size: 18px;
  letter-spacing: 2px;
  font-weight: 600;
}

.version {
  font-size: 12px;
  color: #c7d2fe;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 12px;
  background: var(--panel);
  border: 1px solid var(--line);
}

.stat b {
  font-size: 16px;
  color: var(--cyan);
}

.stat span {
  font-size: 12px;
  color: var(--muted);
}

.stat.license b {
  color: var(--amber);
}

.layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 340px;
  gap: 14px;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 14px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(10px);
}

.list-panel {
  overflow: hidden;
}

.filters {
  display: flex;
  gap: 8px;
  flex-direction: column;
}

.search,
.topic {
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(8, 12, 20, 0.7);
  outline: none;
}

.search:focus,
.topic:focus {
  border-color: rgba(34, 211, 238, 0.5);
  box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.12);
}

.count {
  margin: 10px 2px 6px;
  font-size: 12px;
  color: var(--muted);
}

.relic-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.relic-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: 0.15s;
}

.relic-list li:hover {
  background: rgba(59, 130, 246, 0.1);
}

.relic-list li.active {
  background: linear-gradient(90deg, rgba(34, 211, 238, 0.18), rgba(168, 85, 247, 0.18));
  border-color: rgba(34, 211, 238, 0.35);
}

.relic-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rarity {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid transparent;
  flex-shrink: 0;
}

.rarity.n {
  color: #94a3b8;
  border-color: #94a3b855;
}

.rarity.r {
  color: #38bdf8;
  border-color: #38bdf855;
}

.rarity.sr {
  color: var(--amber);
  border-color: #fbbf2455;
}

.rarity.big {
  font-size: 14px;
  padding: 4px 12px;
}

.detail-panel {
  overflow-y: auto;
}

.empty {
  margin: auto;
  text-align: center;
  color: var(--muted);
}

.empty .hint,
.hint {
  font-size: 12px;
  color: var(--muted);
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.detail-head h2 {
  margin: 0 0 4px;
  font-size: 20px;
}

.meta {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.description {
  margin: 12px 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(8, 12, 20, 0.55);
  border-left: 3px solid rgba(168, 85, 247, 0.6);
  color: #b6c2d4;
  font-size: 13px;
  line-height: 1.6;
}

.theme-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.theme-tabs button {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(8, 12, 20, 0.6);
  cursor: pointer;
  font-size: 12px;
  color: var(--muted);
  transition: 0.15s;
}

.theme-tabs button.active {
  color: #e0f2fe;
  background: linear-gradient(90deg, rgba(34, 211, 238, 0.24), rgba(168, 85, 247, 0.24));
  border-color: rgba(34, 211, 238, 0.45);
}

.theme-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--muted);
}

.badge {
  padding: 2px 8px;
  border-radius: 6px;
  background: rgba(250, 204, 21, 0.12);
  color: #fbbf24;
}

.effect-line {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(8, 12, 20, 0.5);
  border: 1px solid rgba(96, 165, 250, 0.1);
  margin-bottom: 8px;
}

.line-head {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.tag {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 6px;
}

.tag.diff {
  background: rgba(168, 85, 247, 0.18);
  color: #c4b5fd;
}

.tag.variant {
  background: rgba(34, 211, 238, 0.14);
  color: #67e8f9;
}

.effect-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
}

.op-chip {
  display: inline-block;
  padding: 0 6px;
  margin: 0 2px;
  border-radius: 6px;
  border: 1px solid;
  font-size: 12px;
  font-weight: 600;
}

.op-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.op-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid;
  background: rgba(8, 12, 20, 0.5);
}

.note {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
  border-top: 1px dashed var(--line);
  padding-top: 10px;
}

.calc-panel h3 {
  margin: 0 0 4px;
  font-size: 15px;
}

.calc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 12px 0;
}

.calc-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--muted);
}

.calc-grid input {
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(8, 12, 20, 0.7);
  font-size: 13px;
  outline: none;
}

.calc-grid input:focus {
  border-color: rgba(34, 211, 238, 0.5);
}

.result-block {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(8, 12, 20, 0.55);
  border: 1px solid var(--line);
  margin-bottom: 10px;
}

.result-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 13px;
  color: var(--muted);
}

.result-row b {
  font-size: 18px;
  color: var(--text);
}

.result-row.primary b {
  color: var(--cyan);
  text-shadow: 0 0 14px rgba(34, 211, 238, 0.5);
}

.result-row .phys {
  color: #f97316;
}

.result-row .arts {
  color: #818cf8;
}

details summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--cyan);
  margin-top: 6px;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 6px 0;
  font-size: 11px;
  color: var(--muted);
}

.step code {
  color: #a5b4fc;
}

.footnote {
  margin: auto 0 0;
  font-size: 11px;
  color: var(--muted);
  line-height: 1.6;
}
</style>