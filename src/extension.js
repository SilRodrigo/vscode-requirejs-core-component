/**
 * Declares a VS Code extension and registers providers and commands.
 * @namespace extension
 */

const { commands, languages, workspace, window } = require('vscode')
const { parseModule, findFirstExtendCall } = require('./codeParser')
const StatusNotifier = require('./statusNotifier')
const ModuleResolver = require('./moduleResolver')
const ModuleAnalyser = require('./moduleAnalyser')
const FolderCrawler = require('./folderCrawler')
const DefinitionProvider = require('./definitionProvider')
const ReferenceProvider = require('./referenceProvider')
const CompletionItemProvider = require('./completionItemProvider')
const HoverProvider = require('./hoverProvider')
const RenameProvider = require('./renameProvider')
const MixinCodeLensProvider = require('./mixinCodeLensProvider')
const MixinDecorations = require('./mixinDecorations')
const goToDefinitionModule = require('./goToDefinitionModule')
const renameExportedSymbol = require('./renameExportedSymbol')
const showAppliedMixins = require('./showAppliedMixins')

/**
 * Sets a context flag, which can be used to enable or disable menu items.
 * or keyboard bindings in the package configuration.
 * @param {string} name The context parameter name. It will be prefixed by "requireModuleSupport:".
 * @param {boolean} value The context parameter value.
 * @returns {Promise} Resolves, when the parameter has been set.
 * @memberof extension
 * @inner
 */
function setContextFlag (name, value) {
  return commands.executeCommand('setContext',
    'requireModuleSupport:' + name, value)
}

/**
 * Sets or resets a context flag, which can be used to enable or disable
 * menu items or keyboard bindings in the package configuration, based on
 * a package configuration flag.
 * @param {string} name The context parameter name. The configuration flag
 * is expected to be prefixed by "requireModuleSupport.", the context
 * flag will be prefixed by "requireModuleSupport:".
 * @returns {Promise} Resolves, when the parameter has been set.
 * @memberof extension
 * @inner
 */
function configureContextFlag (name) {
  return setContextFlag(name, workspace
    .getConfiguration('requireModuleSupport')
    .get(name))
}

/**
 * Registers or unregisters a provider, based on a package configuration
 * flag, including setting a context flag about it.
 * @param {Object} context A part of the extension activation context.
 * @param {string} name The provider name used for configuration and
 * context flags, where it will be prefixed by :"enable".
 * @param {Function} subscriber Callback performing the provider registration.
 * @returns {Promise|Void} Resolves, when the provider has been registered,
 * or the result is nothing, if the registration has not been done.
 * @memberof extension
 * @inner
 */
function configureProvider (context, name, subscriber) {
  const flagName = 'enable' + name
  const enable = workspace
    .getConfiguration('requireModuleSupport')
    .get(flagName)
  const subscriptions = context.subscriptions
  const registrations = context.registrations
  const registration = registrations[name]

  if (enable) {
    if (!registration) {
      const subscription = subscriber()

      registrations[name] = subscription
      subscriptions.push(subscription)

      return setContextFlag(flagName, true)
    }
  /* c8 ignore next 6 */
  } else if (registration) {
    registrations[name] = undefined
    registration.dispose()

    return setContextFlag(flagName, false)
  }

  return undefined
}

/**
 * Initializes or re-initializes the extension according to the package
 * and workspace configuration.
 * @param {Object} context A part of the extension activation context.
 * @returns {void} Nothing.
 * @memberof extension
 * @inner
 */
function configureExtension (context) {
  const {
    definitionProvider,
    referenceProvider,
    completionItemProvider,
    hoverProvider,
    renameProvider,
    mixinCodeLensProvider
  } = context.providers
  const language = [
    { scheme: 'file', language: 'javascript' },
    { scheme: 'file', language: 'javascriptreact' }
  ]
  const definitionLanguage = [
    ...language,
    { scheme: 'file', language: 'xml' }
  ]

  configureProvider(context, 'DefinitionProvider', () =>
    languages.registerDefinitionProvider(
      definitionLanguage, definitionProvider))
  configureProvider(context, 'ReferenceProvider', () =>
    languages.registerReferenceProvider(
      language, referenceProvider))
  configureProvider(context, 'CompletionItemProvider', () =>
    languages.registerCompletionItemProvider(
      language, completionItemProvider, '/'))
  configureProvider(context, 'HoverProvider', () =>
    languages.registerHoverProvider(
      language, hoverProvider))
  configureProvider(context, 'RenameProvider', () =>
    languages.registerRenameProvider(
      language, renameProvider))
  configureProvider(context, 'MixinCodeLensProvider', () =>
    languages.registerCodeLensProvider(
      language, mixinCodeLensProvider))

  // Allow enabling or disabling or menu items or keyboard bindings.
  configureContextFlag('showGoToDefinitionModuleCommand')
  configureContextFlag('showRenameExportedSymbolCommand')

  // Update cache size
  const { moduleAnalyser } = definitionProvider || referenceProvider || {}
  if (moduleAnalyser) {
    const moduleCacheSize = workspace
      .getConfiguration('requireModuleSupport')
      .get('moduleCacheSize') || 10000
    moduleAnalyser.adaptCacheSizes(moduleCacheSize)
  }
}

/**
 * Checks whether the current document looks like a Core Component module.
 * @param {TextDocument} document The current document.
 * @returns {boolean} True if the document contains an `.extend(...)` call.
 * @inner
 */
function isCoreComponentDocument (document) {
  if (!document) {
    return false
  }

  const { languageId } = document
  if (languageId !== 'javascript' && languageId !== 'javascriptreact') {
    return false
  }

  try {
    const astRoot = parseModule(document.getText(), { loc: true, jsx: languageId === 'javascriptreact' })

    return !!findFirstExtendCall(astRoot)
  } catch (_error) {
    return false
  }
}

/**
 * Sets context flag for enabling Core Component-only UI commands.
 * @param {TextEditor} editor The active editor.
 * @returns {Promise} Resolves when the context flag is set.
 * @inner
 */
function updateCoreComponentContext (editor) {
  const isCoreComponentFile = !!(editor && isCoreComponentDocument(editor.document))

  return setContextFlag('isCoreComponentFile', isCoreComponentFile)
}

module.exports = {
  /**
   * Activates this extension and ensures the proper registration of
   * providers and commands according to the workspace configuration.
   * @param {Object} context Extension activation context.
   * @returns {void} Nothing.
   * @memberof extension
   */
  activate (context) {
    const subscriptions = context.subscriptions
    const statusNotifier = new StatusNotifier()
    const moduleResolver = new ModuleResolver()
    const moduleAnalyser = new ModuleAnalyser(moduleResolver)
    const folderCrawler = new FolderCrawler(statusNotifier)
    const definitionProvider = new DefinitionProvider(moduleAnalyser)
    const referenceProvider = new ReferenceProvider(moduleAnalyser, statusNotifier)
    const completionItemProvider = new CompletionItemProvider(moduleResolver, folderCrawler)
    const hoverProvider = new HoverProvider(moduleResolver)
    const renameProvider = new RenameProvider(referenceProvider)
    const mixinCodeLensProvider = new MixinCodeLensProvider(moduleResolver)
    const mixinDecorations = new MixinDecorations(moduleResolver)
    const configurationContext = { subscriptions: subscriptions }

    configurationContext.providers = {
      definitionProvider: definitionProvider,
      referenceProvider: referenceProvider,
      completionItemProvider: completionItemProvider,
      hoverProvider: hoverProvider,
      renameProvider: renameProvider,
      mixinCodeLensProvider: mixinCodeLensProvider
    }

    const configurationChange = workspace.onDidChangeConfiguration(() =>
      configureExtension(configurationContext))
    const activeEditorChange = window.onDidChangeActiveTextEditor(editor =>
      updateCoreComponentContext(editor))
    const activeDocumentChange = workspace.onDidChangeTextDocument(event => {
      const editor = window.activeTextEditor

      if (editor && event.document === editor.document) {
        return updateCoreComponentContext(editor)
      }
    })

    configurationContext.registrations = { configurationChange: configurationChange }

    subscriptions.push(
      statusNotifier, moduleResolver, moduleAnalyser, folderCrawler,
      definitionProvider, referenceProvider, completionItemProvider,
      hoverProvider, renameProvider, mixinCodeLensProvider, mixinDecorations,
      configurationChange,
      activeEditorChange, activeDocumentChange,
      // Registering commands does not show them in UI immediately
      // and they do not disturb, when registered all the time.
      commands.registerTextEditorCommand(
        'requireModuleSupport.goToDefinitionModule',
        goToDefinitionModule.bind(null, definitionProvider)),
      commands.registerTextEditorCommand(
        'requireModuleSupport.renameExportedSymbol',
        renameExportedSymbol.bind(null, renameProvider)),
      commands.registerCommand(
        'requireModuleSupport.showAppliedMixins',
        showAppliedMixins.bind(null, moduleResolver)))

    configureExtension(configurationContext)
    updateCoreComponentContext(window.activeTextEditor)
  }
}
