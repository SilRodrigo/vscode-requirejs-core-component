/**
 * Declares a VS Code extension and registers providers and commands.
 * @namespace extension
 */

const { commands, languages, workspace } = require('vscode');
const StatusNotifier = require('./statusNotifier');
const ModuleResolver = require('./moduleResolver');
const ModuleAnalyser = require('./moduleAnalyser');
const FolderCrawler = require('./folderCrawler');
const DefinitionProvider = require('./definitionProvider');
const ReferenceProvider = require('./referenceProvider');
const CompletionItemProvider = require('./completionItemProvider');
const HoverProvider = require('./hoverProvider');
const RenameProvider = require('./renameProvider');
const goToDefinitionModule = require('./goToDefinitionModule');
const renameExportedSymbol = require('./renameExportedSymbol');

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
    'requireModuleSupport:' + name, value);
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
    .get(name));
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
  const flagName = 'enable' + name;
  const enable = workspace
    .getConfiguration('requireModuleSupport')
    .get(flagName);
  const subscriptions = context.subscriptions;
  const registrations = context.registrations;
  const registration = registrations[name];

  if (enable) {
    if (!registration) {
      const subscription = subscriber();

      registrations[name] = subscription;
      subscriptions.push(subscription);

      return setContextFlag(flagName, true);
    }
  /* c8 ignore next 6 */
  } else if (registration) {
    registrations[name] = undefined;
    registration.dispose();

    return setContextFlag(flagName, false);
  }

  return undefined;
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
    renameProvider
  } = context.providers;
  const language = [
    { scheme: 'file', language: 'javascript' },
    { scheme: 'file', language: 'javascriptreact' }
  ];

  configureProvider(context, 'DefinitionProvider', () =>
    languages.registerDefinitionProvider(
      language, definitionProvider));
  configureProvider(context, 'ReferenceProvider', () =>
    languages.registerReferenceProvider(
      language, referenceProvider));
  configureProvider(context, 'CompletionItemProvider', () =>
    languages.registerCompletionItemProvider(
      language, completionItemProvider, '/'));
  configureProvider(context, 'HoverProvider', () =>
    languages.registerHoverProvider(
      language, hoverProvider));
  configureProvider(context, 'RenameProvider', () =>
    languages.registerRenameProvider(
      language, renameProvider));

  // Allow enabling or disabling or menu items or keyboard bindings.
  configureContextFlag('showGoToDefinitionModuleCommand');
  configureContextFlag('showRenameExportedSymbolCommand');

  // Update cache size
  const { moduleAnalyser } = definitionProvider || referenceProvider || {};
  if (moduleAnalyser) {
    const moduleCacheSize = workspace
      .getConfiguration('requireModuleSupport')
      .get('moduleCacheSize') || 10000;
    moduleAnalyser.adaptCacheSizes(moduleCacheSize);
  }
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
    const subscriptions = context.subscriptions;
    const statusNotifier = new StatusNotifier();
    const moduleResolver = new ModuleResolver();
    const moduleAnalyser = new ModuleAnalyser(moduleResolver);
    const folderCrawler = new FolderCrawler(statusNotifier);
    const definitionProvider = new DefinitionProvider(moduleAnalyser);
    const referenceProvider = new ReferenceProvider(moduleAnalyser, statusNotifier);
    const completionItemProvider = new CompletionItemProvider(moduleResolver, folderCrawler);
    const hoverProvider = new HoverProvider(moduleResolver);
    const renameProvider = new RenameProvider(referenceProvider);
    const configurationContext = { subscriptions: subscriptions };

    configurationContext.providers = {
      definitionProvider: definitionProvider,
      referenceProvider: referenceProvider,
      completionItemProvider: completionItemProvider,
      hoverProvider: hoverProvider,
      renameProvider: renameProvider
    };

    const configurationChange = workspace.onDidChangeConfiguration(() =>
      configureExtension(configurationContext));

    configurationContext.registrations = { configurationChange: configurationChange };

    subscriptions.push(
      statusNotifier, moduleResolver, moduleAnalyser, folderCrawler,
      definitionProvider, referenceProvider, completionItemProvider,
      hoverProvider, renameProvider, configurationChange,
      // Registering commands does not show them in UI immediately
      // and they do not disturb, when registered all the time.
      commands.registerTextEditorCommand(
        'requireModuleSupport.goToDefinitionModule',
        goToDefinitionModule.bind(null, definitionProvider)),
      commands.registerTextEditorCommand(
        'requireModuleSupport.renameExportedSymbol',
        renameExportedSymbol.bind(null, renameProvider)));

    configureExtension(configurationContext);
  }
};
