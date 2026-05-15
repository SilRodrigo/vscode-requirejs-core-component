/**
 * Isolated test for NS navigation logic without requiring VS Code process.
 * Run with: node test/nsNavigation.unit.test.js
 */
'use strict'

const assert = require('assert')
const { join } = require('path')
const { readFileSync } = require('fs')
const vm = require('vm')

const testFilesRoot = join(__dirname, '../testFiles')

// ─── Reproduce the exact parsing logic from definitionProvider.getNsNavigationMappings ───

function normalizePathPrefix (path) {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function loadMappings (configPath) {
  const fileContent = readFileSync(configPath, 'utf8')
  let config
  try {
    config = JSON.parse(fileContent)
  } catch (_jsonError) {
    try {
      const sandbox = { module: { exports: {} } }
      vm.runInNewContext(fileContent, sandbox)
      config = sandbox.module.exports
    } catch (_vmError) {
      return null
    }
  }
  return config
}

function resolveNsComponent (configPath, currentModulePath) {
  const config = loadMappings(configPath)
  if (!config) return { error: 'config load failed' }

  const mappings = (config.mappings || [])
    .filter(m => m && typeof m.nsComponent === 'string')
    .map(m => {
      const scopeRoot = m.scopeRoot
      const scopeRoots = (Array.isArray(scopeRoot) ? scopeRoot : [scopeRoot])
        .filter(r => typeof r === 'string' && r.trim())
        .map(r => normalizePathPrefix(r.trim()))
      return { scopeRoots, nsComponent: m.nsComponent.trim() }
    })
    .filter(m => m.scopeRoots.length && m.nsComponent)

  const normalized = normalizePathPrefix(currentModulePath)
  let matched

  mappings.forEach(mapping => {
    mapping.scopeRoots.forEach(scopeRoot => {
      const hasMatch = normalized === scopeRoot || normalized.startsWith(scopeRoot + '/')
      if (!hasMatch) return
      if (!matched || scopeRoot.length > matched.scopeRoot.length) {
        matched = { scopeRoot, nsComponent: mapping.nsComponent }
      }
    })
  })

  return matched || null
}

// ─── Reproduce unresolveFilePath logic ───

function unresolveFilePath (filePath, baseUrl) {
  const modulePaths = []
  const normalizedBase = baseUrl.replace(/\\/g, '/').replace(/\/?$/, '/')
  const normalizedFile = filePath.replace(/\\/g, '/')

  if (normalizedFile.startsWith(normalizedBase)) {
    let rel = normalizedFile.substr(normalizedBase.length)
    if (rel.endsWith('.js')) rel = rel.slice(0, -3)
    modulePaths.push(rel)
  }
  return modulePaths
}

// ─── TESTS ───

let passed = 0
let failed = 0

function test (name, fn) {
  try {
    fn()
    console.log('  ✓', name)
    passed++
  } catch (err) {
    console.error('  ✗', name)
    console.error('    ', err.message)
    failed++
  }
}

console.log('\nNS Navigation Unit Tests\n')

const configPath = join(testFilesRoot, 'ns-navigation-config.js')

// 1. Config file parses correctly
test('config file loads via vm.runInNewContext', () => {
  const config = loadMappings(configPath)
  assert.ok(config, 'config should not be null')
  assert.ok(Array.isArray(config.mappings), 'config.mappings should be array')
  assert.equal(config.mappings.length, 1)
  assert.equal(config.mappings[0].scopeRoot, 'useNsModule')
  assert.equal(config.mappings[0].nsComponent, 'nsComponent')
})

// 2. unresolveFilePath returns correct module path
test('unresolveFilePath converts file path to module path', () => {
  const filePath = join(testFilesRoot, 'useNsModule.js').replace(/\\/g, '/')
  const baseUrl = testFilesRoot.replace(/\\/g, '/')
  const result = unresolveFilePath(filePath, baseUrl)
  assert.deepEqual(result, ['useNsModule'])
})

// 3. Scope matching works for exact match
test('resolveNsComponent matches exact scopeRoot', () => {
  const result = resolveNsComponent(configPath, 'useNsModule')
  assert.ok(result, 'should find a match')
  assert.equal(result.nsComponent, 'nsComponent')
})

// 4. Scope matching works for child paths
test('resolveNsComponent matches child of scopeRoot', () => {
  const result = resolveNsComponent(configPath, 'useNsModule/sub/file')
  assert.ok(result, 'should find a match for child path')
  assert.equal(result.nsComponent, 'nsComponent')
})

// 5. Non-matching path returns null
test('resolveNsComponent returns null for unmatched path', () => {
  const result = resolveNsComponent(configPath, 'otherModule')
  assert.equal(result, null)
})

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
