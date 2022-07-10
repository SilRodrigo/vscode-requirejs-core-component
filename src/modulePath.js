/**
 * Helps with the recognition of strings and module paths in strings in
 * document content.
 * @namespace modulePath
 */

/**
 * Determine if the cursor is inside a string.
 * @param {number} currentLine The current line of the cursor.
 * @param {number} currentPosition The current position of the cursor.
 * @returns {boolean} If the cursor is inside a string.
 * @memberof modulePath
 */
function isInsideString (currentLine, currentPosition) {
  let singleQuotes = false;
  let doubleQuotes = false;
  let backticks = false;
  let previousChar;

  // Check if we are inside quotes.
  for (let i = 0; i < currentPosition; ++i) {
    const currentChar = currentLine.charAt(i);

    // Skip escaped characters.
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
 * Check if the character may appear at the beginning of a module name.
 * @param {string} character The character to check.
 * @returns {boolean} If the character may appear at the beginning of a module name.
 * @memberof modulePath
 * @inner
 */
function canStartModuleName (character) {
  return character >= '0' && character <= '9'
    || character >= 'A' && character <= 'Z'
    || character >= 'a' && character <= 'z';
}

/**
 * Guesses if the specified string looks like a start of a module path.
 * @param {string} apparentPath An apparent module path start.
 * @returns {boolean} If the specified string looks like a start of a module path.
 * @memberof modulePath
 */
function startsLikeModulePath (apparentPath) {
  if (apparentPath.startsWith('./') || apparentPath.startsWith('../')) {
    return true;
  }

  return canStartModuleName(apparentPath.charAt(0));
}

/**
 * Check if the character is a single quote, a double quote or a backtick.
 * @param {string} character The character to check.
 * @returns {boolean} If the character is a quote.
 * @memberof modulePath
 * @inner
 */
function isQuote (character) {
  return character === '\'' || character === '"' || character === '`';
}

/**
 * Retrieves the path inserted by the user. This is taken based
 * on the last quote or last white space character.
 * @param {number} currentLine The current line of the cursor.
 * @param {number} currentPosition The current position of the cursor.
 * @returns {string} The path entered by the user.
 * @memberof modulePath
 */
function getModulePathUpToPosition (currentLine, currentPosition) {
  let lastQuote = -1;
  let lastWhiteSpace = -1;

  // Find the last quote on the line, which starts a string.
  for (let i = 0; i < currentPosition; ++i) {
    const currentChar = currentLine[i];

    if (currentChar === '\\') {
      // Skip the next character if escaped.
      ++i;
    } else if (currentChar === ' ' || currentChar === '\t') {
      lastWhiteSpace = i;
    } else if (isQuote(currentChar)) {
      lastQuote = i;
    }
  }

  // Cut the content after the last quote found on the line.
  return currentLine.substring(
    (lastQuote >= 0 ? lastQuote : lastWhiteSpace) + 1, currentPosition);
}

/**
 * Retrieves the path inserted by the user. This is taken based
 * on the last quote or last white space character.
 * @param {number} currentLine The current line of the cursor.
 * @param {number} currentPosition The current position of the cursor.
 * @returns {string} The path entered by the user.
 * @memberof modulePath
 */
function getSurroundingModulePath (currentLine, currentPosition) {
  const lineLength = currentLine.length;
  let leadingQuote = -1;
  let trailingQuote = -1;
  let i;

  // Find the nearest quote on the line before the cursor.
  for (i = currentPosition; i > 0; --i) {
    const currentChar = currentLine[i];
    const precedingChar = currentLine[i - 1];

    if (precedingChar === '\\') {
      // Move to the preceding character if escaped.
      --i;
    } else if (isQuote(currentChar)) {
      leadingQuote = i;
      break;
    }
  }

  // Find the nearest quote on the line after the cursor.
  for (i = currentPosition; i < lineLength; ++i) {
    const currentChar = currentLine[i];

    if (currentChar === '\\') {
      // Skip the next character if escaped.
      ++i;
    } else if (isQuote(currentChar)) {
      trailingQuote = i;
      break;
    }
  }

  // Cut the content between the quotes surrounding the cursoron the line.
  return currentLine.substring(leadingQuote + 1, trailingQuote);
}

module.exports = {
  isInsideString: isInsideString,
  startsLikeModulePath: startsLikeModulePath,
  getModulePathUpToPosition: getModulePathUpToPosition,
  getSurroundingModulePath: getSurroundingModulePath
};
