const vscode = require('vscode');
const workspace = vscode.workspace;
const LRU = require('lru-cache');
const { addDisposable, disposeAll } = require('./disposableHost');

class CacheByDocument {
	/**
		 * Initializes a new instance.
		 */
	constructor () {
		this.configure();
		addDisposable(workspace.onDidChangeConfiguration(() => this.configure()));
	}

	configure () {
		const moduleCacheSize = workspace
			.getConfiguration('requireModuleSupport')
			.get('moduleCacheSize') || 100;

		if (this.cache) {
			this.cache.max = moduleCacheSize;
		} else {
			this.cache = new LRU(moduleCacheSize);
		}
	}

	/**
		 * Gets a cached object for the specified document version. If the cache was populated
		 * for other document version, it removes the object from the cache and returns nothing.
		 * @param {TextDocument} document Original document
		 * @returns {Object} The cached object or null
		 */
	getCachedObject (document) {
		const fileName = document.fileName;
		let cacheEntry = this.cache.get(fileName);

		if (cacheEntry) {
			// The version property changes with every document modification.
			if (cacheEntry.version !== document.version) {
				this.cache.del(fileName);
			} else {
				return cacheEntry.object;
			}
		}

		return null;
	}

	/**
		 * Sets a object to cache for the specified document version.
		 * @param {TextDocument} document Original document
		 * @param {Object} object Object to store to the cache
		 * @returns {void} Nothing
		 */
	setCachedObject (document, object) {
		this.cache.set(document.fileName, {
			object: object,
			version: document.version
		});
	}

	dispose () {
		disposeAll(this);
	}
}

module.exports = CacheByDocument;
