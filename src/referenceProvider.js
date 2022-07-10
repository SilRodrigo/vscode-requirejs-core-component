const { workspace, Uri, Location, Range, Position } = require('vscode');
const { findAllIdentifiers } = require('./codeParser');
const { findModulePaths, getFileStateAndContent } = require('./fileAccess');
const ModuleAnalyser = require('./moduleAnalyser');
const StatusNotifier = require('./statusNotifier');
const { hostOrCreateDisposable, disposeAll } = require('./disposableHost');
const push = Array.prototype.push;

/**
 * Provides locations of references to a selected identifier, either an object
 * or is member property or method, across all RequireJS modules.
 */
class ReferenceProvider {
  /**
   * Initializes a new instance.
   * @param {ModuleAnalyser} moduleAnalyser Caching module analysis helper.
   * @param {StatusNotifier} statusNotifier Status bar notification helper.
   */
  constructor (moduleAnalyser, statusNotifier) {
    hostOrCreateDisposable(this, 'moduleAnalyser', ModuleAnalyser, moduleAnalyser);
    hostOrCreateDisposable(this, 'statusNotifier', StatusNotifier, statusNotifier);
  }

  /**
   * Adapt cache sizes, so that they can handle at least the specified
   * project file count.
   * @param {number} fileCount The expected file count to handle
   * @returns {Void} Nothing.
   */
  adaptCacheSizes (fileCount) {
    const dynamicModuleCacheSize = workspace
      .getConfiguration('requireModuleSupport')
      .get('dynamicModuleCacheSize');

    if (dynamicModuleCacheSize) {
      const dynamicModuleCacheSizeExtra = workspace
        .getConfiguration('requireModuleSupport')
        .get('dynamicModuleCacheSizeExtra') || 10;
      const neededModuleCacheSize = parseInt(fileCount
        * (100 + dynamicModuleCacheSizeExtra) / 100.0, 10);

      this.moduleAnalyser.adaptCacheSizes(neededModuleCacheSize);
    }
  }

  /**
   * Finds modules, which use the same identifier.
   * @param {Object} originatingModule Information about the originating module of the identifier to look up.
   * - {String} modulePaths Possible RequireJS paths of the target module.
   * - {String} filePath Full file-system path of the target module.
   * - {String} identifier The identifier to search for inside the module.
   * - {Boolean} isMember If the identifier is a property in a member expression or an object identifier.
   * @param {Array} projectFilePaths All JavaScript modules in this project.
   * @param {CancellationToken} cancellationToken A cancellation token.
   * @param {Array} references Output parameter for gathering module references.
   * @returns {Promise} Resolves with all usage references of the selected identifier.
   */
  findModuleReferences (originatingModule, projectFilePaths, cancellationToken, references) {
    const { modulePaths, filePath, identifier, isMember } = originatingModule;
    const moduleAnalyser = this.moduleAnalyser;
    const outputReferences = references || [];

    // Convert a ESTree text range object to a Range instance.
    function convertRange (range) {
      const start = range.start;
      const end = range.end;

      return new Range(
        // Range is zero-based, esprima is one-based
        new Position(start.line - 1, start.column),
        new Position(end.line - 1, end.column)
      );
    }

    // For the originating module, return all occurrences of the identifier.
    function getOriginatingModuleReferences (projectFile, projectFilePath) {
      const astRoot = moduleAnalyser.getParsedModule(projectFile, projectFilePath);

      return findAllIdentifiers(astRoot, identifier, isMember, true);
    }

    // For other than originating modules, check, if they depend on the
    // originating module and if they do, find all occurrences of the
    // identifier there.
    function getDependentModuleReferences (projectFile, projectFilePath) {
      const astRoot = moduleAnalyser.getParsedModule(projectFile, projectFilePath);
      const moduleDependencies = moduleAnalyser.getModuleDependencies(projectFile, astRoot) || {};
      let ranges;

      // Find the dependency on the originating module; the first one is enough.
      // As soon as it is found, find all occurrences of the identifier there.
      Object.keys(moduleDependencies).some(formalParameter => {
        if (modulePaths.indexOf(moduleDependencies[formalParameter]) >= 0) {
          // If the identifier belongs to a member, look it up as-is.
          // If it denotes an object, which meant a dependent module
          // export in the module, where the search was started, look
          // up the same object in the current module, which means
          // searching for the formal parameter pointing to the same
          // module.
          ranges = findAllIdentifiers(astRoot,
            isMember ? identifier : formalParameter, isMember);

          return true;
        }

        return false;
      });

      return ranges || [];
    }

    this.statusNotifier.notify('search', 'Analysing ' + projectFilePaths.length + '...',
      'Analysing files... (remaining ' + projectFilePaths.length + ')');

    // Limit the number of files being analysed. When working
    // by batches, the operation will be stoppable after every batch.
    const promises = projectFilePaths.splice(0, this.batchSize)
      .map(projectFilePath => {
        // const message = `Analysing "${workspace.asRelativePath(projectFilePath, false)}".`;
        // console.time(message);
        return getFileStateAndContent(projectFilePath).then(projectFile => {
          // console.timeLog(message);
          // The currently opened module is the originating module. It does
          // not need the check, if it depends on the originating module.
          const getModuleReferences = filePath === projectFilePath
            ? getOriginatingModuleReferences
            : getDependentModuleReferences;

          push.apply(outputReferences,
            getModuleReferences(projectFile, projectFilePath)
              .map(convertRange)
              .map(range => new Location(Uri.file(projectFilePath), range)));
          // console.timeEnd(message);
        });
      });

    return Promise.all(promises)
      .then(() => {
        // Stop processing if this was the last batch or the operation has been cancelled.
        if (!projectFilePaths.length || cancellationToken.isCancellationRequested) {
          return outputReferences;
        }

        // Process the rest of items after cutting off the batch above.
        // Pump the event loop to allow other components cancel the
        // operation by forcing asynchronous processing.
        return new Promise((resolve, reject) => {
          setImmediate(() => {
            this.findModuleReferences(originatingModule, projectFilePaths,
              cancellationToken, outputReferences)
              .then(resolve)
              .catch(reject);
          });
        });
      });
  }

  /**
   * Provide a set of project-wide references for the given position and document.
   * @param {TextDocument} document The document in which the command was invoked.
   * @param {Position} position The position at which the command was invoked.
   * @param {Object} options Contextual command options.
   * @param {CancellationToken} cancellationToken A cancellation token.
   * @returns {Promise} Resolves with a file location.
   */
  async provideReferences (document, position, _options, cancellationToken) {
    const moduleDependency = await this.moduleAnalyser.getOriginatingModuleDependency(document, position);

    // If the selected identifier cannot be tracked to other module,
    // let the built-in reference lookup handle it. Only references
    // connected by their common originating module ought to be trusted.
    if (moduleDependency) {
      const { modulePath, referencePaths, filePath, selected, isMember } = moduleDependency;

      if (filePath && (isMember || selected === moduleDependency.imported)) {
        this.statusNotifier.show();
        this.statusNotifier.notify('telescope', 'Globbing...',
          'Looking up all modules...');

        return findModulePaths(cancellationToken)
          .then(projectFilePaths => {
            this.adaptCacheSizes(projectFilePaths.length);

            // Remember the fresh value of the batch of files to process
            // concurrently; it is used by `getDependentModuleReferences`
            // in `findModuleReferences`.
            this.batchSize = workspace
              .getConfiguration('requireModuleSupport')
              .get('moduleProcessingBatchSize');

            return this.findModuleReferences({
              modulePaths: modulePath ? [modulePath] : referencePaths,
              filePath: filePath,
              identifier: selected,
              isMember: isMember
            }, projectFilePaths, cancellationToken);
          })
          .then(references => {
            this.statusNotifier.notify('check', references.length + ' refs found.',
              'File analysis finished. ' + references.length + ' references found.');
            this.statusNotifier.hide();

            return references;
          }, error => {
            this.statusNotifier.notify('alert', 'Refs unavailable.',
              'File analysis failed: ' + error.message);
            this.statusNotifier.hide();
            throw error;
          });
      }
    }

    this.statusNotifier.show();
    this.statusNotifier.notify('stop', 'No module.',
      'No originating module found.');
    this.statusNotifier.hide();
  }

  /**
   * Disposes of disposable child objects.
   * @returns {void} Nothing.
   */
  dispose () {
    disposeAll(this);
  }
}

module.exports = ReferenceProvider;
