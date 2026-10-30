export function computeAttackInterval(baseAttackTime, attackSpeed) {
  const speed = Number.isFinite(attackSpeed) ? attackSpeed : 100
  const base = Number.isFinite(baseAttackTime) ? baseAttackTime : 1
  if (speed <= 0) return Number.POSITIVE_INFINITY
  return (base * 100) / speed
}

export function computeDps(damagePerHit, interval) {
  if (!Number.isFinite(interval) || interval <= 0) return 0
  return damagePerHit / interval
}

export function computeDpsMetrics({ baseAttackTime, attackSpeed, damagePerHit }) {
  const interval = computeAttackInterval(baseAttackTime, attackSpeed)
  const dps = computeDps(damagePerHit, interval)
  const steps = [
    {
      label: '攻击间隔',
      formula: `${round(baseAttackTime)} × 100 ÷ ${round(attackSpeed)}`,
      value: interval,
    },
    {
      label: 'DPS',
      formula: `${round(damagePerHit)} ÷ ${round(interval)}`,
      value: dps,
    },
  ]
  return { interval, dps, attackSpeed, baseAttackTime, damagePerHit, steps }
}

export function computeSkillCycleDps({
  activeDps = 0,
  normalDps = 0,
  duration = 0,
  spCost = 0,
  initSp = 0,
  spRecovery = 1,
}) {
  const safeRecovery = spRecovery > 0 ? spRecovery : 1
  const safeDuration = duration > 0 ? duration : 0
  const chargeTime = Math.max(0, (spCost - initSp) / safeRecovery)
  const cycle = chargeTime + safeDuration
  if (cycle <= 0) {
    return { activeDps, normalDps, chargeTime: 0, cycle: 0, uptime: 1, averageDps: activeDps, steps: [] }
  }
  const activeDamage = activeDps * safeDuration
  const normalDamage = normalDps * chargeTime
  const averageDps = (activeDamage + normalDamage) / cycle
  const uptime = safeDuration / cycle
  const steps = [
    {
      label: '充能时间',
      formula: `(${round(spCost)} − ${round(initSp)}) ÷ ${round(safeRecovery)}`,
      value: chargeTime,
    },
    {
      label: '技能期间 DPS',
      formula: `${round(activeDps)}`,
      value: activeDps,
    },
    {
      label: '循环平均 DPS',
      formula: `(${round(activeDps)} × ${round(safeDuration)} + ${round(normalDps)} × ${round(chargeTime)}) ÷ ${round(cycle)}`,
      value: averageDps,
    },
  ]
  return { activeDps, normalDps, chargeTime, cycle, uptime, averageDps, steps }
}

function round(value) {
  return Math.round(value * 10000) / 10000
}