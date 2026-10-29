export function computeManualDamage(input) {
  const {
    base = 0,
    addRatio = 0,
    mulRatio = 0,
    finalAdd = 0,
    atkScale = 1,
    dmgScale = 1,
    def = 0,
    defCut = 0,
    dmgReduction = 0,
    enemyDefBonus = 0,
    enemyDefPct = 0,
    enemyReductionBonus = 0,
  } = input

  const steps = []
  let value = base
  steps.push({ label: '基础面板', formula: `${round(base)}`, value })

  value = value * (1 + addRatio)
  steps.push({ label: '直接加算倍率', formula: `${round(base)} × (1 + ${addRatio})`, value })

  const beforeMul = value
  value = value * (1 + mulRatio)
  steps.push({
    label: '直接乘算倍率',
    formula: `${round(beforeMul)} × (1 + ${mulRatio})`,
    value,
  })

  const beforeFinalAdd = value
  value = value + finalAdd
  steps.push({
    label: '最终加算',
    formula: `${round(beforeFinalAdd)} + ${round(finalAdd)}`,
    value,
  })
  const attack = value

  const beforeScale = value
  value = value * atkScale
  steps.push({ label: '攻击力倍率', formula: `${round(beforeScale)} × ${atkScale}`, value })

  const scaled = value
  const baseDef = def + enemyDefBonus
  const effectiveDef = baseDef * (1 + enemyDefPct) * (1 - defCut)
  value = value - effectiveDef
  steps.push({
    label: '减防',
    formula: `${round(scaled)} − ${round(baseDef)} × (1 ${enemyDefPct >= 0 ? '+' : '−'} ${round(Math.abs(enemyDefPct))}) × (1 − ${defCut}) = ${round(scaled)} − ${round(effectiveDef)}`,
    value,
  })

  const beforeDmg = value
  value = value * dmgScale
  steps.push({ label: '最终乘算（伤害倍率）', formula: `${round(beforeDmg)} × ${dmgScale}`, value })

  const beforeReduction = value
  const totalReduction = dmgReduction + enemyReductionBonus
  value = value * (1 - totalReduction)
  steps.push({
    label: '减伤',
    formula: `${round(beforeReduction)} × (1 − ${round(totalReduction)})`,
    value,
  })

  const floor = scaled * 0.05
  const floorTriggered = value < floor
  const finalDamage = floorTriggered ? floor : value
  if (floorTriggered) {
    steps.push({ label: '最低保底', formula: `max(${round(value)}, ${round(scaled)} × 5%)`, value: floor })
  }

  return { attack, finalDamage, floor, floorTriggered, steps }
}

function round(value) {
  return Math.round(value * 10000) / 10000
}