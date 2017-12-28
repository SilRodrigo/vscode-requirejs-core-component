/**
	 * Determine if the cursor is inside a string.
	 * @param {Number} currentLine The current line of the cursor.
	 * @param {Number} currentPosition The current position of the cursor.
	 * @returns {Boolean} If the cursor is inside a string.
	 */
function isInsideModulePath (currentLine, currentPosition) {
	let singleQuotes = false;
	let doubleQuotes = false;
	let backticks = false;
	let previousChar;

	// check if we are inside quotes
	for (let i = 0; i < currentPosition; ++i) {
		const currentChar = currentLine.charAt(i);

		if (previousChar !== '\\') {
			if (currentChar === '\'') {
				singleQuotes = !singleQuotes;
			} else if (currentChar === '"') {
				doubleQuotes = !doubleQuotes;
			} else if (currentChar === '`') {
				backticks = !backticks;
			}
		}
		previousChar = currentChar;
	}

	return singleQuotes || doubleQuotes || backticks;
}

/**
	 * Check if the character is a single quote, a double quote or a backtick.
	 * @param {String} char The character to check.
	 * @returns {Boolean} If the character is a quote.
	 */
function isQuote (char) {
	return char === '\'' || char === '"' || char === '`';
}

/**
	 * Retrieves the path inserted by the user. This is taken based
	 * on the last quote or last white space character.
	 * @param {Number} currentLine The current line of the cursor.
	 * @param {Number} currentPosition The current position of the cursor.
	 * @returns {String} The path entered by the user.
	 */
function getModulePathUpToPosition (currentLine, currentPosition) {
	let lastQuote = -1;
	let lastWhiteSpace = -1;

	for (let i = 0; i < currentPosition; ++i) {
		const currentChar = currentLine[i];

		if (currentChar === '\\') {
			// skip next character if escaped
			++i;
		} else if (currentChar === ' ' || currentChar === '\t') {
			// handle space
			lastWhiteSpace = i;
		} else if (isQuote(currentChar)) {
			// handle quotes
			lastQuote = i;
		}
	}

	return currentLine.substring(
		(lastQuote >= 0 ? lastQuote : lastWhiteSpace) + 1, currentPosition);
}

/**
	 * Retrieves the path inserted by the user. This is taken based
	 * on the last quote or last white space character.
	 * @param {Number} currentLine The current line of the cursor.
	 * @param {Number} currentPosition The current position of the cursor.
	 * @returns {String} The path entered by the user.
	 */
function getSurroundingModulePath (currentLine, currentPosition) {
	const lineLength = currentLine.length;
	let leadingQuote = -1;
	let trailingQuote = -1;
	let i;

	for (i = currentPosition; i > 0; --i) {
		const currentChar = currentLine[i];
		const precedingChar = currentLine[i - 1];

		if (precedingChar === '\\') {
			// skip next character if escaped
			--i;
		} else if (isQuote(currentChar)) {
			// handle quotes
			leadingQuote = i;
			break;
		}
	}

	for (i = currentPosition; i < lineLength; ++i) {
		const currentChar = currentLine[i];

		if (currentChar === '\\') {
			// skip next character if escaped
			++i;
		} else if (isQuote(currentChar)) {
			// handle quotes
			trailingQuote = i;
			break;
		}
	}

	return currentLine.substring(leadingQuote + 1, trailingQuote);
}

module.exports = {
	isInsideModulePath: isInsideModulePath,
	getModulePathUpToPosition: getModulePathUpToPosition,
	getSurroundingModulePath: getSurroundingModulePath
};
