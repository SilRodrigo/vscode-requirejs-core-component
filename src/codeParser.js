const amodroParse = require('amodro-trace/parse');
const esprima = require('esprima');

/**
	 * Parses the input JavaScript text and returns a AST of it. Expects a
	 * JavaScript content. The returned object can be used later in other calls,
	 * or to other module analysis.
	 *
	 * @param {String} contents File contents of an AMD module.
	 * @param {Object} options Optional. Options for the `esprima` parser: Only
	 * `range` and `loc` properties are recognized.
	 * @returns {Object} Parsed AST root.
	 */
function parse (contents, options) {
	const localOptions = options || {};

	return esprima.parse(contents, {
		range: localOptions.range,
		loc: localOptions.loc
	});
}

/**
	 * Finds the first occurrence of the specified identifier.
	 * @param {Object} astRoot Parsed document.
	 * @param {String} identifier Identifier to look for.
	 *
	 * @returns {Object} Range, where the identifer was found as
	 * {start,end} object with {line,column} sub-objects.
	 */
function findIdentifier (astRoot, identifier) {
	let loc;

	amodroParse.traverse(astRoot, node => {
		if (node && node.type === 'Identifier' && node.name === identifier) {
			loc = node.loc;

			return false;
		}

		return true;
	});

	return loc;
}

/**
	 * Returns AST nodes for the identifier the expression around it, or nothing,
	 * if there is no identifier within the specified range.
	 * @param {Object} astRoot Parsed document.
	 * @param {Object} range Range, where the identifier is supposed to be.
	 * @returns {Object} Contains currentNode and parentNode objects.
	 */
function findIdentifierWithinRange (astRoot, range) {
	// vscode.Range is zero-based, esprima's range is one-based
	const line = range.start.line + 1;
	const column = range.start.character;
	let currentNode, parentNode;

	amodroParse.traverse(astRoot, function (node, parent) {
		if (node) {
			let loc = node.loc;

			if (loc) {
				let start = loc.start;

				// The selected range has to be an identifier to be valid for "Go to Definition".
				if (node.type === 'Identifier' && start.line === line && start.column === column) {
					currentNode = node;
					parentNode = parent;

					return false;
				}
				// Stop traversing, if we passed the line with the caret selection.
				if (loc.line > line) {
					return false;
				}
			}
		}

		return true;
	});

	return currentNode && {
		currentNode: currentNode,
		parentNode: parentNode
	};
}

/**
	 * Returns map of local variables and their initializing ones from expressions,
	 * which just assign one identifier to another, or assign a variable a value
	 * by a "new" expression.
	 * @param {Object} astRoot Parsed document.
	 * @param {Object} stopNode Node, which the declarations have to precede.
	 * @returns {Object} A map "variable identifier" -> "dependency identifier".
	 */
function getVariableAssignments (astRoot, stopNode) {
	const assignments = {};

	function handleAssignment (leftNodeName, rightNode) {
		if (rightNode) {
			if (rightNode.type === 'Identifier') {
				// Support assignment "... = imported;"
				assignments[leftNodeName] = rightNode.name;
			} else if (rightNode.type === 'NewExpression') {
				// Support assignment "... = new Imported;"
				let callee = rightNode.callee;

				if (callee && callee.type === 'Identifier') {
					assignments[leftNodeName] = callee.name;
				}
			}
		}
	}

	amodroParse.traverse(astRoot, function (node) {
		if (node === stopNode) {
			return false;
		}

		if (node) {
			if (node.type === 'VariableDeclarator') {
				// Support declaration "var local = imported;"
				if (node.id && node.id.type === 'Identifier' && node.init) {
					handleAssignment(node.id.name, node.init);
				}
			} else if (node.type === 'AssignmentExpression') {
				// Support assignment "local = imported;"
				if (node.left && node.left.type === 'Identifier' && node.right) {
					handleAssignment(node.left.name, node.right);
				}
			}
		}

		return true;
	});

	return assignments;
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
	 */
function findOriginatingModuleDependency (astRoot, identifier, moduleDependencies) {
	const parentNode = identifier.parentNode;
	const currentNode = identifier.currentNode;
	let selected = currentNode.name;
	let imported, isMember, modulePath;

	function getModuleDependencyFromExpression () {
		let property = parentNode.property;
		let object = parentNode.object;

		// Support selecting "member" within a "object.member" expression, otherwise
		// just take the selected identifer as the symbol to look for.
		if (parentNode.type === 'MemberExpression' && parentNode.computed === false
			&& property && property.name === selected && object) {
			if (object.type === 'Identifier') {
				imported = parentNode.object.name;
				isMember = true;
			} else {
				let callee = object.callee;
				let parameters = object.arguments;

				// Support selecting "member" within a "require('module').member" expression.
				if (object.type === 'CallExpression' && callee.type === 'Identifier'
					&& (callee.name === 'require' || callee.name === 'requirejs')
					&& parameters && parameters.length === 1) {
					let firstParameter = parameters[0];

					if (firstParameter && firstParameter.type === 'Literal') {
						return {
							modulePath: firstParameter.value,
							selected: selected
						};
					}
				}
			}
		}

		return undefined;
	}

	function getModuleDependencyFromVariables () {
		const assignments = getVariableAssignments(astRoot, currentNode);

		for (;;) {
			let declared = assignments[imported];

			if (!declared) {
				break;
			}
			// Prevent endless loop, if the code is invalid and contains a declaration
			// with the variable and the expression the other way round.
			delete assignments[imported];
			imported = declared;

			modulePath = moduleDependencies[imported];
			if (modulePath) {
				// If the real import was just renamed by a declaration, look for
				// the real name in the originating module.
				if (!isMember) {
					selected = imported;
				}
				break;
			}
		}
	}

	// Start by analyzing the expression; either a direct function call or
	// a dereferenced member call.
	if (parentNode) {
		getModuleDependencyFromExpression();
	}

	// Exported identifiers usually equal to formal parameters used for importing.
	if (!imported) {
		imported = selected;
	}
	modulePath = moduleDependencies[imported];

	// If the identifier is missing among the formal parameters, it may be
	// declared locally and assigned the imported dependency.
	if (!modulePath) {
		getModuleDependencyFromVariables();
	}

	return {
		modulePath: modulePath,
		imported: imported,
		selected: selected
	};
}

module.exports = {
	findIdentifier: findIdentifier,
	findIdentifierWithinRange: findIdentifierWithinRange,
	findOriginatingModuleDependency: findOriginatingModuleDependency,
	parse: parse
};
