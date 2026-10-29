import { mkdir, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const API = 'https://prts.wiki/api.php'
const UA = 'ArknightsDamageCalc/0.1 (personal research tool; non-commercial)'
const CATEGORY = '分类:收藏品'
const OUT_DIR = join(process.cwd(), 'data', 'raw', 'prts')
const BATCH_SIZE = 20
const REQUEST_DELAY_MS = 400

const argv = process.argv.slice(2)
const limitArg = argv.indexOf('--limit')
const LIMIT = limitArg >= 0 ? Number(argv[limitArg + 1]) : Infinity

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function api(params) {
  const query = new URLSearchParams({ format: 'json', formatversion: '2', ...params })
  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${API}?${query}`, { headers: { 'User-Agent': UA } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return await response.json()
    } catch (error) {
      lastError = error
      if (attempt < 3) await sleep(1000 * attempt)
    }
  }
  throw lastError
}

function safeFileName(title) {
  return title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 120)
}

async function listCategoryTitles() {
  const titles = []
  let continuation = null
  do {
    const params = {
      action: 'query',
      list: 'categorymembers',
      cmtitle: CATEGORY,
      cmnamespace: '0',
      cmlimit: '500',
    }
    if (continuation) params.cmcontinue = continuation
    const data = await api(params)
    titles.push(...data.query.categorymembers.map((item) => item.title))
    continuation = data.continue?.cmcontinue
    process.stdout.write(`\r枚举分类: ${titles.length} 条`)
    if (continuation) await sleep(REQUEST_DELAY_MS)
  } while (continuation)
  process.stdout.write('\n')
  return titles
}

async function fetchBatch(titles) {
  const data = await api({
    action: 'query',
    prop: 'revisions',
    rvslots: 'main',
    rvprop: 'content',
    titles: titles.join('|'),
  })
  let saved = 0
  for (const page of data.query.pages) {
    if (page.missing) {
      console.warn(`\n跳过缺失页面: ${page.title}`)
      continue
    }
    const content = page.revisions?.[0]?.slots?.main?.content
    if (!content) continue
    await writeFile(join(OUT_DIR, `${safeFileName(page.title)}.txt`), content, 'utf8')
    saved += 1
  }
  return saved
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const titles = await listCategoryTitles()
  console.log(`分类内共 ${titles.length} 个页面`)

  const existing = new Set(
    (await readdir(OUT_DIR)).filter((name) => name.endsWith('.txt')).map((name) => name.slice(0, -4)),
  )

  const pending = []
  for (const title of titles) {
    if (pending.length >= LIMIT) break
    if (!existing.has(safeFileName(title))) pending.push(title)
  }

  if (pending.length === 0) {
    console.log('没有需要抓取的页面，全部已存在')
    return
  }

  console.log(`待抓取 ${pending.length} 个页面（已存在 ${existing.size} 个）`)
  let savedTotal = 0
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE)
    const saved = await fetchBatch(batch)
    savedTotal += saved
    const done = Math.min(i + BATCH_SIZE, pending.length)
    console.log(`进度 ${done}/${pending.length}，本次保存 ${saved}，累计 ${savedTotal}`)
    if (done < pending.length) await sleep(REQUEST_DELAY_MS)
  }
  console.log(`完成，共保存 ${savedTotal} 个页面到 ${OUT_DIR}`)
}

main().catch((error) => {
  console.error('抓取失败:', error)
  process.exitCode = 1
})