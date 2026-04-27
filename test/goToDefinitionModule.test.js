const test = require('tehanu')(__filename)
const assert = require('assert')
const sinon = require('sinon')
const proxyquire = require('proxyquire')

test('goToDefinitionModule should use custom provider in xml files', () => {
  const executeCommand = sinon.stub().returns(Promise.resolve())
  const workspace = {
    openTextDocument: sinon.stub()
  }
  const window = {
    showTextDocument: sinon.stub()
  }
  const Selection = function () {}
  const CancellationTokenSource = function () {
    this.token = {}
    this.dispose = sinon.spy()
  }
  const goToDefinitionModule = proxyquire('../src/goToDefinitionModule', {
    vscode: {
      workspace,
      window,
      commands: { executeCommand },
      Selection,
      CancellationTokenSource
    }
  })

  const provideDefinition = sinon.stub().returns(Promise.resolve())
  const definitionProvider = { provideDefinition }
  const editor = {
    document: { languageId: 'xml' },
    selection: { active: { line: 0, character: 0 } }
  }

  return goToDefinitionModule(definitionProvider, editor)
    .then(() => {
      assert.equal(provideDefinition.calledOnce, true)
      assert.equal(executeCommand.calledWith('editor.action.goToDeclaration'), true)
    })
})

test('goToDefinitionModule should delegate to default command for non-js and non-xml', () => {
  const executeCommand = sinon.stub().returns(Promise.resolve())
  const goToDefinitionModule = proxyquire('../src/goToDefinitionModule', {
    vscode: {
      workspace: {},
      window: {},
      commands: { executeCommand },
      Selection: function () {},
      CancellationTokenSource: function () {
        this.token = {}
        this.dispose = function () {}
      }
    }
  })

  const definitionProvider = {
    provideDefinition: sinon.stub().returns(Promise.resolve())
  }
  const editor = {
    document: { languageId: 'plaintext' },
    selection: { active: { line: 0, character: 0 } }
  }

  return goToDefinitionModule(definitionProvider, editor)
    .then(() => {
      assert.equal(definitionProvider.provideDefinition.called, false)
      assert.equal(executeCommand.calledOnce, true)
      assert.equal(executeCommand.firstCall.args[0], 'editor.action.goToDeclaration')
    })
})
