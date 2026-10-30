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

export function computeSkillCycleDps({ damagePerHit, interval, duration, spCost, initSp = 0 }) {
  const activeDps = computeDps(damagePerHit, interval)
  const cycle = (spCost ?? 0) + (duration ?? 0)
  if (cycle <= 0) return { activeDps, averageDps: activeDps, cycle, uptime: 1 }
  const averageDps = initSp >= spCost ? activeDps * (duration / cycle) : activeDps * ((duration - 0) / cycle)
  return {
    activeDps,
    averageDps,
    cycle,
    uptime: duration / cycle,
    steps: [
      { label: '技能期间 DPS', formula: `${round(damagePerHit)} ÷ ${round(interval)}`, value: activeDps },
      {
        label: '循环平均 DPS',
        formula: `${round(activeDps)} × ${round(duration)} ÷ (${round(spCost)} + ${round(duration)})`,
        value: averageDps,
      },
    ],
  }
}

function round(value) {
  return Math.round(value * 10000) / 10000
}