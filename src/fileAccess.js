/**
 * Inspects file information and reads text file content.
 * @namespace fileAccess
 */

const { workspace } = require('vscode')
const { open, fstat, read, close } = require('fs')

/**
 * Lists all JavaScript modules in the project.
 * @param {CancellationToken} cancellationToken A cancellation token.
 * @returns {Promise} Resolves with an array of file paths to the JavaScript modules.
 * @memberof fileAccess
 */
function findModulePaths (cancellationToken) {
  const includeModulePattern = workspace
    .getConfiguration('requireModuleSupport')
    .get('includeModulePattern')
  const excludeModulePattern = workspace
    .getConfiguration('requireModuleSupport')
    .get('excludeModulePattern')

  // const message = `Collecting ${includeModulePattern || 'all'} files${excludeModulePattern ? ' without ' + excludeModulePattern : ''}.`
  // console.time(message)
  return workspace.findFiles(includeModulePattern, excludeModulePattern,
    undefined, cancellationToken)
    .then(files => {
      // console.timeEnd(message)
      // console.log(`${files.length} files collected.`)
      return files.map(file => file.fsPath)
    })
}

/**
 * Opens a file for reading.
 * @param {string} path The path to a file in the file system.
 * @returns {Promise} Promise to the file descriptor.
 * @memberof fileAccess
 * @inner
 */
function openFile (path) {
  return new Promise((resolve, reject) => {
    open(path, 'r', function (error, descriptor) {
      if (error) {
        reject(error)
      } else {
        resolve(descriptor)
      }
    })
  })
}

/**
 * Retrieves information about a file.
 * @param {number} descriptor The file descriptor opened for reading.
 * @returns {Promise} Promise to an object obtained by `fs.stat`.
 * @memberof fileAccess
 * @inner
 */
function inspectFile (descriptor) {
  return new Promise((resolve, reject) => {
    fstat(descriptor, function (error, state) {
      if (error) {
        reject(error)
      } else {
        resolve(state)
      }
    })
  })
}

/**
 * Reads the file content of the specified size from the current position
 * to a binary buffer.
 * @param {number} descriptor The file descriptor opened for reading.
 * @param {number} size How many bytes should be read.
 * @returns {Promise} Promise to an object with `buffer` (`Buffer`) and
 * `bytesRead` (`number`) properties.
 * @memberof fileAccess
 * @inner
 */
function readFileContent (descriptor, size) {
  return new Promise((resolve, reject) => {
    read(descriptor, Buffer.alloc(size), 0, size, null,
      function (error, bytesRead, buffer) {
        if (error) {
          reject(error)
        } else {
          resolve({ buffer, bytesRead })
        }
      })
  })
}

/**
 * Closes the file. If it fails, the error is logged on the console,
 * but the promise gets resolved.
 * @param {number} descriptor The file descriptor.
 * @returns {Promise} Promise to nothing.
 * @memberof fileAccess
 * @inner
 */
function closeFile (descriptor) {
  return new Promise(resolve => {
    close(descriptor, function (error) {
      if (error) {
        console.warn(error)
      }
      resolve()
    })
  })
}

/**
 * Gets the file state and reads its textual content.
 * @param {string} filePath The path to a file in the file system.
 * @returns {Promise} Promise to an object obtained by `fs.stat` with
 * additional properties `path` (`string`) to the file path to in the file
 * system and `content` (`string`) carrying the file content in UTF-8.
 * @memberof fileAccess
 */
function getFileStateAndContent (filePath) {
  let fileDescriptor, fileState

  return openFile(filePath)
    .then(descriptor => {
      fileDescriptor = descriptor

      return inspectFile(descriptor)
    })
    .then(state => {
      state.path = filePath
      fileState = state

      return readFileContent(fileDescriptor, state.size)
    })
    .then(({ bytesRead, buffer }) => {
      const fileSize = fileState.size

      if (fileSize !== bytesRead) {
        console.warn('Reading content of "' + filePath
          + '" ended with ' + bytesRead + ' instead of '
          + fileSize + '.')
      }
      fileState.size = bytesRead
      fileState.content = buffer.toString('utf-8', 0, bytesRead)

      return closeFile(fileDescriptor)
    })
    .then(() => {
      return fileState
    })
}

module.exports = {
  findModulePaths: findModulePaths,
  getFileStateAndContent: getFileStateAndContent
}
