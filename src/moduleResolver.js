const amodroConfig = require('amodro-trace/config');
const fs = require('fs');
const path = require('path');
const requirejs = require('requirejs');
const vscode = require('vscode');

/**
	 * Initializes or re-initializes requirejs for the activated context.
	 * @returns {void} Nothing
	 */
function initializeRequireJs () {
	const requireModuleSupport = vscode.workspace.getConfiguration('requireModuleSupport');
	const rootPath = vscode.workspace.rootPath;

	// Clean up requirejs configuration from the previously activated context.
	// See https://github.com/requirejs/requirejs/issues/1113 for more information.
	delete requirejs.s.contexts._;

	// Handle the existing modulePath property as baseUrl for require.config()
	// to support simple scenarios. More complex projects should supply also
	// configFile in addition to baseUrl to resolve any module path.
	requirejs.config({ baseUrl: path.join(rootPath, requireModuleSupport.get('modulePath')) });

	// Reuse the configuration for debugging a requirejs project for editing too.
	// Prevent maintaining the same configuration in settings.json.
	const configFile = requireModuleSupport.get('configFile');

	if (configFile) {
		const configContent = fs.readFileSync(path.join(rootPath, configFile), 'utf-8');
		const config = amodroConfig.find(configContent);

		if (config) {
			requirejs.config(config);
		}
	}
}

/**
	 * Computes an absolute path to the file representing the RequireJS module dependency.
	 * @param {String} modulePath Require path of the target module
	 * @param {String} currentFilePath Current file path to start search from
	 * @returns {String} the file location
	 */
function resolveModulePath (modulePath, currentFilePath) {
	// Plugins, which load other files follow the syntax "plugin!parameter",
	// where "parameter" is usually another module path to be resolved.
	const pluginSeparator = modulePath.indexOf('!');
	let filePath;

	if (pluginSeparator > 0) {
		const pluginExtensions = vscode.workspace.getConfiguration('requireModuleSupport').get('pluginExtensions');
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
		filePath = path.join(path.dirname(currentFilePath), filePath);
	}

	return path.normalize(requirejs.toUrl(filePath));
}

module.exports = {
	initializeRequireJs: initializeRequireJs,
	resolveModulePath: resolveModulePath
};
