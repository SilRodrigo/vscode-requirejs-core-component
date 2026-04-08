/**
 * Supplies the "Show Applied Mixins" editor command.
 * @module showAppliedMixins
 */
const {
  workspace,
  window,
  Uri,
  Range,
  Position,
  Selection,
  CancellationTokenSource
} = require('vscode')
const nls = require('vscode-nls')
const {
  parseModule,
  findFirstExtendCall,
  findRequireJsMixinMappings
} = require('./codeParser')
const { getFileStateAndContent } = require('./fileAccess')
const { configureLocalization } = require('./nlsHelpers')

configureLocalization(nls)
const localize = nls.loadMessageBundle()

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

function openDocumentAtLocation (location) {
  return workspace.openTextDocument(location.uri)
    .then(document => window.showTextDocument(document, {
      preview: false
    }))
    .then(editor => {
      const range = location.range

      editor.selection = new Selection(range.end, range.start)
      editor.revealRange(range)
    })
}

async function getPreferredMixinLocation (filePath) {
  try {
    const fileState = await getFileStateAndContent(filePath)
    const astRoot = parseModule(fileState.content, { loc: true })
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

/**
 * Implements the "Show Applied Mixins" editor command.
 * @param {ModuleResolver} moduleResolver RequireJS module resolver.
 * @param {TextEditor} editor The current editor.
 * @returns {Promise} Command finish.
 */
module.exports = function showAppliedMixins (moduleResolver, editor) {
  const { languageId, fileName } = editor.document

  if (languageId !== 'javascript' && languageId !== 'javascriptreact') {
    return window.showInformationMessage(localize(
      'appliedMixins.unsupportedLanguage',
      'Applied mixins can be listed only for JavaScript files.'
    ))
  }

  try {
    const astRoot = parseModule(editor.document.getText(), { loc: true, jsx: languageId === 'javascriptreact' })

    if (!findFirstExtendCall(astRoot)) {
      return window.showInformationMessage(localize(
        'appliedMixins.notCoreComponent',
        'The current file is not recognized as a Core Component module (no .extend call found).'
      ))
    }
  } catch (_error) {
    return window.showInformationMessage(localize(
      'appliedMixins.invalidFile',
      'The current file could not be parsed to detect Core Component structure.'
    ))
  }

  const cancellationTokenSource = new CancellationTokenSource()
  const cancellationToken = cancellationTokenSource.token

  return findAppliedMixins(moduleResolver, fileName, cancellationToken)
    .then(async mixins => {
      if (!mixins.length) {
        return window.showInformationMessage(localize(
          'appliedMixins.noneFound',
          'No applied mixins were found for the current module.'
        ))
      }

      const picked = await window.showQuickPick(mixins.map(mixin => ({
        label: mixin.mixinModulePath,
        description: workspace.asRelativePath(mixin.mixinFilePath, false),
        detail: localize(
          'appliedMixins.quickPickDetail',
          'Applied to "{0}" in {1}',
          mixin.targetModulePath,
          workspace.asRelativePath(mixin.configFilePath, false)
        ),
        mixin
      })), {
        title: localize('appliedMixins.quickPickTitle', 'Applied mixins'),
        placeHolder: localize(
          'appliedMixins.quickPickPlaceholder',
          'Select a mixin to open its module file.'
        )
      })

      if (picked) {
        const location = await getPreferredMixinLocation(picked.mixin.mixinFilePath)

        return openDocumentAtLocation(location)
      }
    })
    .finally(() => cancellationTokenSource.dispose())
}