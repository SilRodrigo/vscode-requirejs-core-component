const { workspace } = require('vscode');
const { findDependencies, findCjsDependencies } = require('amodro-trace/parse');
const { parseModule, findIdentifierWithinRange, findOriginatingModuleDependency } = require('./codeParser');
const CacheByDocument = require('./cacheByDocument');
const { addDisposable, disposeAll } = require('./disposableHost');

class ModuleAnalyser {
	/**
		 * Initializes a new instance.
		 */
	constructor () {
		this.moduleDependencyCache = new CacheByDocument();
		addDisposable(this.moduleDependencyCache);
		this.parsedModuleCache = new CacheByDocument();
		addDisposable(this.parsedModuleCache);
	}

	/**
		 * Returns AST of the specified document to be used in other functions
		 * @param {TextDocument} document Original document
		 * @returns {Object} JavaScript AST
		 */
	getParsedModule (document) {
		let astRoot = this.parsedModuleCache.getCachedObject(document);

		if (!astRoot) {
			astRoot = parseModule(document.getText(), { loc: true });
			this.parsedModuleCache.setCachedObject(document, astRoot);
		}

		return astRoot;
	}

	/**
		 * Returns obj with name/path pairs from define/require statement
		 * @param {TextDocument} document Original document
		 * @param {Object} astRoot Parsed document
		 * @returns {Object} Contains name/path pairs
		 */
	getModuleDependencies (document, astRoot) {
		let dependencies = this.moduleDependencyCache.getCachedObject(document);

		if (!dependencies) {
			// Pure CommonJS syntax needs a different lookup method.
			const enableCjsModules = workspace
				.getConfiguration('requireModuleSupport')
				.get('enableCjsModules');
			const findModuleDependencies = enableCjsModules
				? findCjsDependencies : findDependencies;

			dependencies = findModuleDependencies(astRoot);
			const modules = dependencies.modules;

			// Create a map {formal parameter -> module path} from
			// the two arrays with keys and vales.
			dependencies = dependencies.params.reduce(function (result, param, index) {
				result[param] = modules[index];

				return result;
			}, {});
			this.moduleDependencyCache.setCachedObject(document, dependencies);
		}

		return dependencies;
	}

	/**
		 * Returns information about the originating module of the currently
		 * selected identifier, if it can ce tracked to a module, which the
		 * current module depends on.
		 * @param {TextDocument} document The document in which the command was invoked.
		 * @param {Position} position The position at which the command was invoked.
		 * @returns {Object} Object with `{modulePath, imported, selected}`,
		 * where `modulePath` is the RequireJS path of the originating module,
		 * `imported` the formal parameter name with the module exports and
		 * `selected` the currently selected identifier.
		 */
	getOriginatingModuleDependency (document, position) {
		const range = document.getWordRangeAtPosition(position);

		if (range) {
			const astRoot = this.getParsedModule(document);
			const identifier = findIdentifierWithinRange(astRoot, range);

			if (identifier) {
				return findOriginatingModuleDependency(astRoot, identifier,
					this.getModuleDependencies(document, astRoot));
			}
		}

		return undefined;
	}

	/**
		 * Disposes of disposable child objects.
		 * @returns {Void} Nothing.
		 */
	dispose () {
		disposeAll(this);
	}
}

module.exports = ModuleAnalyser;
