import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

const ROOT = process.cwd()
const LEVELS_DIR = join(ROOT, 'data', 'raw', 'gamedata', 'cn', 'gamedata', 'levels', 'obt', 'roguelike')
const TOPIC_TABLE = join(ROOT, 'data', 'raw', 'gamedata', 'cn', 'gamedata', 'excel', 'roguelike_topic_table.json')
const ENEMY_TABLE = join(ROOT, 'data', 'raw', 'gamedata', 'cn', 'gamedata', 'excel', 'enemy_handbook_table.json')
const OUT_FILE = join(ROOT, 'src', 'data', 'topicEnemies.json')

const TOPIC_DIR = {
  ro1: 'rogue_1',
  ro2: 'rogue_2',
  ro3: 'rogue_3',
  ro4: 'rogue_4',
  ro5: 'rogue_5',
  ro6: 'rogue_6',
}

const TOPIC_LABEL = {
  rogue_1: '傀影与猩红孤钻',
  rogue_2: '水月与深蓝之树',
  rogue_3: '探索者的银凇止境',
  rogue_4: '萨卡兹的无终奇语',
  rogue_5: '岁的界园志异',
  rogue_6: '沉沦者的黑流树海',
}

const asArray = (value) => (Array.isArray(value) ? value : [])

async function main() {
  const topicTable = JSON.parse(await readFile(TOPIC_TABLE, 'utf8'))
  const enemyTable = JSON.parse(await readFile(ENEMY_TABLE, 'utf8'))
  const handbook = enemyTable.enemyData ?? {}

  const bossStageLevels = new Set()
  for (const [topicKey, data] of Object.entries(topicTable.details ?? {})) {
    for (const stage of Object.values(data.stages ?? {})) {
      if (stage.isBoss || stage.isElite) {
        const levelId = String(stage.levelId ?? '').split('/').pop().toLowerCase()
        if (levelId) bossStageLevels.add(`${topicKey}|${levelId}`)
      }
    }
  }

  const output = {}
  const statLine = []

  for (const [dirName, topicKey] of Object.entries(TOPIC_DIR)) {
    const levelFiles = (await readdir(join(LEVELS_DIR, dirName))).filter((name) => name.endsWith('.json'))
    const seen = new Map()

    for (const file of levelFiles) {
      let level
      try {
        level = JSON.parse(await readFile(join(LEVELS_DIR, dirName, file), 'utf8'))
      } catch {
        continue
      }
      const isBossStage = bossStageLevels.has(`${topicKey}|${file.replace(/\.json$/, '').toLowerCase()}`)

      const collect = (id) => {
        if (!id || typeof id !== 'string') return
        const current = seen.get(id) ?? { inBossStage: false }
        if (isBossStage) current.inBossStage = true
        seen.set(id, current)
      }

      for (const ref of asArray(level.enemyDbRefs)) collect(ref.id)
      for (const inst of asArray(level.predefines?.enemyInsts)) collect(inst.id ?? inst.enemyId)
      for (const inst of asArray(level.hardPredefines?.enemyInsts)) collect(inst.id ?? inst.enemyId)
      for (const enemy of asArray(level.enemies)) collect(enemy.id)
    }

    const enemies = []
    for (const [id, info] of seen.entries()) {
      const entry = handbook[id]
      if (!entry) continue
      enemies.push({
        id,
        name: entry.name,
        level: entry.enemyLevel ?? 'NORMAL',
        inBossStage: info.inBossStage,
      })
    }

    const byLevel = { BOSS: 0, ELITE: 0, NORMAL: 0 }
    for (const enemy of enemies) byLevel[enemy.level] = (byLevel[enemy.level] ?? 0) + 1

    enemies.sort((a, b) => {
      const pin = (e) => (e.level === 'BOSS' ? 0 : e.level === 'ELITE' ? 1 : 2)
      if (pin(a) !== pin(b)) return pin(a) - pin(b)
      if (a.inBossStage !== b.inBossStage) return a.inBossStage ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })

    output[topicKey] = {
      topic: TOPIC_LABEL[topicKey],
      total: enemies.length,
      counts: byLevel,
      enemies,
    }
    statLine.push(`${TOPIC_LABEL[topicKey]}: ${enemies.length} 敌（BOSS ${byLevel.BOSS} / ELITE ${byLevel.ELITE}）`)
  }

  const result = {
    meta: {
      source: 'ArknightsGamedata levels/obt/roguelike + enemy_handbook_table',
      generatedAt: new Date().toISOString(),
      note: 'inBossStage 表示出现在首领/精英关卡；排序 BOSS → ELITE → 普通，同级首领关优先',
    },
    topics: output,
  }

  await mkdir(join(ROOT, 'src', 'data'), { recursive: true })
  await writeFile(OUT_FILE, JSON.stringify(result), 'utf8')
  const info = await stat(OUT_FILE)

  console.log(statLine.join('\n'))
  console.log(`topicEnemies.json: ${(info.size / 1048576).toFixed(2)} MB`)
}

main().catch((error) => {
  console.error('生成失败:', error)
  process.exitCode = 1
})