const vscode = require('vscode');
const amodroParse = require('amodro-trace/parse');
const codeParser = require('./src/codeParser');
const moduleResolver = require('./src/moduleResolver');
const goToDefinitionModule = require('./src/goToDefinitionModule');
const LRU = require('lru-cache');

/**
	 * Gets a cached object for the specified document version. If the cache was populated
	 * for other document version, it removes the object from the cache and returns nothing.
	 * @param {Object} cache LRU cache to use
	 * @param {TextDocument} document Original document
	 * @returns {Object} The cached object or null
	 */
function getCachedVersionedObject (cache, document) {
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
function setCachedVersionedObject (cache, document, object) {
	cache.set(document.fileName, {
		object: object,
		version: document.version
	});
}

class DefinitionProvider {
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
	clearVersionObjectCaches () {
		this.moduleDependencyCache.reset();
		this.parsedModuleCache.reset();
	}

	/**
		 * Returns AST of the specified document to be used in other functions
		 * @param {TextDocument} document Original document
		 * @returns {Object} JavaScript AST
		 */
	getParsedModule (document) {
		let astRoot = getCachedVersionedObject(this.parsedModuleCache, document);

		if (!astRoot) {
			astRoot = codeParser.parse(document.getText(), { loc: true });
			setCachedVersionedObject(this.parsedModuleCache, document, astRoot);
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
		let dependencies = getCachedVersionedObject(this.moduleDependencyCache, document);

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
			setCachedVersionedObject(this.moduleDependencyCache, document, dependencies);
		}

		return dependencies;
	}

	/**
		 * Diverges the search to the given module
		 * @param {String} currentFilePath Current file path to start search from
		 * @param {String} modulePath Require path of the target module
		 * @param {String} searchFor The identifier to search for inside the module
		 * @returns {Promise} Resolves with a file location
		 */
	searchModule (currentFilePath, modulePath, searchFor) {
		const filePath = moduleResolver.resolveModulePath(modulePath, currentFilePath);
		const newUri = vscode.Uri.file(filePath);
		const newDocument = vscode.workspace.openTextDocument(newUri);

		return newDocument.then(document => {
			const onlyNavigateToFile = vscode.workspace
				.getConfiguration('requireModuleSupport')
				.get('onlyNavigateToFile');

			// Some modules are source for RequireJS plugins and need not be written in JavaScript.
			if (!onlyNavigateToFile && searchFor && document.languageId === 'javascript') {
				const astRoot = this.getParsedModule(document);
				const range = codeParser.findIdentifier(astRoot, searchFor);

				if (range) {
					return new vscode.Location(newUri, new vscode.Range(
						// vscode.Range is zero-based, esprima is one-based
						new vscode.Position(range.start.line - 1, range.start.column),
						new vscode.Position(range.end.line - 1, range.end.column)
					));
				}
			}

			return new vscode.Location(newUri, new vscode.Position(0, 0));
		});
	}

	provideDefinition (document, position) {
		const currentFilePath = document.fileName;
		const range = document.getWordRangeAtPosition(position);

		if (range) {
			const astRoot = this.getParsedModule(document);
			const identifier = codeParser.findIdentifierWithinRange(astRoot, range);

			if (identifier) {
				const moduleDependencies = this.getModuleDependencies(document, astRoot);
				const moduleDependency = codeParser.findOriginatingModuleDependency(
					astRoot, identifier, moduleDependencies);
				const modulePath = moduleDependency.modulePath;

				if (modulePath) {
					return this.searchModule(currentFilePath, modulePath, moduleDependency.selected);
				}
			}
		}

		return Promise.resolve(undefined);
	}
}

Object.assign(exports, {
	DefinitionProvider,
	activate (context) {
		const definitionProvider = new DefinitionProvider();

		moduleResolver.initializeRequireJs();
		context.subscriptions.push(
			vscode.workspace.onDidChangeConfiguration(() => {
				moduleResolver.initializeRequireJs();
				definitionProvider.clearVersionObjectCaches();
			}));
		context.subscriptions.push(
			vscode.languages.registerDefinitionProvider(
				'javascript', definitionProvider));
		context.subscriptions.push(
			vscode.commands.registerTextEditorCommand('requireModuleSupport.goToDefinitionModule',
				goToDefinitionModule.bind(null, definitionProvider)));
	}
});
