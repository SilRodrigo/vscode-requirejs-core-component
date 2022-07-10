const { workspace } = require('vscode');
const { readdir, lstat, stat } = require('fs');
const { join } = require('path');
const StatusNotifier = require('../src/statusNotifier');
const { addDisposable, hostOrCreateDisposable, disposeAll } = require('./disposableHost');
const push = Array.prototype.push;

/**
 * Checks existence and walks directories to discover files of configurable
 * file extensions and retrieve information (stats) about them.
 */
class FolderCrawler {
  /**
   * Initializes a new instance.
   * @param {StatusNotifier} statusNotifier Status bar notification helper.
   */
  constructor (statusNotifier) {
    this.configure();
    addDisposable(workspace.onDidChangeConfiguration(() => this.configure()));
    hostOrCreateDisposable(this, 'statusNotifier', StatusNotifier, statusNotifier);
  }

  /**
   * Reads configuration from vscode settings.
   * @returns {void} Nothing.
   */
  configure () {
    this.batchSize = workspace
      .getConfiguration('requireModuleSupport')
      .get('moduleProcessingBatchSize');
    this.includedExtensions = workspace
      .getConfiguration('requireModuleSupport')
      .get('includeFileCompletionExtensions');
    this.excludedExtensions = workspace
      .getConfiguration('requireModuleSupport')
      .get('excludeFileCompletionExtensions');
  }

  /**
   * Checks if the path points to an existing folder.
   * @param {string} folderPath The file-system path to check.
   * @returns {Promise} Resolves if the path * points to a directory.
   * Rejected with `null` if the path is valid, but does not point to
   * a directory. If the path is invalid or the access otherwise fails,
   * the promise will be rejected with the error.
   */
  checkDirectory (folderPath) {
    return new Promise((resolve, reject) => {
      lstat(folderPath, (error, stats) => {
        if (error || !stats.isDirectory()) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Builds a list of the available files and folders from the provided path.
   * @param {string} folderPath The path to a folder.
   * @returns {Promise} Resolves with an array of items describing the
   * folder children: {name, path}.
   */
  listFolderChildren (folderPath) {
    return new Promise((resolve, reject) => {
      readdir(folderPath, (error, items) => {
        if (error) {
          reject(error);
        } else {
          resolve(items.map(name => {
            return {
              name: name,
              path: join(folderPath, name)
            };
          }));
        }
      });
    });
  }

  /**
   * Fetches information about files and folders.
   * @param {Array} items The path to a folder.
   * @param {CancellationToken} cancellationToken A cancellation token.
   * @param {Array} resultItems Output parameter for gathering module references.
   * @returns {Promise} Resolves with an array of items describing the
   * folder children: {name, path, directory}.
   */
  inspectFileItems (items, cancellationToken, resultItems) {
    const outputItems = resultItems || [];

    this.statusNotifier.notify('search', 'Inspecting ' + items.length + '...',
      'Inspecting files and directories... (remaining ' + items.length + ')');

    // Limit the number of concurrently inspected files. When working
    // by batches, the operation will be stoppable after every batch.
    const inspections = items.splice(0, this.batchSize).map(item => {
      return new Promise(resolve => {
        // Silently ignore permissions errors; if the `directory`
        // property is not a boolean, `stat` failed.
        stat(item.path, (_ignoredError, stats) => {
          item.directory = stats && stats.isDirectory();
          resolve(item);
        });
      });
    });

    return Promise.all(inspections)
      .then(batch => {
        push.apply(outputItems, batch.filter(item => {
          // Skip file-system items, which could jot be accessed.
          if (item.directory === null) {
            return false;
          }

          const name = item.name;

          // Directories will be always offered. Files will be
          // offered, if they are specified for inclusion and
          // not for exclusion. An empty including list means
          // to include all files.
          return item.directory
            || ((!this.includedExtensions.length
            || this.includedExtensions.some(
              extension => name.endsWith(extension)))
            && !this.excludedExtensions.some(
              extension => name.endsWith(extension)));
        }));

        // Stop processing if this was the last batch or the operation has been cancelled.
        if (!items.length || cancellationToken.isCancellationRequested) {
          return outputItems;
        }

        // Process the rest of items after cutting the batch above.
        return this.inspectFileItems(items, cancellationToken, outputItems);
      });
  }

  /**
   * Disposes of disposable child objects.
   * @returns {void} Nothing.
   */
  dispose () {
    disposeAll(this);
  }
}

module.exports = FolderCrawler;
