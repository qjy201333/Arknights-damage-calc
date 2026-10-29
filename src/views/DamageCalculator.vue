<script setup>
import { computed, ref } from 'vue'
import operatorsData from '../data/operators.json'
import skillsData from '../data/skills.json'
import {
  computeOperatorPanel,
  getLevelCap,
  getSkillLevel,
  extractSkillMultiplier,
  ATTR_LABEL,
} from '../engine/operator.js'
import { physicalDamage, artsDamage } from '../engine/damage.js'

const operators = operatorsData.operators
const allSkills = skillsData.skills

const PROFESSION_LABEL = {
  PIONEER: '先锋',
  SNIPER: '狙击',
  CASTER: '术师',
  MEDIC: '医疗',
  SUPPORT: '辅助',
  WARRIOR: '近卫',

  SPECIAL: '特种',
  TANK: '重装',
}

const keyword = ref('')
const profession = ref('')
const selected = ref(null)

const elite = ref(2)
const level = ref(90)
const potential = ref(6)
const trust = ref(100)

const skillIndex = ref(0)
const skillLevel = ref(10)
const defense = ref(500)
const res = ref(20)
const damageType = ref('arts')

const filtered = computed(() => {
  const word = keyword.value.trim().toLowerCase()
  return operators.filter((op) => {
    const matchWord =
      !word ||
      op.name.toLowerCase().includes(word) ||
      (op.appellation ?? '').toLowerCase().includes(word) ||
      op.id.toLowerCase().includes(word)
    const matchProfession = !profession.value || op.profession === profession.value
    return matchWord && matchProfession
  })
})

const levelCap = computed(() => (selected.value ? getLevelCap(selected.value, elite.value) : 1))

const panel = computed(() => {
  if (!selected.value) return null
  return computeOperatorPanel(selected.value, {
    elite: elite.value,
    level: level.value,
    potential: Math.max(potential.value - 1, 0),
    trust: trust.value,
  })
})

const skillEntries = computed(() => {
  if (!selected.value) return []
  return selected.value.skills.map((entry) => ({
    ...entry,
    data: allSkills[entry.skillId],
    displayName: allSkills[entry.skillId]?.levels?.[9]?.name ?? allSkills[entry.skillId]?.levels?.[0]?.name ?? entry.skillId,
  }))
})

const currentSkill = computed(() => skillEntries.value[skillIndex.value] ?? null)
const currentSkillLevel = computed(() =>
  currentSkill.value ? getSkillLevel(currentSkill.value.data, skillLevel.value - 1) : null,
)
const multiplier = computed(() =>
  currentSkillLevel.value ? extractSkillMultiplier(currentSkillLevel.value.blackboard) : { key: null, value: 1 },
)

const atkValue = computed(() => panel.value?.attributes.atk ?? 0)
const physResult = computed(() => physicalDamage(atkValue.value, multiplier.value.value, defense.value))
const artsResult = computed(() => artsDamage(atkValue.value, multiplier.value.value, res.value / 100))
const finalDamage = computed(() =>
  damageType.value === 'physical' ? physResult.value : artsResult.value,
)

const talentList = computed(() => {
  if (!selected.value) return []
  const list = []
  for (const talent of selected.value.talents) {
    const candidates = talent.candidates ?? []
    const candidate = [...candidates].reverse().find((item) => phaseIndex(item.unlockCondition?.phase) <= elite.value)
    if (candidate) list.push(candidate)
  }
  return list
})

function phaseIndex(phase) {
  return ({ PHASE_0: 0, PHASE_1: 1, PHASE_2: 2 })[phase] ?? 0
}

function selectOperator(op) {
  selected.value = op
  skillIndex.value = 0
  skillLevel.value = 10
  elite.value = 2
  level.value = getLevelCap(op, 2)
}

function setElite(value) {
  elite.value = value
  level.value = Math.min(level.value, getLevelCap(selected.value, value))
}

function skillUnlockLabel(entry) {
  const phase = phaseIndex(entry.unlockCond?.phase)
  return phase === 0 ? '初始' : `精${phase}`
}

const round = (value) => Math.round(value * 100) / 100
const displayAttr = (key) => {
  const value = panel.value?.attributes?.[key]
  return value === undefined ? '—' : round(value)
}
</script>

<template>
  <div class="page">
    <aside class="panel list-panel">
      <div class="filters">
        <input v-model="keyword" class="search" placeholder="搜索干员名称 / 代号" />
        <select v-model="profession" class="topic">
          <option value="">全部职业</option>
          <option v-for="(label, key) in PROFESSION_LABEL" :key="key" :value="key">{{ label }}</option>
        </select>
      </div>
      <div class="count">共 {{ filtered.length }} 名六星</div>
      <ul class="op-list">
        <li
          v-for="op in filtered"
          :key="op.id"
          :class="{ active: selected && selected.id === op.id }"
          @click="selectOperator(op)"
        >
          <span class="op-name">{{ op.name }}</span>
          <span class="op-prof">{{ PROFESSION_LABEL[op.profession] ?? op.profession }}</span>
        </li>
      </ul>
    </aside>

    <section class="panel detail-panel">
      <div v-if="!selected" class="empty">
        <p>从左侧选择一名六星干员</p>
        <p class="hint">面板数据来自游戏 excel 表，按等级线性插值</p>
      </div>

      <template v-else>
        <div class="detail-head">
          <div>
            <h2>{{ selected.name }}</h2>
            <p class="meta">
              {{ selected.appellation }} · {{ PROFESSION_LABEL[selected.profession] }} ·
              {{ selected.subProfessionId }}
            </p>
          </div>
          <span class="rarity">六星</span>
        </div>

        <div class="control-row">
          <div class="seg">
            <button v-for="value in [0, 1, 2]" :key="value" :class="{ active: elite === value }" @click="setElite(value)">
              精{{ value }}
            </button>
          </div>
          <label class="inline">等级
            <input v-model.number="level" type="number" :min="1" :max="levelCap" />
            <span class="muted">/ {{ levelCap }}</span>
          </label>
          <label class="inline">潜能
            <input v-model.number="potential" type="number" :min="1" :max="6" />
          </label>
          <label class="inline">信赖
            <input v-model.number="trust" type="number" :min="0" :max="100" />
          </label>
        </div>

        <div class="attr-grid">
          <div v-for="key in ['atk', 'maxHp', 'def', 'magicResistance', 'cost', 'blockCnt', 'attackSpeed', 'baseAttackTime']" :key="key" class="attr">
            <span>{{ ATTR_LABEL[key] }}</span>
            <b>{{ displayAttr(key) }}</b>
          </div>
        </div>

        <h3>技能</h3>
        <div class="skill-list">
          <button
            v-for="(entry, index) in skillEntries"
            :key="entry.skillId"
            :class="{ active: skillIndex === index }"
            @click="skillIndex = index"
          >
            <span>{{ entry.displayName }}</span>
            <em>{{ skillUnlockLabel(entry) }}</em>
          </button>
        </div>

        <div v-if="currentSkillLevel" class="skill-detail">
          <p class="skill-desc">{{ currentSkillLevel.description }}</p>
          <div class="skill-meta">
            <span>SP：{{ currentSkillLevel.spData?.initSp ?? 0 }} / {{ currentSkillLevel.spData?.spCost ?? '—' }}（{{ currentSkillLevel.spData?.spType }}）</span>
            <span>持续：{{ currentSkillLevel.duration ?? '—' }}s</span>
            <span v-if="multiplier.key">倍率 {{ multiplier.value }}</span>
          </div>
        </div>

        <h3>天赋</h3>
        <div class="talent-list">
          <div v-for="(talent, index) in talentList" :key="index" class="talent">
            <b>{{ talent.name }}</b>
            <p>{{ talent.description }}</p>
          </div>
          <p v-if="!talentList.length" class="hint">当前精英化阶段暂无可显示天赋</p>
        </div>
      </template>
    </section>

    <aside class="panel result-panel">
      <h3>伤害计算</h3>
      <p class="hint">面板 + 技能倍率 + 敌人减免</p>

      <div class="seg full">
        <button :class="{ active: damageType === 'physical' }" @click="damageType = 'physical'">物理</button>
        <button :class="{ active: damageType === 'arts' }" @click="damageType = 'arts'">法术</button>
      </div>

      <div class="calc-grid">
        <label>技能等级 1–10<input v-model.number="skillLevel" type="number" :min="1" :max="10" /></label>
        <label>敌人防御<input v-model.number="defense" type="number" /></label>
        <label>法术抗性 %<input v-model.number="res" type="number" /></label>
      </div>

      <div class="result-block">
        <div class="result-row primary">
          <span>最终攻击力</span>
          <b>{{ round(atkValue) }}</b>
        </div>
        <div class="result-row">
          <span>技能倍率</span>
          <b>{{ multiplier.value }}</b>
        </div>
        <div class="result-row">
          <span>{{ damageType === 'physical' ? '物理伤害' : '法术伤害' }}</span>
          <b :class="damageType === 'physical' ? 'phys' : 'arts'">{{ round(finalDamage.value) }}</b>
        </div>
      </div>

      <details open>
        <summary>计算明细</summary>
        <p v-for="step in finalDamage.steps" :key="step.label" class="step">
          <span>{{ step.label }}</span>
          <code>{{ step.formula }} = {{ round(step.value) }}</code>
        </p>
      </details>

      <p class="footnote">天赋与藏品的数值化效果尚未接入，当前仅计算面板 × 技能倍率</p>
    </aside>
  </div>
</template>

<style scoped>
.page {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 340px;
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
  flex-direction: column;
  gap: 8px;
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
}

.count {
  margin: 10px 2px 6px;
  font-size: 12px;
  color: var(--muted);
}

.op-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.op-list li {
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

.op-list li:hover {
  background: rgba(59, 130, 246, 0.1);
}

.op-list li.active {
  background: linear-gradient(90deg, rgba(34, 211, 238, 0.18), rgba(168, 85, 247, 0.18));
  border-color: rgba(34, 211, 238, 0.35);
}

.op-name {
  font-size: 13px;
}

.op-prof {
  font-size: 11px;
  color: var(--muted);
}

.detail-panel,
.result-panel {
  overflow-y: auto;
}

.empty {
  margin: auto;
  text-align: center;
  color: var(--muted);
}

.hint {
  font-size: 12px;
  color: var(--muted);
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
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

.rarity {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: 999px;
  color: var(--amber);
  border: 1px solid #fbbf2455;
}

.control-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin: 14px 0 12px;
}

.seg {
  display: flex;
  gap: 4px;
  padding: 3px;
  border-radius: 10px;
  background: rgba(8, 12, 20, 0.6);
  border: 1px solid var(--line);
}

.seg.full {
  width: 100%;
  margin-bottom: 12px;
}

.seg button {
  padding: 5px 14px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 12px;
  transition: 0.15s;
}

.seg button.active {
  background: linear-gradient(90deg, rgba(34, 211, 238, 0.3), rgba(168, 85, 247, 0.3));
  color: #fff;
}

.inline {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}

.inline input {
  width: 68px;
  padding: 5px 8px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(8, 12, 20, 0.7);
  font-size: 13px;
  outline: none;
}

.muted {
  color: var(--muted);
}

.attr-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 16px;
}

.attr {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 12px;
  border-radius: 12px;
  background: rgba(8, 12, 20, 0.55);
  border: 1px solid var(--line);
}

.attr span {
  font-size: 11px;
  color: var(--muted);
}

.attr b {
  font-size: 16px;
  color: var(--cyan);
}

h3 {
  margin: 4px 0 8px;
  font-size: 14px;
}

.skill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.skill-list button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: rgba(8, 12, 20, 0.6);
  color: var(--muted);
  cursor: pointer;
  font-size: 13px;
  transition: 0.15s;
}

.skill-list button.active {
  color: #fff;
  background: linear-gradient(90deg, rgba(34, 211, 238, 0.22), rgba(168, 85, 247, 0.22));
  border-color: rgba(34, 211, 238, 0.45);
}

.skill-list em {
  font-style: normal;
  font-size: 11px;
  opacity: 0.7;
}

.skill-detail {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(8, 12, 20, 0.5);
  border-left: 3px solid rgba(34, 211, 238, 0.6);
  margin-bottom: 16px;
}

.skill-desc {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.7;
  color: #b6c2d4;
  white-space: pre-wrap;
}

.skill-meta {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--muted);
}

.talent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.talent {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(8, 12, 20, 0.5);
  border: 1px dashed rgba(168, 85, 247, 0.35);
}

.talent b {
  font-size: 13px;
  color: #c4b5fd;
}

.talent p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #b6c2d4;
  line-height: 1.6;
}

.result-panel h3 {
  margin-bottom: 4px;
}

.calc-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin: 12px 0;
}

.calc-grid label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--muted);
  gap: 10px;
}

.calc-grid input {
  width: 110px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(8, 12, 20, 0.7);
  font-size: 13px;
  outline: none;
  text-align: right;
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
  padding: 5px 0;
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
  margin: 6px 0;
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