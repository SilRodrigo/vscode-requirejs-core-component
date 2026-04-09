const { workspace, window, MarkdownString } = require('vscode')
const nls = require('vscode-nls')
const { configureLocalization } = require('./nlsHelpers')
const { analyseMixinOverrides } = require('./mixinMemberAnalyser')
const { convertLocToRange } = require('./appliedMixins')

configureLocalization(nls)
const localize = nls.loadMessageBundle()

class MixinDecorations {
  constructor (moduleResolver) {
    this.moduleResolver = moduleResolver
    this.version = 0
    this.decorationType = window.createTextEditorDecorationType({
      backgroundColor: 'rgba(196, 138, 0, 0.2)',
      border: '1px solid rgba(196, 138, 0, 0.4)'
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
      if (event.affectsConfiguration('requireModuleSupport.enableMixinDecorations')) {
        this.refresh(window.activeTextEditor)
      }
    })

    this.refresh(window.activeTextEditor)
  }

  refresh (editor) {
    const currentVersion = ++this.version

    if (!editor) {
      return
    }

    const enabled = workspace
      .getConfiguration('requireModuleSupport')
      .get('enableMixinDecorations')

    if (!enabled) {
      editor.setDecorations(this.decorationType, [])
      return
    }

    analyseMixinOverrides(this.moduleResolver, editor.document)
      .then(members => {
        if (currentVersion !== this.version) {
          return
        }

        const decorationOptions = members.map(member => {
          const hoverMessage = new MarkdownString(this.getHoverMessage(member))

          return {
            range: convertLocToRange(member.loc),
            hoverMessage
          }
        })

        editor.setDecorations(this.decorationType, decorationOptions)
      })
      .catch(_error => {
        if (currentVersion === this.version) {
          editor.setDecorations(this.decorationType, [])
        }
      })
  }

  getHoverMessage (member) {
    const count = member.mixins.length
    const header = localize('mixinMemberDecoration.hoverHeader', '**{0}** has {1} mixin(s):', member.name, count)
    const mixins = member.mixins
      .map(mixin => {
        return '- `' + mixin.mixinModulePath + '`'
      })
      .join('\n')

    return [header, mixins].filter(Boolean).join('\n\n')
  }

  dispose () {
    if (this.editorChangeSubscription) {
      this.editorChangeSubscription.dispose()
    }
    if (this.documentChangeSubscription) {
      this.documentChangeSubscription.dispose()
    }
    if (this.configurationChangeSubscription) {
      this.configurationChangeSubscription.dispose()
    }
    if (this.decorationType) {
      this.decorationType.dispose()
    }
  }
}

module.exports = MixinDecorations
