const vscode = require('vscode');
const amodroParse = require('amodro-trace/parse');
const codeParser = require('./codeParser');
const LRU = require('lru-cache');

/**
	 * Gets a cached object for the specified document version. If the cache was populated
	 * for other document version, it removes the object from the cache and returns nothing.
	 * @param {Object} cache LRU cache to use
	 * @param {TextDocument} document Original document
	 * @returns {Object} The cached object or null
	 */
function getCachedObject (cache, document) {
	const fileName = document.fileName;
	let cacheEntry = cache.get(fileName);

	if (cacheEntry) {
		// The version property changes with every document modification.
		if (cacheEntry.version !== document.version) {
			cache.del(fileName);
		} else {
			return cacheEntry.object;
		}
	}

	return null;
}

/**
	 * Sets a object to cache for the specified document version.
	 * @param {Object} cache LRU cache to use
	 * @param {TextDocument} document Original document
	 * @param {Object} object Object to store to the cache
	 * @returns {void} Nothing
	 */
function setCachedObject (cache, document, object) {
	cache.set(document.fileName, {
		object: object,
		version: document.version
	});
}

class ModuleAnalyser {
	/**
		 * Initializes a new instance.
		 */
	constructor () {
		const moduleCacheSize = vscode.workspace
			.getConfiguration('requireModuleSupport')
			.get('moduleCacheSize') || 100;

		this.moduleDependencyCache = new LRU(moduleCacheSize);
		this.parsedModuleCache = new LRU(moduleCacheSize);
	}

	/**
		 * Clears internal caches to get to the state of the new instance.
		 * @returns {Void} Nothing
		 */
	clearObjectCaches () {
		this.moduleDependencyCache.reset();
		this.parsedModuleCache.reset();
	}

	/**
		 * Returns AST of the specified document to be used in other functions
		 * @param {TextDocument} document Original document
		 * @returns {Object} JavaScript AST
		 */
	getParsedModule (document) {
		let astRoot = getCachedObject(this.parsedModuleCache, document);

		if (!astRoot) {
			astRoot = codeParser.parse(document.getText(), { loc: true });
			setCachedObject(this.parsedModuleCache, document, astRoot);
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
		let dependencies = getCachedObject(this.moduleDependencyCache, document);

		if (!dependencies) {
			const enableCjsModules = vscode.workspace
				.getConfiguration('requireModuleSupport')
				.get('enableCjsModules');
			const findDependencies = enableCjsModules ? amodroParse.findCjsDependencies
				: amodroParse.findDependencies;

			dependencies = findDependencies(astRoot);
			let modules = dependencies.modules;

			dependencies = dependencies.params.reduce(function (result, param, index) {
				result[param] = modules[index];

				return result;
			}, {});
			setCachedObject(this.moduleDependencyCache, document, dependencies);
		}

		return dependencies;
	}
}

module.exports = ModuleAnalyser;
