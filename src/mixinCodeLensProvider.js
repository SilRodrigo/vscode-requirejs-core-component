const { workspace, CodeLens } = require('vscode')
const nls = require('vscode-nls')
const { configureLocalization } = require('./nlsHelpers')
const { analyseMixinOverrides } = require('./mixinMemberAnalyser')
const { convertLocToRange } = require('./appliedMixins')

configureLocalization(nls)
const localize = nls.loadMessageBundle()

class MixinCodeLensProvider {
  constructor (moduleResolver) {
    this.moduleResolver = moduleResolver
  }

  provideCodeLenses (document, cancellationToken) {
    const enabled = workspace
      .getConfiguration('requireModuleSupport')
      .get('enableMixinCodeLensProvider')

    if (!enabled) {
      return Promise.resolve([])
    }

    return analyseMixinOverrides(this.moduleResolver, document, cancellationToken)
      .then(members => {
        return members.map(member => {
          const count = member.mixins.length
          const range = convertLocToRange(member.loc)

          return new CodeLens(range, {
            title: localize('mixinMemberLens.title', 'Mixins: {0}', count),
            command: 'requireModuleSupport.showAppliedMixins',
            arguments: [document.uri, member.name]
          })
        })
      })
      .catch(_error => [])
  }
}

module.exports = MixinCodeLensProvider
