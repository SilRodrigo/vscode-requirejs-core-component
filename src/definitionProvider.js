const { workspace, Uri, Location, Range, Position } = require('vscode')
const {
  findExtendMemberDefinition,
  findIdentifier,
  findFirstExtendCall,
  findFirstExtendBaseIdentifier
} = require('./codeParser')
const ModuleAnalyser = require('./moduleAnalyser')
const { hostOrCreateDisposable, disposeAll } = require('./disposableHost')

const MAX_PARENT_LOOKUP_DEPTH = 3
const MAX_EXTEND_MEMBER_PARENT_LEVELS = 3

/**
 * Provides the location of the definition of a selected identifier, if it is
 * located in a separate RequireJS module.
 */
class DefinitionProvider {
  /**
   * Initializes a new instance.
   * @param {ModuleAnalyser} moduleAnalyser Caching module analysis helper.
   */
  constructor (moduleAnalyser) {
    hostOrCreateDisposable(this, 'moduleAnalyser', ModuleAnalyser, moduleAnalyser)
  }

  /**
   * Diverges the search to the given module
   * @param {string} filePath File-system path of the target module
   * @param {string} searchFor The identifier to search for inside the module
   * @returns {Promise} Resolves with a file location
   */
  searchModule (filePath, searchFor, lookupState) {
    const state = lookupState || {
      depth: 0,
      visited: new Set()
    }
    const { depth, visited } = state

    if (depth >= MAX_PARENT_LOOKUP_DEPTH || visited.has(filePath)) {
      return Promise.resolve()
    }
    visited.add(filePath)

    const newUri = Uri.file(filePath)
    const newDocument = workspace.openTextDocument(newUri)

    return newDocument.then(async document => {
      const onlyNavigateToFile = workspace
        .getConfiguration('requireModuleSupport')
        .get('onlyNavigateToFile')

      // Some modules are source for RequireJS plugins and need not be written in JavaScript.
      if (!onlyNavigateToFile && searchFor &&
          (document.languageId === 'javascript' || document.languageId === 'javascriptreact')) {
        const astRoot = this.moduleAnalyser.getParsedModule(document)
        const range = findIdentifier(astRoot, searchFor)

        if (range) {
          return new Location(newUri, new Range(
            // Range is zero-based, esprima is one-based
            new Position(range.start.line - 1, range.start.column),
            new Position(range.end.line - 1, range.end.column)
          ))
        }

        const parentLocation = await this.searchMethodInParentModule(document, astRoot, searchFor, {
          depth: depth + 1,
          visited
        })
        if (parentLocation) {
          return parentLocation
        }

        const extendRange = findFirstExtendCall(astRoot)

        if (extendRange) {
          return new Location(newUri, new Range(
            // Range is zero-based, esprima is one-based
            new Position(extendRange.start.line - 1, extendRange.start.column),
            new Position(extendRange.end.line - 1, extendRange.end.column)
          ))
        }
      }

      if (!onlyNavigateToFile && !searchFor &&
        (document.languageId === 'javascript' || document.languageId === 'javascriptreact')) {
        const astRoot = this.moduleAnalyser.getParsedModule(document)
        const extendRange = findFirstExtendCall(astRoot)

        if (extendRange) {
          return new Location(newUri, new Range(
            // Range is zero-based, esprima is one-based
            new Position(extendRange.start.line - 1, extendRange.start.column),
            new Position(extendRange.end.line - 1, extendRange.end.column)
          ))
        }
      }

      return new Location(newUri, new Position(0, 0))
    })
  }

  /**
   * Searches for an extended member in local module first, then in parent
   * modules up the inheritance chain.
   * @param {string} filePath File-system path of the starting module.
   * @param {string} memberName The member to search for.
   * @param {Object} lookupState State with recursion depth and visited files.
   * @returns {Promise<Location|undefined>} Resolves with a definition location.
   */
  searchExtendMemberInHierarchy (filePath, memberName, lookupState) {
    const state = lookupState || {
      depth: 0,
      visited: new Set()
    }
    const { depth, visited } = state

    if (depth > MAX_EXTEND_MEMBER_PARENT_LEVELS || visited.has(filePath)) {
      return Promise.resolve()
    }
    visited.add(filePath)

    const newUri = Uri.file(filePath)
    const newDocument = workspace.openTextDocument(newUri)

    return newDocument.then(async document => {
      if (document.languageId === 'javascript' || document.languageId === 'javascriptreact') {
        const astRoot = this.moduleAnalyser.getParsedModule(document)
        const range = findExtendMemberDefinition(astRoot, memberName)

        if (range) {
          return new Location(newUri, new Range(
            new Position(range.start.line - 1, range.start.column),
            new Position(range.end.line - 1, range.end.column)
          ))
        }

        const dependencies = this.moduleAnalyser.getModuleDependencies(document, astRoot)
        const baseIdentifier = findFirstExtendBaseIdentifier(astRoot)

        if (baseIdentifier) {
          const dependency = dependencies[baseIdentifier]
          if (dependency && dependency.source) {
            const parentFilePath = this.moduleAnalyser.moduleResolver
              .resolveModulePath(dependency.source, document.fileName)

            if (parentFilePath) {
              return this.searchExtendMemberInHierarchy(parentFilePath, memberName, {
                depth: depth + 1,
                visited
              })
            }
          }
        }
      }
    })
  }

  /**
   * Tries to continue looking up the same method in the extended parent module.
   * @param {TextDocument} document Current module document.
   * @param {Object} astRoot Parsed current module AST.
   * @param {string} searchFor Method name to look up.
   * @param {Object} state Lookup recursion state.
   * @returns {Promise<Location|undefined>} Found parent method location.
   */
  async searchMethodInParentModule (document, astRoot, searchFor, state) {
    if (!searchFor) {
      return
    }

    const baseIdentifier = findFirstExtendBaseIdentifier(astRoot)
    if (!baseIdentifier) {
      return
    }

    const dependencies = this.moduleAnalyser.getModuleDependencies(document, astRoot)
    const dependency = dependencies[baseIdentifier]
    if (!(dependency && dependency.source)) {
      return
    }

    const parentFilePath = this.moduleAnalyser.moduleResolver
      .resolveModulePath(dependency.source, document.fileName)
    if (!parentFilePath) {
      return
    }

    return this.searchModule(parentFilePath, searchFor, state)
  }

  /**
   * Provide the definition of the symbol at the given position and document.
   * @param {TextDocument} document The document in which the command was invoked.
   * @param {Position} position The position at which the command was invoked.
   * @returns {Promise} Resolves with a file location.
   */
  async provideDefinition (document, position) {
    this.moduleAnalyser.startCollectingErrors()

    try {
      const moduleDependency = await this.moduleAnalyser.getOriginatingModuleDependency(document, position)

      // If the selected identifier cannot be tracked to other module,
      // let the built-in definition lookup handle it. The symbol definition
      // can be found, only if its originating module could be found.
      if (moduleDependency) {
        const filePath = moduleDependency.filePath

        if (filePath) {
          if (moduleDependency.lookupThisMemberInHierarchy) {
            return await this.searchExtendMemberInHierarchy(filePath, moduleDependency.selected)
          }

          return await this.searchModule(filePath, moduleDependency.selected)
        }
      }
    } finally {
      this.moduleAnalyser.reportErrors()
    }
  }

  /**
   * Disposes of disposable child objects.
   * @returns {void} Nothing.
   */
  dispose () {
    disposeAll(this)
  }
}

module.exports = DefinitionProvider
