/**
 * Traverses JavaScript AST and searches for module dependencies and other
 * artifacts related to analysis of RequireJS * modules.
 * @namespace codeAnalyser
 */
 const { walk } = require('estree-walkie')

/**
 * Returns the name of the identifier, which is returned from a JavaScript
 * module as its export. It works well, only if module set their exports to
 * a variable first and return the export by that variable.
 * @param {Object} astRoot Parsed document
 * @returns {string} The name of the export identifier, if found.
 * @memberof codeParser
 */
function findModuleExport (astRoot) {
  // Inspect only the outermost `define` or `require` statement.
  if (!(astRoot && astRoot.type === 'Program')) return undefined

  const programBody = astRoot.body || []
  let identifier = null
  let callback

  // Find and only the first `define` or `require` statement and remember
  // its module callback.
  programBody.some(statement => {
    if (!statement) return false

    const { type } = statement

    if (type === 'ExpressionStatement') {
      const expression = statement.expression

      if (expression && expression.type === 'CallExpression') {
        const callee = expression.callee

        if (callee && callee.type === 'Identifier'
          && (callee.name === 'define' || callee.name === 'require')) {
          const parameters = expression.arguments || []

          callback = parameters.find(parameter => {
            return parameter && (parameter.type === 'FunctionExpression' ||
              parameter.type === 'ArrowFunctionExpression')
          })

          return true
        }
      }
    } else if (type === 'ExportDefaultDeclaration') {
      const { declaration } = statement
      const { type } = declaration

      identifier = null

      if (type === 'Identifier') {
        identifier = declaration.name
      } else if (type === 'AssignmentExpression') {
        const { left } = declaration
        if (left.type === 'Identifier') identifier = left.name
      } else if (type === 'FunctionDeclaration') {
        const { id } = declaration
        if (id) identifier = id.name
      }
      return true
    } else if (type === 'ExportNamedDeclaration') {
      identifier = null
      return true
    }

    return false
  })

  if (identifier !== undefined) return identifier

  if (!callback) return undefined

  return findBodyReturn(callback.body)
}

/**
 * Returns the name of the identifier, which is returned from a JavaScript
 * module as its export. It works well, only if module set their exports to
 * a variable first and return the export by that variable.
 * @param {Object} astRoot Parsed document
 * @returns {string} The name of the export identifier, if found.
 * @memberof codeParser
 */
 function findBodyReturn (block) {
  if (!(block && block.type === 'BlockStatement')) {
    return undefined
  }
  const body = block.body || []

  // Find the last "return" statement in the module callback. If it returns
  // an identifier, consider it the exported object's name. If it returns
  // oa object, mark it by the special "." identifier.
  for (let i = body.length; --i >= 0;) {
    const statement = body[i]

    if (statement && statement.type === 'ReturnStatement') {
      const argument = statement.argument

      if (argument.type === 'Identifier') {
        return argument.name
      } else if (argument.type === 'ObjectExpression') {
        return '.'
      } else {
        return null
      }
    }
  }

  return undefined
}

/**
 * Returns map of local variables and their initializing ones from expressions,
 * which just assign one identifier to another, or assign a variable a value
 * by a "new" expression.
 * @param {Object} astRoot Parsed document.
 * @param {Object} stopNode Node, which the declarations have to precede.
 * @returns {Object} A map "variable identifier" -> "dependency identifier".
 * @memberof codeParser
 * @inner
 */
function getVariableAssignments (astRoot, stopNode) {
  const assignments = {}

  function getAssignmentValue (node) {
    if (node) {
      // Support assignment "... = imported"
      if (node.type === 'Identifier') return node.name
      // Support assignment "... = new Imported"
      if (node.type === 'NewExpression') {
        const callee = node.callee
        if (callee && callee.type === 'Identifier') return callee.name
      }
    }
  }

  function handleAssignment (leftNodeName, rightNode) {
    const rightValue = getAssignmentValue(rightNode)
    if (rightValue) {
      assignments[leftNodeName] = { local: rightValue }
    }
  }

  function handleSpread (leftNodes, rightNode) {
    const rightValue = getAssignmentValue(rightNode)
    if (rightValue) {
      for (const { key, value } of leftNodes) {
        if (key.type === 'Identifier') {
          const { type } = value
          if (type === 'Identifier') {
            // Support assignment "{ local } = imported"
            assignments[value.name] = { property: key.name, local: rightValue }
          } else if (type === 'AssignmentPattern') {
            // Support assignment "{ local = ... } = imported"
            if (value.left && value.left.type === 'Identifier') {
              assignments[value.left.name] = { property: key.name, local: rightValue }
            }
          }
        }
      }
    }
  }

  try {
    walk(astRoot, {
      VariableDeclarator(node) {
        if (node === stopNode) throw 0
        if (node.id && node.init) {
          const { type } = node.id
          if (type === 'Identifier') {
            // Support declaration "var local = imported"
            handleAssignment(node.id.name, node.init)
          } else if (type === 'ObjectPattern') {
            // Support declaration "var { local } = imported"
            handleSpread(node.id.properties, node.init)
          }
        }
      },
      AssignmentExpression(node) {
        if (node === stopNode) throw 0
        if (node.left && node.right) {
          const { type } = node.left
          // Support assignment "local = imported"
          if (type === 'Identifier') {
            handleAssignment(node.left.name, node.right)
          } else if (type === 'ObjectPattern') {
            // Support declaration "var { local } = imported"
            handleSpread(node.left.properties, node.right)
          }
        }
      }
    }, node => {
      if (node === stopNode) throw 0
    })
  } catch (err) {
    if (typeof err !== 'number') throw err
  }

  return assignments
}

/**
 * Returns identifiers for the "Go to Definition lookup. The "imported" one used
 * as formal parameter for the dependent module's export and the "selected" one,
 * which is either the same one, or is child property, which eas selected.
 * @param {Object} astRoot Parsed document
 * @param {Object} identifier AST nodes for the selected identifier
 * @param {Object} moduleDependencies Map of formal parameter name to RequireJS module name
 * @returns {Object} Dependency as {modulePath, selected}, where modulePath
 * is unparsed RequireJS module path and selected the identifier to look
 * for in the dependent module.
 * @memberof codeParser
 */
function findOriginatingModuleDependency (astRoot, identifier, moduleDependencies) {
  let selected = identifier.name
  let isMember = false
  let imported, modulePath

  // Returns the module name from a `require(...)` call expression.
  function getRequiredModule (call) {
    const callee = call.callee
    const parameters = call.arguments

    // Recognize "module" in a "require('module')" expression.
    if (callee && callee.type === 'Identifier'
      && (callee.name === 'require' || callee.name === 'requirejs')
      && parameters && parameters.length === 1) {
      const firstParameter = parameters[0]

      if (firstParameter && firstParameter.type === 'Literal') {
        return firstParameter.value
      }
    }

    return undefined
  }

  // Remembers the object name from a dereferencing expression, ignoring
  // the `prototype` sub-object, if it accesses a prototype member.
  function detectTargetObject (object) {
    const type = object.type

    if (type === 'Identifier') {
      // Recognize "object" in an "object.member" or in an
      // "object = {...}" expression.
      imported = object.name

      return true
    }
    if (type === 'MemberExpression' && object.computed === false) {
      const superProperty = object.property
      const superObject = object.object

      // Recognize "object" in a "object.prototype.member" or in an
      // "object.prototype = {...}" expression.
      if (superProperty && superProperty.type === 'Identifier'
        && superProperty.name === 'prototype'
        && superObject && superObject.type === 'Identifier') {
        imported = superObject.name

        return true
      }
    }

    return false
  }

  // Detects an object expression, which is being returned as the module
  // export, or assigned to a local variable, probably to return later.
  function detectExportedObject (object) {
    if (object.type === 'ObjectExpression') {
      const assignment = object.parent

      if (assignment) {
        const type = assignment.type

        if (type === 'AssignmentExpression') {
          // Recognize "object" in a "object = {member: ...}" expression.
          const left = assignment.left

          if (left) {
            detectTargetObject(left)
          }
        } else if (type === 'ReturnStatement') {
          // Recognize "return {member: ...}" expression.
          imported = '.'
        }
      }
    } else if (object.type === 'ObjectPattern') {
      const declarator = object.parent

      if (declarator) {
        const type = declarator.type

        if (type === 'VariableDeclarator') {
          // Recognize "member" in a "{member: ...} = object" expression.
          const { init } = declarator

          if (init) {
            detectTargetObject(init)
          }
        }
      }
    }
  }

  // Relates the selected identifier to a formal parameter representing
  // the originating module of the dependent object.
  function searchForModuleDependencyInExpression () {
    const parent = identifier.parent
    const parentType = parent.type

    // Support selecting "member" within an "object.member" or
    // "{member: ...}" expressions, otherwise just take the selected
    // identifier as the symbol to look for.
    if (parentType === 'MemberExpression' && parent.computed === false) {
      const property = parent.property
      const object = parent.object

      if (property && property.name === selected && object) {
        const type = object.type

        isMember = true
        // Try to detect the dereferenced object in an "object.member"
        // expression first, then check, if the object is not a result
        // of a local `require()` call.
        if (!detectTargetObject(object) && type === 'CallExpression') {
          // Recognize "member" in a "require('module').member" expression.
          modulePath = getRequiredModule(object)
        }
      }
    } else if (parentType === 'Property' && parent.computed === false) {
      const { key, value } = parent

      if (key && key.name === selected && value) {
        const object = parent.parent

        isMember = true
        // Recognize "member" in a "{member: require('module')}"
        // expression.
        if (value.type === 'CallExpression') {
          modulePath = getRequiredModule(value)
        }
        // Detect the target, where object expression "{member: ...}"
        // is being assigned.
        if (object) {
          detectExportedObject(object)
        }
      }
    }
  }

  // Tracks the path from a local variable to a formal parameter
  // representing the originating module of the dependent object.
  function searchForModuleDependencyInVariables () {
    const assignments = getVariableAssignments(astRoot, identifier)

    // Lookup the last track of the dependency in the list of all
    // variables.
    for (let declared = assignments[imported], original = declared; declared;
         isMember = false, declared = assignments[imported]) {
      // Prevent endless loop, if the code is invalid and contains
      // a declaration with the variable and the expression the other
      // way round.
      delete assignments[imported]
      imported = declared.local

      const dependency = moduleDependencies[imported]
      if (dependency) {
        modulePath = dependency.source
        const { property } = dependency
        if (property) {
          selected = property
        } else {
          // If the real import was just renamed by a declaration, use
          // its parameter name to look it up in the originating module.
          if (!isMember) {
            selected = original.property || imported
          }
        }
        break
      }
    }
  }

  // Start by analysing the expression either a direct function call or
  // a dereferenced member call.
  searchForModuleDependencyInExpression()

  // Exported identifiers usually equal to formal parameters used for importing.
  if (!imported) {
    imported = selected
  }

  // Unless the module has been inferred from the CJS syntax, look it up from
  // the declared dependency list.
  if (!modulePath) {
    const dependency = moduleDependencies[imported]
    if (dependency) {
      modulePath = dependency.source
    }
  }

  // If the identifier is missing among the formal parameters, it may be
  // declared locally and assigned the imported dependency.
  if (!modulePath) {
    searchForModuleDependencyInVariables()
  }

  return {
    modulePath: modulePath,
    imported: imported,
    selected: selected,
    isMember: isMember
  }
}

module.exports = {
  findModuleExport, findBodyReturn, findOriginatingModuleDependency
}
