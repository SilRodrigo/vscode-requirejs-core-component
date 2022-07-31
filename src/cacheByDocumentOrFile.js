const { workspace } = require('vscode')
const LRU = require('lru-cache')
const { addDisposable, disposeAll } = require('./disposableHost')

/**
 * Maintains a cache for object related to documents or files. If the
 * document changes, the cache drops cached the object and the caller is
 * supposed to produce a fresh one and update the cache. (This happens
 * when getting the object from cache.)
 */
class CacheByDocumentOrFile {
  /**
   * Initializes a new instance.
   */
  constructor () {
    this.configure()
    addDisposable(workspace.onDidChangeConfiguration(
      () => this.configure()))
  }

  /**
   * Initializes or re-initializes the LRU cache object.
   * @returns {void} Nothing.
   */
  configure () {
    const moduleCacheSize = workspace
      .getConfiguration('requireModuleSupport')
      .get('moduleCacheSize') || 10000

    if (this.cache) {
      this.adaptCacheSize(moduleCacheSize)
    } else {
      this.cache = new LRU({ max: moduleCacheSize })
    }
  }

  /**
   * Adapt the cache size, so that it can handle at least the specified
   * object count.
   * @param {number} maximumCount The expected object count to handle
   * @returns {Void} Nothing.
   */
  adaptCacheSize (maximumCount) {
    if (this.cache.max < maximumCount) {
      this.cache.max = maximumCount
    }
  }

  /**
   * Gets a cached object for the specified document version, or file
   * information. If the cache was populated for other document version,
   * it removes the object from the cache and returns nothing.
   * @param {TextDocument|Object} document Original document or file
   * information returned by `fs.stat`.
   * @returns {Object} The cached object or null.
   */
  getCachedObject (document) {
    const isDocument = document.fileName
    const fileName = isDocument || document.path
    const cacheEntry = this.cache.get(fileName)

    if (cacheEntry) {
      // Recognize a cache entry stored by file information.
      if (cacheEntry.mtime) {
        // Disregard the cache entry, if it was created using a file
        // information and now it is requested by a document.
        // Otherwise check the last modification time of the file.
        if (isDocument
          || cacheEntry.mtime !== document.mtime) {
          this.cache.delete(fileName)
        } else {
          return cacheEntry.object
        }
      } else if (isDocument
          && cacheEntry.version !== document.version) {
        // If the cache entry was was created using a document
        // and it is requested by a file information, return it
        // always. Documents are kept up-to-date with the files.
        // Otherwise check the document versions.
        this.cache.delete(fileName)
      } else {
        return cacheEntry.object
      }
    }

    return null
  }

  /**
   * Sets a object to cache for the specified document version or for the
   * specified file information.
   * @param {TextDocument|Object} document Original document or file
   * information returned by `fs.stat`.
   * @param {Object} object Object to store to the cache.
   * @returns {void} Nothing.
   */
  setCachedObject (document, object) {
    const isDocument = document.fileName
    const fileName = isDocument || document.path
    const cacheEntry = { object: object }

    if (isDocument) {
      // The version property changes with every document modification.
      cacheEntry.version = document.version
    } else {
      // As long as there has been no document opened, use the last
      // modification time of the file.
      cacheEntry.mtime = document.mtime
    }
    this.cache.set(fileName, cacheEntry)
  }

  /**
   * Disposes of disposable child objects.
   * @returns {void} Nothing.
   */
  dispose () {
    disposeAll(this)
  }
}

module.exports = CacheByDocumentOrFile
