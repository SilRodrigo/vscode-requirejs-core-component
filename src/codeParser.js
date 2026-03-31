/**
 * Parses JavaScript sources to an AST and searches the AST for identifiers.
 * @namespace codeParser
 */
const { parse } = require('meriyah')
const { walk, walkAtPosition } = require('estree-walkie')

/**
 * Parses the input JavaScript text and returns a AST of it. Expects a
 * JavaScript content. The returned object can be used later in other calls,
 * or to other module analysis.
 * @param {string} content File content of an AMD module.
 * @param {Object} options Optional. Options for the `esprima` parser: Only
 * `range` and `loc` properties are recognized.
 * @returns {Object} Parsed AST root.
 * @throws {Error} If the input content is not a valid JavaScript.
 * @memberof codeParser
 */
function parseModule (content, options = {}) {
  return parse(content, {
    next: true,
    impliedStrict: false,
    globalReturn: true,
    module: options.module,
    ranges: options.ranges || options.range,
    loc: options.loc,
    jsx: options.jsx
  })
}

/**
 * Finds all occurrences of the specified identifier.
 * @param {Object} astRoot Parsed document.
 * @param {string} identifier Identifier to look for.
 * @param {boolean} isMember If the identifier is a property in a member expression or an object identifier.
 * @param {boolean} allowObjectProperties If expressions like {member: ...}
 *   should be looked up too, or if only expressions like object.member
 *   should be looked up, if isMember is true.
 * @returns {Array} Ranges, where the identifier was found as
 * {start,end} objects with {line,column} sub-objects.
 * @memberof codeParser
 */
function findAllIdentifiers (astRoot, identifier, isMember, allowObjectProperties) {
  const locations = []

  // Detect an "object.member" expression.
  function isMemberParent (node, parent) {
    return parent && parent.type === 'MemberExpression'
      && parent.computed === false && parent.property === node
  }

  // Detect an "{member: ...}" expression.
  function isObjectPropertyParent (_node, parent) {
    return parent && parent.type === 'Property'
      && parent.computed === false && parent.kind === 'init'
  }

  walk(astRoot, {
    Identifier(node, _state, parent) {
      if (node.name === identifier && (isMember
        ? isMemberParent(node, parent) || allowObjectProperties && isObjectPropertyParent(node, parent)
        : !(isMemberParent(node, parent) || isObjectPropertyParent(node, parent))
      )) {
        const loc = node.loc
        if (loc) locations.push(loc)
      }
    }
  })

  return locations
}

/**
 * Finds the first occurrence of the specified identifier.
 * @param {Object} astRoot Parsed document.
 * @param {string} identifier Identifier to look for.
 * @returns {Object} Range, where the identifier was found as
 * {start,end} object with {line,column} sub-objects.
 * @memberof codeParser
 */
function findIdentifier (astRoot, identifier) {
  let loc

  try {
    walk(astRoot, {
      Identifier(node) {
        if (node.name === identifier) {
          loc = node.loc
          throw 0
        }
      }
    })
  } catch (err) {
    if (typeof err !== 'number') throw err
  }

  return loc
}

/**
 * Finds the first occurrence of a call expression with callee ending in
 * `.extend(...)`, such as `Component.extend(...)`.
 * @param {Object} astRoot Parsed document.
 * @returns {Object} Range, where the `.extend` property was found as
 * {start,end} object with {line,column} sub-objects.
 * @memberof codeParser
 */
function findFirstExtendCall (astRoot) {
  let loc

  try {
    walk(astRoot, {
      CallExpression(node) {
        const { callee } = node

        if (callee && callee.type === 'MemberExpression' &&
          callee.computed === false && callee.property &&
          callee.property.type === 'Identifier' && callee.property.name === 'extend') {
          loc = callee.property.loc
          throw 0
        }
      }
    })
  } catch (err) {
    if (typeof err !== 'number') throw err
  }

  return loc
}

/**
 * Finds the base object identifier of the first call expression ending in
 * `.extend(...)`, such as `Component.extend(...)`.
 * @param {Object} astRoot Parsed document.
 * @returns {string} Identifier name of the extended object.
 * @memberof codeParser
 */
function findFirstExtendBaseIdentifier (astRoot) {
  let name

  try {
    walk(astRoot, {
      CallExpression(node) {
        const { callee } = node

        if (callee && callee.type === 'MemberExpression' &&
          callee.computed === false && callee.property &&
          callee.property.type === 'Identifier' && callee.property.name === 'extend' &&
          callee.object && callee.object.type === 'Identifier') {
          name = callee.object.name
          throw 0
        }
      }
    })
  } catch (err) {
    if (typeof err !== 'number') throw err
  }

  return name
}

function getPropertyName (property) {
  const { key, computed } = property
  if (!key || computed) return undefined
  if (key.type === 'Identifier') return key.name
  if (key.type === 'Literal' && typeof key.value === 'string') return key.value
}

function isExtendCall (node) {
  const { callee } = node || {}

  return callee && callee.type === 'MemberExpression' &&
    callee.computed === false && callee.property &&
    callee.property.type === 'Identifier' && callee.property.name === 'extend'
}

function findExtendObject (callExpression) {
  const { arguments: args = [] } = callExpression || {}

  return args.find(argument => argument && argument.type === 'ObjectExpression')
}

function findObservableAssignmentInFunction (functionNode, memberName) {
  let loc

  try {
    walk(functionNode.body, {
      AssignmentExpression(node) {
        const { left, operator } = node

        if (operator !== '=' || !(left && left.type === 'MemberExpression' && left.computed === false)) {
          return
        }

        const { object, property } = left
        if (object && object.type === 'ThisExpression' &&
          property && property.type === 'Identifier' && property.name === memberName &&
          property.loc) {
          loc = property.loc
          throw 0
        }
      }
    })
  } catch (err) {
    if (typeof err !== 'number') throw err
  }

  return loc
}

function normalizeExtendMemberResolutionOptions (options = {}) {
  const normalized = {
    observableDeclarationMethodNames: ['declareObservables']
  }

  const { observableDeclarationMethodNames } = options

  if (Array.isArray(observableDeclarationMethodNames)) {
    const names = observableDeclarationMethodNames
      .filter(name => typeof name === 'string')
      .map(name => name.trim())
      .filter(Boolean)

    if (names.length) {
      normalized.observableDeclarationMethodNames = names
    }
  }

  return normalized
}

/**
 * Finds member definition in an object passed to `*.extend({...})`.
 * It prioritizes `defaults.member`, then method/property `member`.
 * @param {Object} astRoot Parsed document.
 * @param {string} memberName Member to look for.
 * @returns {Object} Range of the matching property key.
 * @memberof codeParser
 */
function findExtendMemberDefinition (astRoot, memberName, options) {
  const {
    observableDeclarationMethodNames
  } = normalizeExtendMemberResolutionOptions(options)
  let loc

  try {
    walk(astRoot, {
      CallExpression(node) {
        if (!isExtendCall(node)) {
          return
        }

        const extendObject = findExtendObject(node)
        if (!extendObject) return

        const bodyProperties = extendObject.properties || []

        const defaults = bodyProperties.find(property => {
          return property && property.type === 'Property' &&
            getPropertyName(property) === 'defaults'
        })

        if (defaults && defaults.value && defaults.value.type === 'ObjectExpression') {
          const defaultProperty = (defaults.value.properties || []).find(property => {
            return property && property.type === 'Property' &&
              getPropertyName(property) === memberName
          })

          if (defaultProperty && defaultProperty.key && defaultProperty.key.loc) {
            loc = defaultProperty.key.loc
            throw 0
          }
        }

        const declareObservables = bodyProperties.find(property => {
          if (!(property && property.type === 'Property' &&
            observableDeclarationMethodNames.includes(getPropertyName(property)))) {
            return false
          }

          return property.method ||
            property.value && (property.value.type === 'FunctionExpression' ||
              property.value.type === 'ArrowFunctionExpression')
        })

        const declareObservablesFunction = declareObservables &&
          (declareObservables.value && declareObservables.value.type !== 'Identifier'
            ? declareObservables.value
            : declareObservables)
        if (declareObservablesFunction && declareObservablesFunction.body) {
          const observableProperty = findObservableAssignmentInFunction(
            declareObservablesFunction,
            memberName
          )

          if (observableProperty) {
            loc = observableProperty
            throw 0
          }
        }

        const methodProperty = bodyProperties.find(property => {
          if (!(property && property.type === 'Property' && getPropertyName(property) === memberName)) {
            return false
          }

          return property.method ||
            property.value && (property.value.type === 'FunctionExpression' ||
              property.value.type === 'ArrowFunctionExpression')
        })

        if (methodProperty && methodProperty.key && methodProperty.key.loc) {
          loc = methodProperty.key.loc
          throw 0
        }
      }
    })
  } catch (err) {
    if (typeof err !== 'number') throw err
  }

  return loc
}

/**
 * Returns AST nodes for the identifier the expression around it, or nothing,
 * if there is no identifier within the specified range.
 * Sets `parent` properties pointing to parent nodes down to the identifier,
 * which it finds, to be able to better analyze the code later.
 * @param {Object} astRoot Parsed document.
 * @param {Object} range Range, where the identifier is supposed to be.
 * @returns {Object} The identifier node.
 * @memberof codeParser
 */
function findIdentifierOrLiteralWithinRange (astRoot, range) {
  // vscode.Range is zero-based, esprima's range is one-based
  const line = range.start.line + 1
  const column = range.start.character
  let currentNode

  try {
    walkAtPosition(astRoot, line, column, {
      // The selected range has to be an identifier to be valid for "Go to Definition".
      Identifier(node, _state, parent) {
        // Remember parent nodes down to the identifier, which it finds,
        // to be able to better analyze the code later.
        node.parent = parent
        currentNode = node
        // Stop traversing, if we passed the line with the caret selection.
        throw 0
      },
      // The selected range has to be an identifier to be valid for "Go to Definition".
      Literal(node, _state, parent) {
        node.parent = parent
        currentNode = node
        throw 0
      }
    }, (node, _state, parent) => {
      node.parent = parent
    })
  } catch (err) {
    if (typeof err !== 'number') throw err
  }

  return currentNode
}

module.exports = {
  findAllIdentifiers,
  findExtendMemberDefinition,
  findIdentifier,
  findFirstExtendCall,
  findFirstExtendBaseIdentifier,
  findIdentifierOrLiteralWithinRange,
  parseModule
}
