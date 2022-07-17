const { join, resolve } = require('path')
const glob = require('fast-glob')
const { run } = require('tehanu')
const reporter = require('tehanu-repo-coco')

exports.run = async (testsRoot, done) => {
  testsRoot = resolve(testsRoot)
  try {
    const test = process.env.VSCODE_REQUIREJS_TEST;
    if (test) {
      require(join(testsRoot, test))
    } else {
      const files = await glob('**/*.test.js', { cwd: testsRoot })
      for (const file of files) require(join(testsRoot, file))
    }
    await run({ reporter })
  } catch (error) {
    done(error)
  }
}
