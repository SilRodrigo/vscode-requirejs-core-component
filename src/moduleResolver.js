const { workspace } = require('vscode');
const amodroConfig = require('@prantlf/amodro-trace/config');
const { addDisposable, disposeAll } = require('./disposableHost');
const { readFileSync } = require('fs');
const { normalize, join, dirname, extname } = require('path');
const requirejs = require('@prantlf/requirejs');

/**
 * Resolves RequireJS module paths, which are used in `define` and
 * `require` statements as references tp dependent modules, to absolute
 * file paths, where the module files are stored in the file-system.
 * And also the other way round, as long as the module references
 * use paths, which start with neither "./" nor "../" and are rooted in
 * directories configured by RequireJS settings `baseUrl` and `paths`.
 */
class ModuleResolver {
  /**
   * Initializes a new instance.
   */
  constructor () {
    this.configure();
    addDisposable(workspace.onDidChangeConfiguration(() => this.configure()));
  }

  /**
   * Initializes or re-initializes requirejs for the activated context.
   * @returns {void} Nothing.
   */
  configure () {
    const requireModuleSupport = workspace.getConfiguration('requireModuleSupport');
    const rootPath = workspace.workspaceFolders && workspace.workspaceFolders[0].uri.fsPath
      || process.env.VSCODE_REQUIREJS_WORKSPACE;
    const config = {
      // Handle the existing modulePath property as baseUrl for require.config()
      // to support simple scenarios. More complex projects should supply also
      // configFile in addition to baseUrl to resolve any module path.
      baseUrl: join(rootPath, requireModuleSupport.get('modulePath'))
    };
    // Reuse the configuration for debugging a requirejs project for editing too.
    // Prevent maintaining the same configuration in settings.json.
    const configFile = requireModuleSupport.get('configFile');

    // Clean up requirejs configuration from the previously activated context.
    // See https://github.com/requirejs/requirejs/issues/1113 for more information.
    delete requirejs.s.contexts._;

    if (configFile) {
      const configPath = join(rootPath, configFile);
      const configContent = readFileSync(configPath, 'utf-8');
      const configObject = amodroConfig.find(configContent);

      if (configObject) {
        Object.assign(config, configObject);
      }

      if (!this.fileSystemWatcher) {
        this.fileSystemWatcher = workspace.createFileSystemWatcher(configPath);
        addDisposable(this.fileSystemWatcher);
        addDisposable(this.fileSystemWatcher.onDidChange(() => this.configure()));
        addDisposable(this.fileSystemWatcher.onDidCreate(() => this.configure()));
        addDisposable(this.fileSystemWatcher.onDidDelete(() => this.configure()));
      }
    }
    requirejs.config(config);
    this.configuration = {
      baseUrl: config.baseUrl,
      paths: config.paths || {}
    };
    this.cutExtensions = workspace
      .getConfiguration('requireModuleSupport')
      .get('cutFileCompletionExtensions');
  }

  /**
   * Computes an absolute path to the file representing the RequireJS module dependency.
   * @param {string} modulePath Require path of the target module
   * @param {string} currentFilePath Current file path to start search from
   * @returns {string} the file location
   */
  resolveModulePath (modulePath, currentFilePath) {
    // Plugins, which load other files follow the syntax "plugin!parameter",
    // where "parameter" is usually another module path to be resolved.
    const pluginSeparator = modulePath.indexOf('!');
    let filePath;

    if (pluginSeparator > 0) {
      const pluginExtensions = workspace.getConfiguration('requireModuleSupport').get('pluginExtensions');
      const pluginName = modulePath.substr(0, pluginSeparator);

      filePath = modulePath.substr(pluginSeparator + 1);
      // Plugins may optionally append their known file extensions.
      if (pluginExtensions) {
        const pluginExtension = pluginExtensions[pluginName];

        if (pluginExtension && !filePath.endsWith(pluginExtension)) {
          filePath += pluginExtension;
        }
      }
    } else {
      // The requirejs.toUrl method does not append '.js' to the resolved path.
      filePath = modulePath + '.js';
    }

    // The global requirejs.toUrl does not resolve relative module paths.
    if (filePath.startsWith('./')) {
      filePath = join(dirname(currentFilePath), filePath);
    }

    return normalize(requirejs.toUrl(filePath));
  }

  /**
   * Guesses possible RequireJS module paths, which would resolve
   * to the specified absolute file path. It works well if modules
   * are referenced by paths not starting with "./" or "../"; if
   * they start with a directory or alias according to the RequireJS
   * configuration `baseUrl` and `paths`.
   * @param {string} filePath The file path to investigate.
   * @returns {Array} Guessed module paths, which may occur as references in other modules.
   */
  unresolveFilePath (filePath) {
    const cutExtensions = this.cutExtensions;
    const modulePaths = [];
    // RequireJS looks for modules with the relative path in the directory
    // specified by the `baseUrl` configuration property, which defaults
    // to the current directory, which means the workspace root in VS Code.
    const { baseUrl, paths } = this.configuration;

    function dealWithExtension (modulePath) {
      const extension = extname(modulePath);

      return cutExtensions.indexOf(extension) >= 0
        ? modulePath.substr(0, modulePath.length - extension.length)
        : modulePath;
    }

    // Suggest the path relative to the `baseUrl` directory, if the file
    // path is relative to it; usually to the workspace root.
    if (filePath.startsWith(baseUrl)) {
      modulePaths.push(dealWithExtension(
        filePath.substr(baseUrl.length).trimLeft('/')));
    }
    // Try to find path aliases at the beginning of the file path, which
    // are specified by the `paths` configuration property.
    Object.keys(paths).forEach(pathPrefix => {
      let basePath = normalize(join(baseUrl, paths[pathPrefix]));

      if (!basePath.endsWith('/')) {
        basePath += '/';
      }
      // Suggest the path starting with the alias (prefix) instead of
      // the actual absolute path.
      if (filePath.startsWith(basePath)) {
        modulePaths.push(dealWithExtension(
          join(pathPrefix, filePath.substr(basePath.length))));
      }
    });

    return modulePaths;
  }

  /**
     * Disposes of disposable child objects.
     * @returns {void} Nothing.
     */
  dispose () {
    disposeAll(this);
  }
}

module.exports = ModuleResolver;
