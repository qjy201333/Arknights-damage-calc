export const MOD_KINDS = {
  add: '直接加算',
  mul: '直接乘算',
  finalAdd: '最终加算',
  finalMul: '最终乘算',
  runeAdd: '藏品符文加算',
  runeMul: '藏品符文乘算',
  runeFinalMul: '藏品符文最终乘算',
}

export const PRTS_OP_TO_KIND = {
  '+': 'add',
  '*': 'mul',
  '++': 'finalAdd',
  '**': 'finalMul',
  'r+': 'runeAdd',
  'r*': 'runeMul',
  'r**': 'runeFinalMul',
}

function toPercentRatio(raw) {
  if (typeof raw === 'number') return raw
  if (!raw) return 0
  const text = String(raw).replace(/[%\s]/g, '').replace(/[（(]/g, '').replace(/[)）]/g, '')
  const value = Number(text)
  return Number.isFinite(value) ? value / 100 : 0
}

export function collectMods(ops) {
  const mods = []
  for (const item of ops ?? []) {
    const kind = PRTS_OP_TO_KIND[item.op]
    if (!kind) continue
    const source = item.display ?? item.expanded ?? ''
    const value = toPercentRatio(source)
    mods.push({ kind, value, source, label: item.kind ?? MOD_KINDS[kind] })
  }
  return mods
}

export function computeAttribute(base, mods = []) {
  const steps = []
  const sum = (kind) =>
    mods.filter((mod) => mod.kind === kind).reduce((total, mod) => total + mod.value, 0)
  const product = (kind) =>
    mods
      .filter((mod) => mod.kind === kind)
      .reduce((total, mod) => total * (mod.value < 0 ? mod.value + 1 : mod.value), 1)

  const directAdd = sum('add')
  const directMul = sum('mul')
  const finalAdd = sum('finalAdd')
  const finalMul = product('finalMul')

  const runeAdd = sum('runeAdd')
  const runeMul = 1 + sum('runeMul')
  const runeFinalMul = product('runeFinalMul')

  const afterDirectAdd = base + directAdd
  steps.push({ label: '直接加算', formula: `${base} + ${directAdd}`, value: afterDirectAdd })

  const mulFactor = 1 + directMul
  const afterDirectMul = afterDirectAdd * (mulFactor < 0 ? 0 : mulFactor)
  steps.push({
    label: '直接乘算',
    formula: `${afterDirectAdd} × (1 + ${directMul})`,
    value: afterDirectMul,
  })

  const afterFinalAdd = afterDirectMul + finalAdd
  steps.push({ label: '最终加算', formula: `${afterDirectMul} + ${finalAdd}`, value: afterFinalAdd })

  const afterFinalMul = afterFinalAdd * finalMul
  steps.push({ label: '最终乘算', formula: `${afterFinalAdd} × ${finalMul}`, value: afterFinalMul })

  const afterRuneAdd = afterFinalMul + runeAdd
  const afterRuneMul = afterRuneAdd * runeMul
  const afterRuneFinal = afterRuneMul * runeFinalMul
  if (runeAdd !== 0) {
    steps.push({ label: '藏品符文加算', formula: `${afterFinalMul} + ${runeAdd}`, value: afterRuneAdd })
  }
  if (runeMul !== 1) {
    steps.push({ label: '藏品符文乘算', formula: `${afterRuneAdd} × ${runeMul}`, value: afterRuneMul })
  }
  if (runeFinalMul !== 1) {
    steps.push({ label: '藏品符文最终乘算', formula: `${afterRuneMul} × ${runeFinalMul}`, value: afterRuneFinal })
  }

  return { value: afterRuneFinal, steps }
}

export function physicalDamage(atk, multiplier, defense) {
  const raw = atk * multiplier
  const floor = raw * 0.05
  const value = Math.max(raw - defense, floor)
  return {
    value,
    steps: [
      { label: '攻击力 × 倍率', formula: `${atk} × ${multiplier}`, value: raw },
      { label: '减防御', formula: `max(${raw} - ${defense}, ${raw} × 5%)`, value },
    ],
  }
}

export function artsDamage(atk, multiplier, resistance) {
  const raw = atk * multiplier
  const floor = raw * 0.05
  const afterRes = raw * (1 - resistance)
  const value = Math.max(afterRes, floor)
  return {
    value,
    steps: [
      { label: '攻击力 × 倍率', formula: `${atk} × ${multiplier}`, value: raw },
      { label: '减法术抗性', formula: `max(${raw} × (1 - ${resistance}), ${raw} × 5%)`, value },
    ],
  }
}

export function healAmount(atk, multiplier) {
  const value = atk * multiplier
  return { value, steps: [{ label: '治疗量', formula: `${atk} × ${multiplier}`, value }] }
}