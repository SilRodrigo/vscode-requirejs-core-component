const {
  workspace,
  Uri,
  Range,
  Position
} = require('vscode')
const {
  parseModule,
  findFirstExtendCall,
  findRequireJsMixinMappings
} = require('./codeParser')
const { getFileStateAndContent } = require('./fileAccess')

function getMixinConfigSearchPatterns () {
  const searchPatterns = workspace
    .getConfiguration('requireModuleSupport')
    .get('mixinConfigSearchPatterns')

  if (Array.isArray(searchPatterns)) {
    const normalizedPatterns = searchPatterns
      .filter(pattern => typeof pattern === 'string')
      .map(pattern => pattern.trim())
      .filter(Boolean)

    if (normalizedPatterns.length) {
      return normalizedPatterns
    }
  }

  return ['app/design/frontend/**/requirejs-config.js']
}

function convertLocToRange (loc) {
  if (!loc) {
    return new Range(new Position(0, 0), new Position(0, 0))
  }

  return new Range(
    new Position(loc.start.line - 1, loc.start.column),
    new Position(loc.end.line - 1, loc.end.column)
  )
}

async function getPreferredMixinLocation (filePath) {
  try {
    const fileState = await getFileStateAndContent(filePath)
    const astRoot = parseModule(fileState.content, { loc: true, jsx: true })
    const loc = findFirstExtendCall(astRoot)

    return {
      uri: Uri.file(filePath),
      range: convertLocToRange(loc)
    }
  } catch (_error) {
    return {
      uri: Uri.file(filePath),
      range: convertLocToRange()
    }
  }
}

async function findAppliedMixins (moduleResolver, currentFilePath, cancellationToken) {
  const modulePaths = moduleResolver.unresolveFilePath(currentFilePath)

  if (!modulePaths.length) {
    return []
  }

  const configUriGroups = await Promise.all(getMixinConfigSearchPatterns().map(searchPattern => {
    return workspace.findFiles(
      searchPattern,
      '**/node_modules/**',
      undefined,
      cancellationToken
    )
  }))
  const configUris = configUriGroups
    .flat()
    .filter((configUri, index, uris) => {
      return uris.findIndex(otherUri => otherUri.fsPath === configUri.fsPath) === index
    })
  const results = []

  for (const configUri of configUris) {
    const configFilePath = configUri.fsPath
    let fileState
    let astRoot

    try {
      fileState = await getFileStateAndContent(configFilePath)
      astRoot = parseModule(fileState.content, { loc: true })
    } catch (_error) {
      continue
    }

    findRequireJsMixinMappings(astRoot)
      .filter(mapping => mapping.enabled && modulePaths.includes(mapping.targetModulePath))
      .forEach(mapping => {
        results.push({
          ...mapping,
          configFilePath,
          mixinFilePath: moduleResolver.resolveModulePath(
            mapping.mixinModulePath,
            configFilePath
          )
        })
      })
  }

  return results.sort((left, right) => {
    return left.mixinModulePath.localeCompare(right.mixinModulePath) ||
      left.configFilePath.localeCompare(right.configFilePath)
  })
}

module.exports = {
  convertLocToRange,
  findAppliedMixins,
  getPreferredMixinLocation
}
