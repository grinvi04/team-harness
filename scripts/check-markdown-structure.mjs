#!/usr/bin/env node
// Structural checks only: ownership, line budget and real local references.
import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ignoredDirectories = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'target', 'vendor', '.venv', 'venv', '.superpowers', '__pycache__'])
export const physicalLines = text => text.length ? text.split('\n').length - Number(text.endsWith('\n')) : 0

function prose(text, stripInline = true) {
  let fence = null
  return text.split('\n').map(line => {
    const match = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (match) {
      if (!fence) fence = match[1]
      else if (match[1][0] === fence[0] && match[1].length >= fence.length) fence = null
      return ''
    }
    return fence ? '' : stripInline ? line.replace(/(`+)[\s\S]*?\1/g, '') : line
  }).join('\n')
}

function anchors(text) {
  const result = new Set()
  const counts = new Map()
  for (const line of prose(text, false).split('\n')) {
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/)
    if (heading) {
      const slug = heading[1].replace(/<[^>]*>/g, '').toLowerCase()
        .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-')
      const count = counts.get(slug) || 0
      result.add(count ? `${slug}-${count}` : slug)
      counts.set(slug, count + 1)
    }
    for (const match of line.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) result.add(match[1])
  }
  return result
}

function references(text) {
  const plain = prose(text)
  const result = []
  for (const match of plain.matchAll(/\]\((<[^>]+>|[^\s)]*(?:\([^()\n]*\)[^\s)]*)*)(?:[ \t]+["'][^\n]*["'])?\)/g)) {
    result.push(match[1].replace(/^<|>$/g, ''))
  }
  for (const match of plain.matchAll(/^\s{0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm)) {
    result.push(match[1].replace(/^<|>$/g, ''))
  }
  return result
}

export function checkStructure({ roots, files = [], virtualRoots = new Map() }) {
  const owned = new Set(files.map(file => path.resolve(file)))
  const excluded = []
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) { excluded.push({ path: file, reason: 'symlink is not owned traversal' }); continue }
      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name)) excluded.push({ path: file, reason: 'dependency, build output or task scratch' })
        else walk(file)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) owned.add(file)
    }
  }
  for (const root of roots) walk(path.resolve(root))
  const failures = []
  const inventory = []
  const cachedAnchors = new Map()
  for (const file of [...owned].sort()) {
    if (!existsSync(file) || !lstatSync(file).isFile()) { failures.push(`${file}: owned file missing or not regular`); continue }
    const text = readFileSync(file, 'utf8')
    const lines = physicalLines(text)
    inventory.push({ path: file, lines, bytes: Buffer.byteLength(text) })
    if (lines > 199) failures.push(`${file}: ${lines} physical lines exceeds 199`)
    for (const reference of references(text)) {
      if (!reference || /^[a-zA-Z][a-zA-Z0-9+.-]*:|^\/\//.test(reference)) continue
      const separator = reference.indexOf('#')
      const rawPath = (separator < 0 ? reference : reference.slice(0, separator)).split('?')[0]
      const rawAnchor = separator < 0 ? '' : reference.slice(separator + 1)
      let relative, anchor
      try { relative = decodeURIComponent(rawPath); anchor = decodeURIComponent(rawAnchor) }
      catch { failures.push(`${file}: invalid encoded link ${reference}`); continue }
      const base = virtualRoots.get(file) || path.dirname(file)
      const target = relative ? path.resolve(base, relative) : file
      if (!existsSync(target)) { failures.push(`${file}: missing link ${reference}`); continue }
      if (anchor && target.toLowerCase().endsWith('.md') && lstatSync(target).isFile()) {
        if (!cachedAnchors.has(target)) cachedAnchors.set(target, anchors(readFileSync(target, 'utf8')))
        if (!cachedAnchors.get(target).has(anchor)) failures.push(`${file}: missing anchor ${reference}`)
      }
    }
  }
  return { inventory, excluded, failures }
}

function main(args) {
  const roots = [], files = [], virtualRoots = new Map()
  let json = false
  for (let i = 0; i < args.length; i++) {
    const option = args[i]
    if (option === '--json') json = true
    else if (['--root', '--file', '--virtual-root'].includes(option) && args[i + 1]) {
      const value = args[++i]
      if (option === '--root') roots.push(value)
      else if (option === '--file') files.push(value)
      else {
        const separator = value.indexOf('=')
        if (separator < 1) throw new Error('--virtual-root requires source=directory')
        const source = path.resolve(roots[0] || '.', value.slice(0, separator))
        virtualRoots.set(source, path.resolve(value.slice(separator + 1)))
      }
    } else throw new Error(`unknown or incomplete option: ${option}`)
  }
  if (!roots.length && !files.length) roots.push('.')
  const result = checkStructure({ roots, files, virtualRoots })
  if (json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  else {
    for (const failure of result.failures) console.log(failure)
    console.log(`Markdown: ${result.inventory.length} owned files, ${result.failures.length} failures; dependency/build/task scratch excluded, explicit --file retained.`)
  }
  return result.failures.length ? 1 : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)) }
  catch (error) { console.error(`markdown-structure: ${error.message}`); process.exitCode = 2 }
}
