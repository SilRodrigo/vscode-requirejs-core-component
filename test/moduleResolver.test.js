const test = require('tehanu')(__filename)
const assert = require('assert')
const proxyquire = require('proxyquire')
const { join, normalize } = require('path')
const { mkdirSync, writeFileSync, rmSync } = require('fs')
const os = require('os')

function createWorkspaceStub (rootPath) {
  const configValues = {
    modulePath: '',
    configFile: '',
    cutFileCompletionExtensions: ['.js'],
    pluginExtensions: {}
  }

  return {
    workspaceFile: null,
    workspaceFolders: [{ uri: { fsPath: rootPath } }],
    getConfiguration: () => ({
      get: key => configValues[key]
    }),
    onDidChangeConfiguration: () => ({
      dispose () {}
    }),
    createFileSystemWatcher: () => ({
      onDidChange: () => ({ dispose () {} }),
      onDidCreate: () => ({ dispose () {} }),
      onDidDelete: () => ({ dispose () {} }),
      dispose () {}
    })
  }
}

function createModuleResolver (rootPath) {
  const requirejsState = {
    baseUrl: ''
  }

  const requirejsStub = {
    s: { contexts: { _: {} } },
    config: config => {
      requirejsState.baseUrl = config.baseUrl || ''
    },
    toUrl: path => normalize(join(requirejsState.baseUrl, path))
  }

  const ModuleResolver = proxyquire('../src/moduleResolver', {
    vscode: {
      workspace: createWorkspaceStub(rootPath),
      window: {
        showErrorMessage () {}
      }
    },
    '@prantlf/requirejs': requirejsStub,
    '@prantlf/amodro-trace/config': {
      find: () => ({})
    },
    'vscode-nls': {
      config: () => () => {},
      loadMessageBundle: () => () => ''
    },
    './disposableHost': {
      addDisposable () {},
      disposeAll () {}
    },
    './nlsHelpers': {
      configureLocalization () {}
    }
  })

  return new ModuleResolver()
}

function createTempRoot () {
  const root = join(os.tmpdir(), `resolver-test-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(root, { recursive: true })
  return root
}

test('resolveModulePath should fall back to next configured path alias when first is missing', () => {
  const rootPath = createTempRoot()

  try {
    const resolver = createModuleResolver(rootPath)
    resolver.configuration.paths = {
      Galderma_Sales: [
        'vendor/galderma/theme-core-b2b/Galderma_Sales/web',
        'app/design/frontend/Webjump/theme-frontend-representatives/Galderma_Sales/web'
      ]
    }

    const existingDir = join(rootPath,
      'app/design/frontend/Webjump/theme-frontend-representatives/Galderma_Sales/web/js/view/order/create/family')
    mkdirSync(existingDir, { recursive: true })
    writeFileSync(join(existingDir, 'category.js'), 'define(function () {})')

    const filePath = resolver.resolveModulePath('Galderma_Sales/js/view/order/create/family/category',
      join(rootPath, 'any/current.js'))

    assert.equal(filePath, normalize(join(rootPath,
      'app/design/frontend/Webjump/theme-frontend-representatives/Galderma_Sales/web/js/view/order/create/family/category.js')))
  } finally {
    rmSync(rootPath, { recursive: true, force: true })
  }
})

test('resolveModulePath should keep first fallback when no file exists', () => {
  const rootPath = createTempRoot()

  try {
    const resolver = createModuleResolver(rootPath)
    resolver.configuration.paths = {
      Galderma_Sales: [
        'vendor/galderma/theme-core-b2b/Galderma_Sales/web',
        'app/design/frontend/Webjump/theme-frontend-representatives/Galderma_Sales/web'
      ]
    }

    const filePath = resolver.resolveModulePath('Galderma_Sales/js/view/order/create/family/category',
      join(rootPath, 'any/current.js'))

    assert.equal(filePath, normalize(join(rootPath,
      'vendor/galderma/theme-core-b2b/Galderma_Sales/web/js/view/order/create/family/category.js')))
  } finally {
    rmSync(rootPath, { recursive: true, force: true })
  }
})

test('unresolveFilePath should support aliases with multiple configured base paths', () => {
  const rootPath = createTempRoot()

  try {
    const resolver = createModuleResolver(rootPath)
    resolver.configuration.paths = {
      Galderma_Sales: [
        'vendor/galderma/theme-core-b2b/Galderma_Sales/web',
        'app/design/frontend/Webjump/theme-frontend-representatives/Galderma_Sales/web'
      ]
    }

    const targetFilePath = normalize(join(rootPath,
      'app/design/frontend/Webjump/theme-frontend-representatives/Galderma_Sales/web/js/view/order/create/family/category.js'))

    const modulePaths = resolver.unresolveFilePath(targetFilePath)

    assert.ok(modulePaths.includes('Galderma_Sales/js/view/order/create/family/category'))
  } finally {
    rmSync(rootPath, { recursive: true, force: true })
  }
})

test('resolveModulePathCandidates should return all alias candidates in declared order', () => {
  const rootPath = createTempRoot()

  try {
    const resolver = createModuleResolver(rootPath)
    resolver.configuration.paths = {
      Galderma_Sales: [
        'vendor/galderma/theme-core-b2b/Galderma_Sales/web',
        'app/design/frontend/Webjump/theme-frontend-representatives/Galderma_Sales/web'
      ]
    }

    const candidates = resolver.resolveModulePathCandidates(
      'Galderma_Sales/js/view/order/create/family/category',
      join(rootPath, 'any/current.js')
    )

    assert.deepEqual(candidates, [
      normalize(join(rootPath,
        'vendor/galderma/theme-core-b2b/Galderma_Sales/web/js/view/order/create/family/category.js')),
      normalize(join(rootPath,
        'app/design/frontend/Webjump/theme-frontend-representatives/Galderma_Sales/web/js/view/order/create/family/category.js'))
    ])
  } finally {
    rmSync(rootPath, { recursive: true, force: true })
  }
})

test('resolveExistingModulePaths should return all existing matches in order', () => {
  const rootPath = createTempRoot()

  try {
    const resolver = createModuleResolver(rootPath)
    resolver.configuration.paths = {
      Galderma_Sales: [
        'vendor/galderma/theme-core-b2b/Galderma_Sales/web',
        'app/design/frontend/Webjump/theme-frontend-representatives/Galderma_Sales/web'
      ]
    }

    const firstDir = join(rootPath,
      'vendor/galderma/theme-core-b2b/Galderma_Sales/web/js/view/order/create/family')
    const secondDir = join(rootPath,
      'app/design/frontend/Webjump/theme-frontend-representatives/Galderma_Sales/web/js/view/order/create/family')
    mkdirSync(firstDir, { recursive: true })
    mkdirSync(secondDir, { recursive: true })
    writeFileSync(join(firstDir, 'category.js'), 'define(function () {})')
    writeFileSync(join(secondDir, 'category.js'), 'define(function () {})')

    const filePaths = resolver.resolveExistingModulePaths(
      'Galderma_Sales/js/view/order/create/family/category',
      join(rootPath, 'any/current.js')
    )

    assert.deepEqual(filePaths, [
      normalize(join(rootPath,
        'vendor/galderma/theme-core-b2b/Galderma_Sales/web/js/view/order/create/family/category.js')),
      normalize(join(rootPath,
        'app/design/frontend/Webjump/theme-frontend-representatives/Galderma_Sales/web/js/view/order/create/family/category.js'))
    ])
  } finally {
    rmSync(rootPath, { recursive: true, force: true })
  }
})
