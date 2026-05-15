const { workspace, window, CancellationTokenSource } = require('vscode')
const { findOverridesForDocument } = require('./xmlLayoutAnalyser')

class XmlLayoutDecorations {
  constructor () {
    this.version = 0
    this.decorationType = window.createTextEditorDecorationType({
      backgroundColor: 'rgba(86, 156, 214, 0.15)',
      border: '1px solid rgba(86, 156, 214, 0.4)',
      isWholeLine: false
    })

    this.editorChangeSubscription = window.onDidChangeActiveTextEditor(editor => {
      this.refresh(editor)
    })

    this.documentChangeSubscription = workspace.onDidChangeTextDocument(event => {
      const editor = window.activeTextEditor
      if (editor && event.document === editor.document) {
        this.refresh(editor)
      }
    })

    this.configurationChangeSubscription = workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('requireModuleSupport.enableXmlLayoutCodeLensProvider') ||
          event.affectsConfiguration('requireModuleSupport.xmlLayoutPaths')) {
        this.refresh(window.activeTextEditor)
      }
    })

    this.refresh(window.activeTextEditor)
  }

  refresh (editor) {
    const currentVersion = ++this.version

    if (!editor) return

    if (editor.document.languageId !== 'xml') {
      editor.setDecorations(this.decorationType, [])
      return
    }

    const enabled = workspace
      .getConfiguration('requireModuleSupport')
      .get('enableXmlLayoutCodeLensProvider')

    if (!enabled) {
      editor.setDecorations(this.decorationType, [])
      return
    }

    const cancellationTokenSource = new CancellationTokenSource()

    findOverridesForDocument(editor.document, cancellationTokenSource.token)
      .then(items => {
        if (this.version !== currentVersion) return

        const decorations = items.map(item => {
          return editor.document.lineAt(item.line).range
        })

        editor.setDecorations(this.decorationType, decorations)
      })
      .catch(() => {})
      .finally(() => cancellationTokenSource.dispose())
  }

  dispose () {
    this.decorationType.dispose()
    this.editorChangeSubscription.dispose()
    this.documentChangeSubscription.dispose()
    this.configurationChangeSubscription.dispose()
  }
}

module.exports = XmlLayoutDecorations
