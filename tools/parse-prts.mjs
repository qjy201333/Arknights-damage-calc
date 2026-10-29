import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const RAW_DIR = join(process.cwd(), 'data', 'raw', 'prts')
const OUT_FILE = join(process.cwd(), 'data', 'relics.json')

const TEMPLATE_NAME = '收藏品/common'

const OP_TEMPLATES = new Map([
  ['+', '直接加算'],
  ['*', '直接乘算'],
  ['++', '最终加算'],
  ['**', '最终乘算'],
  ['r+', '藏品符文加算'],
  ['r*', '藏品符文乘算'],
  ['r**', '藏品符文最终乘算'],
])

const KEEP_FIRST_ARG = new Set(['修正'])
const KEEP_LAST_ARG = new Set(['color', '术语', 'abbr', 'ruby'])
const MECHANIC_TEMPLATE = '特殊机制'
const DROP_TEMPLATES = new Set(['mdi', 'popup', 'Cbox2', '收藏品/角标', 'color/block', '锚点'])

function findBalancedEnd(source, start) {
  let depth = 0
  for (let i = start; i < source.length - 1; i += 1) {
    if (source[i] === '{' && source[i + 1] === '{') {
      depth += 1
      i += 1
    } else if (source[i] === '}' && source[i + 1] === '}') {
      depth -= 1
      i += 1
      if (depth === 0) return i
    }
  }
  return -1
}

function splitTopLevel(body) {
  const parts = []
  let buffer = ''
  let curly = 0
  let square = 0
  for (let i = 0; i < body.length; i += 1) {
    const two = body.slice(i, i + 2)
    if (two === '{{') {
      curly += 1
      buffer += two
      i += 1
      continue
    }
    if (two === '}}') {
      curly -= 1
      buffer += two
      i += 1
      continue
    }
    if (two === '[[') {
      square += 1
      buffer += two
      i += 1
      continue
    }
    if (two === ']]') {
      square -= 1
      buffer += two
      i += 1
      continue
    }
    if (body[i] === '|' && curly === 0 && square === 0) {
      parts.push(buffer)
      buffer = ''
      continue
    }
    buffer += body[i]
  }
  parts.push(buffer)
  return parts
}

function parseTemplateBody(body) {
  const params = {}
  const segments = splitTopLevel(body)
  segments.forEach((segment, index) => {
    if (index === 0) return
    const trimmed = segment.trim()
    if (trimmed === '') return
    const eq = trimmed.indexOf('=')
    if (eq > 0) params[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  })
  return params
}

function collectTemplates(source, name) {
  const results = []
  const needle = `{{${name}`
  let cursor = 0
  while (true) {
    const start = source.indexOf(needle, cursor)
    if (start === -1) break
    const end = findBalancedEnd(source, start)
    if (end === -1) break
    results.push(source.slice(start, end + 1))
    cursor = end + 1
  }
  return results
}

function stripComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, '')
}

function normalizeLinks(text) {
  return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => label ?? target)
}

function renderInline(text, ctx) {
  const ops = []
  let output = ''
  let i = 0
  while (i < text.length) {
    if (text[i] === '{' && text[i + 1] === '{') {
      const end = findBalancedEnd(text, i)
      if (end === -1) {
        output += text.slice(i)
        break
      }
      const raw = text.slice(i, end + 1)
      const segments = splitTopLevel(raw.slice(2, -2))
      const templateName = segments[0].trim()
      const lowerName = templateName.toLowerCase()

      if (OP_TEMPLATES.has(lowerName)) {
        const display = segments[1] ? renderInline(segments[1].trim(), ctx).text.trim() : ''
        const expanded = segments[2] ? renderInline(segments[2].trim(), ctx).text.trim() : ''
        ops.push({ op: lowerName, kind: OP_TEMPLATES.get(lowerName), display, expanded })
        output += `〔${lowerName}:${display}〕`
      } else if (templateName === MECHANIC_TEMPLATE) {
        const mechanic = (segments[1] ?? '').trim()
        if (mechanic) ctx.mechanics.add(mechanic)
      } else if (KEEP_FIRST_ARG.has(templateName)) {
        if (segments[1]) output += renderInline(segments[1].trim(), ctx).text
      } else if (KEEP_LAST_ARG.has(templateName)) {
        const args = segments.slice(1).filter((segment) => segment.trim() !== '' && !segment.includes('='))
        if (args.length > 0) output += renderInline(args[args.length - 1].trim(), ctx).text
      } else if (!DROP_TEMPLATES.has(templateName)) {
        ctx.unknownTemplates.set(templateName, (ctx.unknownTemplates.get(templateName) ?? 0) + 1)
      }
      i = end + 1
      continue
    }
    output += text[i]
    i += 1
  }
  return { text: output, ops }
}

function splitEffectLines(effect) {
  return stripComments(effect)
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function parseEffect(effect, ctx) {
  const lines = []
  for (const rawLine of splitEffectLines(effect)) {
    const normalized = normalizeLinks(rawLine)
    const { text, ops } = renderInline(normalized, ctx)
    const difficultyMatch = text.match(/难度(\d+)及以上生效[:：]?/)
    const variantMatch = text.match(/【([^】]+)】/)
    let clean = text
    if (difficultyMatch) clean = clean.replace(difficultyMatch[0], '')
    if (variantMatch) clean = clean.replace(variantMatch[0], '')
    lines.push({
      difficulty: difficultyMatch ? Number(difficultyMatch[1]) : null,
      variant: variantMatch ? variantMatch[1] : null,
      text: clean.trim(),
      ops,
      raw: rawLine,
    })
  }
  return lines
}

function parseBadges(value) {
  if (!value) return []
  const badges = []
  for (const match of value.matchAll(/\{\{收藏品\/角标\|([^}|]+)\}\}/g)) badges.push(match[1].trim())
  return badges
}

function parseRelicPage(title, content, ctx) {
  const blocks = collectTemplates(content, TEMPLATE_NAME)
  if (blocks.length === 0) return null
  const params = parseTemplateBody(blocks[0].slice(2 + TEMPLATE_NAME.length, -2))

  const themes = []
  for (let index = 1; index <= 10; index += 1) {
    const topic = params[`主题${index}`]
    if (!topic) continue
    themes.push({
      topic: topic.trim(),
      price: params[`售价${index}`]?.trim() ?? null,
      badges: parseBadges(params[`角标${index}`]),
      effectLines: parseEffect(params[`效果${index}`] ?? '', ctx),
      effectRaw: params[`效果${index}`] ?? '',
      unlock: params[`解锁条件${index}`]?.trim() || null,
      obtain: params[`获取条件${index}`]?.trim() || null,
    })
  }

  return {
    page: title,
    name: params['名称']?.trim() ?? title,
    iconId: params['iconId']?.trim() ?? null,
    rarity: params['稀有度']?.trim() ?? null,
    description: params['描述']?.trim() ?? '',
    note: params['备注']?.trim() ?? null,
    themes,
  }
}

async function main() {
  let files
  try {
    files = (await readdir(RAW_DIR)).filter((name) => name.endsWith('.txt'))
  } catch {
    console.error(`未找到原始数据目录 ${RAW_DIR}，请先运行 npm run fetch:prts`)
    process.exitCode = 1
    return
  }

  const ctx = { unknownTemplates: new Map(), mechanics: new Set() }
  const relics = []
  const failed = []
  let lineTotal = 0
  let lineWithOps = 0
  let lineWithDifficulty = 0

  for (const file of files) {
    const content = await readFile(join(RAW_DIR, file), 'utf8')
    const title = file.slice(0, -4)
    const relic = parseRelicPage(title, content, ctx)
    if (!relic) {
      failed.push(title)
      continue
    }
    for (const theme of relic.themes) {
      for (const line of theme.effectLines) {
        lineTotal += 1
        if (line.ops.length > 0) lineWithOps += 1
        if (line.difficulty !== null) lineWithDifficulty += 1
      }
    }
    relics.push(relic)
  }

  relics.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

  const output = {
    meta: {
      source: 'https://prts.wiki/ (分类:收藏品)',
      license: 'CC BY-NC-SA 4.0',
      generatedAt: new Date().toISOString(),
      note: '由 tools/parse-prts.mjs 自动解析生成；无运算符标注的效果行需按规则库补全',
    },
    stats: {
      pages: files.length,
      parsed: relics.length,
      failed: failed.length,
      themes: relics.reduce((sum, relic) => sum + relic.themes.length, 0),
      effectLines: lineTotal,
      linesWithOperators: lineWithOps,
      linesWithDifficulty: lineWithDifficulty,
      mechanics: [...ctx.mechanics],
    },
    unknownTemplates: Object.fromEntries([...ctx.unknownTemplates.entries()].sort((a, b) => b[1] - a[1])),
    relics,
  }

  await mkdir(join(process.cwd(), 'data'), { recursive: true })
  await writeFile(OUT_FILE, JSON.stringify(output, null, 2), 'utf8')

  const percent = (part) => (lineTotal === 0 ? 0 : ((part / lineTotal) * 100).toFixed(1))
  console.log(`页面 ${files.length}，解析成功 ${relics.length}，失败 ${failed.length}`)
  console.log(`主题段 ${output.stats.themes}，效果行 ${lineTotal}`)
  console.log(`带运算符 ${lineWithOps}（${percent(lineWithOps)}%），带难度条件 ${lineWithDifficulty}（${percent(lineWithDifficulty)}%）`)
  console.log(`识别特殊机制 ${ctx.mechanics.size} 个`)
  const topUnknown = [...ctx.unknownTemplates.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  if (topUnknown.length > 0) console.log('未识别模板:', topUnknown.map(([name, count]) => `${name}×${count}`).join(', '))
  if (failed.length > 0) console.log('失败页面:', failed.slice(0, 10).join(', '))
  console.log(`已写入 ${OUT_FILE}`)
}

main().catch((error) => {
  console.error('解析失败:', error)
  process.exitCode = 1
})