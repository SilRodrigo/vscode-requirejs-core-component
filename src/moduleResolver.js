const { workspace } = require('vscode');
const amodroConfig = require('amodro-trace/config');
const { addDisposable, disposeAll } = require('./disposableHost');
const { readFileSync } = require('fs');
const { normalize, join, dirname } = require('path');
const requirejs = require('requirejs');

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
		 * @returns {void} Nothing
		 */
	configure () {
		const requireModuleSupport = workspace.getConfiguration('requireModuleSupport');
		const rootPath = workspace.rootPath;
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
	}

	/**
		 * Computes an absolute path to the file representing the RequireJS module dependency.
		 * @param {String} modulePath Require path of the target module
		 * @param {String} currentFilePath Current file path to start search from
		 * @returns {String} the file location
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

	dispose () {
		disposeAll(this);
	}
}

module.exports = ModuleResolver;
