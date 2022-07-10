const { join, resolve } = require('path')
const { runTests } = require('@vscode/test-electron')

;(async () => {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = resolve(__dirname, '..')

    // The path to the extension test script
    // Passed to --extensionTestsPath
    const extensionTestsPath = join(extensionDevelopmentPath, 'test')

    process.env.VSCODE_REQUIREJS_WORKSPACE = join(extensionDevelopmentPath, 'testFiles')
    process.env.VSCODE_REQUIREJS_SUPPORT_JSX = true
    process.env.VSCODE_REQUIREJS_SUPPORT_ESM = true

    // Download VS Code, unzip it and run the integration test
    await runTests({ extensionDevelopmentPath, extensionTestsPath })
  } catch (error) {
    console.error('Failed to run tests:', error)
    process.exit(1)
  }
})()
