const { workspace } = require('vscode')
const { readFileSync } = require('fs')

// Cache: fsPath -> { version, results }
const cache = new Map()

/**
 * Returns the name from the first <block> tag found (NOT referenceBlock).
 * Returns null if the document is an override file (has referenceBlock but no block).
 * @param {string} text
 * @returns {string|null}
 */
function getBlockName (text) {
  const m = text.match(/<block\b[^>]*\bname="([^"]+)"/)
  return m ? m[1] : null
}

/**
 * Finds all <item> elements that are direct children of any <item name="children">
 * at any depth, using indentation to determine the parent-child relationship.
 * @param {string} text
 * @returns {Array<{name: string, line: number}>}
 */
function findChildrenItems (text) {
  const lines = text.split('\n')
  const result = []
  const stack = [] // {childrenIndent, directChildIndent}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const indent = (line.match(/^(\s*)/)[1] || '').length

    while (stack.length && indent <= stack[stack.length - 1].childrenIndent) {
      stack.pop()
    }

    if (/<item\s[^>]*name="children"/.test(line)) {
      let j = i + 1
      while (j < lines.length && !lines[j].trim()) j++
      const directChildIndent = j < lines.length
        ? (lines[j].match(/^(\s*)/)[1] || '').length
        : indent + 4
      stack.push({ childrenIndent: indent, directChildIndent })
      continue
    }

    if (stack.length && indent === stack[stack.length - 1].directChildIndent) {
      const m = line.match(/<item\s[^>]*name="([^"]+)"/)
      if (m) result.push({ name: m[1], line: i })
    }
  }

  return result
}

/**
 * Returns the names of children items that a given override XML declares for a specific block.
 * @param {string} text XML content of the overriding file.
 * @param {string} blockName Block name to look for.
 * @returns {string[]}
 */
function getOverridingItemNames (text, blockName) {
  const escaped = blockName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!new RegExp(`<referenceBlock\\b[^>]*\\bname="${escaped}"`).test(text)) return []
  return findChildrenItems(text).map(item => item.name)
}

/**
 * Scans configured XML globs and returns override info for all children items
 * of the given document.
 * @param {import('vscode').TextDocument} document
 * @param {import('vscode').CancellationToken|null} cancellationToken
 * @returns {Promise<Array<{name: string, line: number, overridingFiles: Array<{uri: import('vscode').Uri, line: number}>}>>}
 */
async function findOverridesForDocument (document, cancellationToken) {
  const cached = cache.get(document.uri.fsPath)
  if (cached && cached.version === document.version) return cached.results

  const globs = workspace.getConfiguration('requireModuleSupport').get('xmlLayoutPaths') || []
  if (!globs.length) return []

  const text = document.getText()
  const blockName = getBlockName(text)
  if (!blockName) return []

  const childrenItems = findChildrenItems(text)
  if (!childrenItems.length) return []

  const uriArrays = await Promise.all(
    globs.map(glob => workspace.findFiles(glob, null, 5000, cancellationToken))
  )
  const allUris = [].concat(...uriArrays)
  const currentPath = document.uri.fsPath

  // Map: itemName -> [{uri, line}]
  const overrideMap = {}
  childrenItems.forEach(item => { overrideMap[item.name] = [] })

  for (const uri of allUris) {
    if (uri.fsPath === currentPath) continue
    if (cancellationToken && cancellationToken.isCancellationRequested) break

    try {
      const content = readFileSync(uri.fsPath, 'utf8')
      const names = getOverridingItemNames(content, blockName)
      if (!names.length) continue

      // Find the actual line of each item in the overriding file
      const overridingItems = findChildrenItems(content)
      names.forEach(name => {
        if (!(name in overrideMap)) return
        const found = overridingItems.find(i => i.name === name)
        overrideMap[name].push({ uri, line: found ? found.line : 0 })
      })
    } catch (_e) {
      // skip unreadable files
    }
  }

  const results = childrenItems
    .map(item => ({ name: item.name, line: item.line, overridingFiles: overrideMap[item.name] }))
    .filter(item => item.overridingFiles.length > 0)

  cache.set(document.uri.fsPath, { version: document.version, results })
  return results
}

/**
 * Searches for the <block name="blockName"> tag in XML files matching the configured globs.
 * @param {string} blockName
 * @param {string} excludeFsPath Current file to exclude.
 * @param {import('vscode').CancellationToken|null} cancellationToken
 * @returns {Promise<Array<{uri: import('vscode').Uri, line: number}>>}
 */
async function findBlockDefinitions (blockName, excludeFsPath, cancellationToken) {
  const globs = workspace.getConfiguration('requireModuleSupport').get('xmlLayoutPaths') || []
  if (!globs.length) return []

  const uriArrays = await Promise.all(
    globs.map(glob => workspace.findFiles(glob, null, 5000, cancellationToken || undefined))
  )
  const allUris = [].concat(...uriArrays)
  const escaped = blockName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`<block\\b[^>]*\\bname="${escaped}"`)
  const results = []

  for (const uri of allUris) {
    if (uri.fsPath === excludeFsPath) continue
    if (cancellationToken && cancellationToken.isCancellationRequested) break

    try {
      const content = readFileSync(uri.fsPath, 'utf8')
      if (!pattern.test(content)) continue
      const lines = content.split('\n')
      const lineIdx = lines.findIndex(l => pattern.test(l))
      if (lineIdx >= 0) results.push({ uri, line: lineIdx })
    } catch (_e) {}
  }

  return results
}

module.exports = { getBlockName, findChildrenItems, findOverridesForDocument, findBlockDefinitions }
