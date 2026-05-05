const { workspace, Uri, Location, Range, Position } = require('vscode')
const { readFileSync, statSync } = require('fs')
const { join, dirname } = require('path')
const vm = require('vm')
const { findBlockDefinitions } = require('./xmlLayoutAnalyser')
const {
  findExtendMemberDefinition,
  findExtendMethodDefinitions,
  findIdentifier,
  findFirstExtendCall,
  findFirstExtendBaseIdentifier,
  findMethodCalls
} = require('./codeParser')
const { findMixinsTargets } = require('./appliedMixins')
const ModuleAnalyser = require('./moduleAnalyser')
const { hostOrCreateDisposable, disposeAll } = require('./disposableHost')

const DEFAULT_LOOKUP_MAX_LEVELS = 3

function normalizeLookupMaxLevels (value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback
}

function normalizePathPrefix (path) {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

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
    this.nsNavigationConfigCache = {
      configPath: undefined,
      mtimeMs: undefined,
      mappings: []
    }
  }

  getSettings () {
    return workspace.getConfiguration('requireModuleSupport')
  }

  getLookupMaxLevels () {
    const settings = this.getSettings()
    const configured = settings.get('lookupMaxLevels')

    if (Number.isInteger(configured) && configured >= 0) {
      return configured
    }

    // Backward compatibility with previous setting names.
    const legacy = settings.get('extendMemberLookupMaxLevels')
    if (Number.isInteger(legacy) && legacy >= 0) {
      return legacy
    }

    const oldLegacy = settings.get('parentLookupMaxLevels')
    return normalizeLookupMaxLevels(oldLegacy, DEFAULT_LOOKUP_MAX_LEVELS)
  }

  getExtendMemberResolutionOptions () {
    const settings = this.getSettings()

    return {
      observableDeclarationMethodNames: settings.get('observableDeclarationMethodNames') || ['declareObservables']
    }
  }

  getNsNavigationConfigFile () {
    return this.getSettings().get('nsNavigationConfigFile') || ''
  }

  getWorkspaceRootPath () {
    if (workspace.workspaceFile && workspace.workspaceFile.scheme !== 'untitled') {
      return dirname(workspace.workspaceFile.fsPath)
    }

    if (workspace.workspaceFolders && workspace.workspaceFolders.length) {
      return workspace.workspaceFolders[0].uri.fsPath
    }

    return process.env.VSCODE_REQUIREJS_WORKSPACE || ''
  }

  getNsNavigationMappings () {
    const configFile = this.getNsNavigationConfigFile()
    const rootPath = this.getWorkspaceRootPath()

    if (!configFile || !rootPath) {
      return []
    }

    const configPath = join(rootPath, configFile)

    try {
      const stats = statSync(configPath)
      const cached = this.nsNavigationConfigCache

      if (cached.configPath === configPath && cached.mtimeMs === stats.mtimeMs) {
        return cached.mappings
      }

      // Load config file - supports both .js (module.exports) and .json formats
      let config
      const fileContent = readFileSync(configPath, 'utf8')

      try {
        config = JSON.parse(fileContent)
      } catch (_jsonError) {
        try {
          const sandbox = { module: { exports: {} } }
          vm.runInNewContext(fileContent, sandbox)
          config = sandbox.module.exports
        } catch (_vmError) {
          return []
        }
      }

      const mappings = (config.mappings || [])
        .filter(mapping => mapping && typeof mapping.nsComponent === 'string')
        .map(mapping => {
          const scopeRoot = mapping.scopeRoot
          const scopeRoots = (Array.isArray(scopeRoot) ? scopeRoot : [scopeRoot])
            .filter(root => typeof root === 'string' && root.trim())
            .map(root => normalizePathPrefix(root.trim()))

          return {
            scopeRoots,
            nsComponent: mapping.nsComponent.trim()
          }
        })
        .filter(mapping => mapping.scopeRoots.length && mapping.nsComponent)

      this.nsNavigationConfigCache = {
        configPath,
        mtimeMs: stats.mtimeMs,
        mappings
      }

      return mappings
    } catch (_error) {
      return []
    }
  }

  resolveNsComponentModulePaths (currentFilePath) {
    const mappings = this.getNsNavigationMappings()

    if (!mappings.length) {
      return []
    }

    const currentModulePaths = this.moduleAnalyser.moduleResolver.unresolveFilePath(currentFilePath)

    if (!currentModulePaths.length) {
      return []
    }

    const normalizedCurrentModulePaths = currentModulePaths.map(path => normalizePathPrefix(path))

    let matched

    mappings.forEach(mapping => {
      mapping.scopeRoots.forEach(scopeRoot => {
        const matchedModulePath = normalizedCurrentModulePaths.find(modulePath => {
          return modulePath === scopeRoot || modulePath.startsWith(scopeRoot + '/')
        })

        if (!matchedModulePath) {
          return
        }

        if (!matched || scopeRoot.length > matched.scopeRoot.length) {
          matched = {
            scopeRoot,
            modulePath: matchedModulePath,
            nsComponent: mapping.nsComponent
          }
        }
      })
    })

    if (!matched) {
      return []
    }

    const candidates = [matched.nsComponent, matched.nsComponent + '/index']
    const suffix = matched.modulePath.substr(matched.scopeRoot.length)

    if (suffix && suffix !== '/' && !matched.nsComponent.endsWith(suffix)) {
      const withSuffix = matched.nsComponent + suffix
      candidates.push(withSuffix, withSuffix + '/index')
    }

    return Array.from(new Set(candidates))
  }

  async searchNsMemberInModule (filePath, memberName) {
    const state = {
      depth: 0,
      visited: new Set(),
      maxDepth: this.getLookupMaxLevels(),
      resolutionOptions: this.getExtendMemberResolutionOptions(),
      fallbackFilePaths: []
    }

    const location = await this.searchExtendMemberInHierarchy(filePath, memberName, state)

    if (location) {
      return location
    }

    return this.searchModule(filePath, memberName)
  }

  resolveNsMemberDefinition (document, memberName) {
    const nsComponentModulePath = this.resolveNsComponentModulePaths(document.fileName)[0]

    if (!nsComponentModulePath) {
      return
    }

    const filePaths = this.moduleAnalyser.moduleResolver.resolveExistingModulePaths(nsComponentModulePath, document.fileName)
    const filePath = filePaths.length
      ? filePaths[0]
      : this.moduleAnalyser.moduleResolver.resolveModulePath(nsComponentModulePath, document.fileName)

    if (!filePath) {
      return
    }

    return this.searchNsMemberInModule(filePath, memberName)
  }

  provideUseNsMemberDefinition (document, position) {
    const range = document.getWordRangeAtPosition(position)

    if (!range) {
      return
    }

    const memberName = document.getText(range)
    if (!memberName) {
      return
    }

    const line = document.lineAt(position.line).text
    const left = line.slice(0, range.start.character)
    const objectMatch = left.match(/([A-Za-z_$][\w$]*)\s*\.\s*$/)

    if (!objectMatch) {
      return
    }

    const nsParameterName = objectMatch[1]

    const fullText = document.getText()
    const caretOffset = document.offsetAt(range.start)
    const contextBefore = fullText.slice(0, caretOffset)
    const useNsPattern = /useNs\s*\(\s*(?:function\s*\(\s*([A-Za-z_$][\w$]*)\s*\)|\(\s*([A-Za-z_$][\w$]*)\s*\)\s*=>|([A-Za-z_$][\w$]*)\s*=>)/g

    let callbackParamName
    let match

    while ((match = useNsPattern.exec(contextBefore))) {
      callbackParamName = match[1] || match[2] || match[3]
    }

    if (!callbackParamName || callbackParamName !== nsParameterName) {
      return
    }

    return this.resolveNsMemberDefinition(document, memberName)
  }

  /**
   * Navigates from a <referenceBlock name="X"> to the <block name="X"> definition
   * in another XML file.
   */
  async provideXmlReferenceBlockDefinition (document, position) {
    const line = document.lineAt(position.line).text
    const refBlockMatch = line.match(/<referenceBlock\b[^>]*\bname="([^"]+)"/)
    if (!refBlockMatch) return

    const blockName = refBlockMatch[1]
    const definitions = await findBlockDefinitions(blockName, document.uri.fsPath, null)

    if (!definitions.length) return

    if (definitions.length === 1) {
      const { uri, line: lineIdx } = definitions[0]
      return new Location(uri, new Position(lineIdx, 0))
    }

    return definitions.map(({ uri, line: lineIdx }) => new Location(uri, new Position(lineIdx, 0)))
  }

  /**
   * Resolves module-like tokens in XML documents (attribute values or text nodes).
   * @param {TextDocument} document The current document.
   * @param {Position} position The cursor position.
   * @returns {Promise<Location|undefined>} Resolved module location, if any.
   */
  provideXmlModuleDefinition (document, position) {
    const modulePathRange = document.getWordRangeAtPosition(position, /[A-Za-z0-9_./!-]+/)

    if (!modulePathRange) {
      return Promise.resolve()
    }

    const modulePath = document.getText(modulePathRange)

    // Skip non-module tokens and relative paths.
    if (!modulePath || modulePath.indexOf('/') < 0 || modulePath.startsWith('./') || modulePath.startsWith('../')) {
      return Promise.resolve()
    }

    const filePaths = this.moduleAnalyser.moduleResolver.resolveExistingModulePaths(modulePath, document.fileName)

    if (filePaths.length > 1) {
      return Promise.all(filePaths.map(filePath => this.searchModule(filePath)))
    }

    const filePath = filePaths.length
      ? filePaths[0]
      : this.moduleAnalyser.moduleResolver.resolveModulePath(modulePath, document.fileName)

    if (!filePath) {
      return Promise.resolve()
    }

    return this.searchModule(filePath)
  }

  /**
   * Checks if a VS Code Position is within an AST node's location range.
   * Handles coordinate system conversion: VS Code uses 0-indexed lines, AST uses 1-indexed.
   * 
   * @param {Position} position The VS Code cursor position (0-indexed lines)
   * @param {Object} loc The AST node's location with {start, end} properties (1-indexed lines)
   * @returns {boolean} True if the position is within the AST location's bounds
   */
  isPositionWithinLoc (position, loc) {
    if (!(position && loc && loc.start && loc.end)) {
      return false
    }

    const line = position.line + 1
    const column = position.character

    if (line < loc.start.line || line > loc.end.line) {
      return false
    }

    if (line === loc.start.line && column < loc.start.column) {
      return false
    }

    if (line === loc.end.line && column > loc.end.column) {
      return false
    }

    return true
  }

  /**
   * Converts an AST node location to a VS Code Location object.
   * Handles coordinate system conversion: converts 1-indexed AST lines to 0-indexed VS Code positions.
   * 
   * @param {Uri} documentUri The URI of the document containing the location
   * @param {Object} loc The AST node's location with {start, end} properties (1-indexed lines)
   * @returns {Location} A VS Code Location object with proper 0-indexed coordinates
   */
  convertLocToLocation (documentUri, loc) {
    return new Location(documentUri, new Range(
      new Position(loc.start.line - 1, loc.start.column),
      new Position(loc.end.line - 1, loc.end.column)
    ))
  }

  /**
   * Provides method usage locations when hovering over a method name in `.extend({...})`.
   * 
   * Behavior:
   * - In core components: returns all call sites of the method within the file.
   * - In mixin files: returns all call sites in the mixin + the parent method in target component.
   * 
   * This enables quick navigation to parent method overrides for mixins specifically.
   * 
   * @param {TextDocument} document The current document
   * @param {Position} position The cursor position over the method name
   * @returns {Promise<Array|undefined>} Array of Locations with usages, or undefined if not in a method
   */
  async provideMethodUsageLocations (document, position) {
    const astRoot = this.moduleAnalyser.getParsedModule(document)
    const methodDefinition = findExtendMethodDefinitions(astRoot).find(method => {
      return this.isPositionWithinLoc(position, method.loc)
    })

    if (!methodDefinition) {
      return
    }

    const methodCalls = findMethodCalls(astRoot, methodDefinition.name)
    const localLocations = methodCalls.map(loc => this.convertLocToLocation(document.uri, loc))

    const mixinTargets = await findMixinsTargets(this.moduleAnalyser.moduleResolver, document.fileName)
    const targetFilePath = mixinTargets[0] && mixinTargets[0].targetFilePath
    if (!targetFilePath) {
      return localLocations.length ? localLocations : undefined
    }

    const parentLocation = await this.searchExtendMemberInHierarchy(targetFilePath, methodDefinition.name, {
      depth: 0,
      visited: new Set(),
      maxDepth: this.getLookupMaxLevels(),
      resolutionOptions: this.getExtendMemberResolutionOptions()
    })

    if (parentLocation) {
      localLocations.push(parentLocation)
    }

    return localLocations.length ? localLocations : undefined
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
      visited: new Set(),
      maxDepth: this.getLookupMaxLevels()
    }
    const { depth, visited, maxDepth } = state

    if (depth > maxDepth || visited.has(filePath)) {
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
          visited,
          maxDepth
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
      visited: new Set(),
      maxDepth: this.getLookupMaxLevels(),
      resolutionOptions: this.getExtendMemberResolutionOptions(),
      fallbackFilePaths: []
    }
    const { depth, visited, maxDepth, resolutionOptions, fallbackFilePaths = [] } = state

    if (depth > maxDepth || visited.has(filePath)) {
      return Promise.resolve()
    }
    visited.add(filePath)

    const newUri = Uri.file(filePath)
    const newDocument = workspace.openTextDocument(newUri)

    return newDocument.then(async document => {
      if (document.languageId === 'javascript' || document.languageId === 'javascriptreact') {
        const astRoot = this.moduleAnalyser.getParsedModule(document)
        const range = findExtendMemberDefinition(astRoot, memberName, resolutionOptions)

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
              return await this.searchExtendMemberInHierarchy(parentFilePath, memberName, {
                depth: depth + 1,
                visited,
                maxDepth,
                resolutionOptions,
                fallbackFilePaths
              })
            }
          }
        }

        if (fallbackFilePaths.length) {
          const [nextFallbackFilePath, ...remainingFallbackFilePaths] = fallbackFilePaths

          return await this.searchExtendMemberInHierarchy(nextFallbackFilePath, memberName, {
            depth: depth + 1,
            visited,
            maxDepth,
            resolutionOptions,
            fallbackFilePaths: remainingFallbackFilePaths
          })
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

    return await this.searchModule(parentFilePath, searchFor, state)
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
      if (document.languageId === 'xml') {
        const refBlockDef = await this.provideXmlReferenceBlockDefinition(document, position)
        if (refBlockDef) return refBlockDef
        return await this.provideXmlModuleDefinition(document, position)
      }

      const useNsDefinition = await this.provideUseNsMemberDefinition(document, position)
      if (useNsDefinition) {
        return useNsDefinition
      }

      const methodUsageLocations = await this.provideMethodUsageLocations(document, position)
      if (methodUsageLocations) {
        return methodUsageLocations
      }

      const moduleDependency = await this.moduleAnalyser.getOriginatingModuleDependency(document, position)

      // If the selected identifier cannot be tracked to other module,
      // let the built-in definition lookup handle it. The symbol definition
      // can be found, only if its originating module could be found.
      if (moduleDependency) {
        const filePaths = moduleDependency.filePaths
        const filePath = moduleDependency.filePath

        if (filePaths && filePaths.length > 1) {
          const locations = await Promise.all(filePaths.map(path => {
            return this.searchModule(path, moduleDependency.selected)
          }))

          return locations.filter(Boolean)
        }

        if (filePath) {
          if (moduleDependency.lookupThisMemberInHierarchy || moduleDependency.lookupSuperMemberInHierarchy) {
            const fallbackFilePaths = moduleDependency.mixinTargetFilePath
              ? [moduleDependency.mixinTargetFilePath]
              : []

            return await this.searchExtendMemberInHierarchy(filePath, moduleDependency.selected, {
              depth: 0,
              visited: new Set(),
              maxDepth: this.getLookupMaxLevels(),
              resolutionOptions: this.getExtendMemberResolutionOptions(),
              fallbackFilePaths
            })
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
