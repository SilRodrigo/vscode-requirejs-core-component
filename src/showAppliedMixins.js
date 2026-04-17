const {
  window,
  workspace,
  Uri,
  Selection,
  CancellationTokenSource
} = require('vscode')
const nls = require('vscode-nls')
const { configureLocalization } = require('./nlsHelpers')
const { analyseMixinOverrides } = require('./mixinMemberAnalyser')
const { convertLocToRange, getPreferredMixinLocation } = require('./appliedMixins')

configureLocalization(nls)
const localize = nls.loadMessageBundle()

function openDocumentAtLocation (location) {
  return workspace.openTextDocument(location.uri)
    .then(document => window.showTextDocument(document, {
      preview: false
    }))
    .then(editor => {
      const range = location.range

      editor.selection = new Selection(range.end, range.start)
      editor.revealRange(range)
    })
}


module.exports = function showAppliedMixins (moduleResolver, targetUri, memberName) {
  const editor = window.activeTextEditor

  if (targetUri && targetUri.fsPath && (!editor || editor.document.uri.fsPath !== targetUri.fsPath)) {
    return workspace.openTextDocument(targetUri)
      .then(document => window.showTextDocument(document, { preview: false }))
      .then(currentEditor => {
        return showAppliedMixins(moduleResolver, currentEditor.document.uri, memberName)
      })
  }

  if (!editor) {
    return undefined
  }

  const cancellationTokenSource = new CancellationTokenSource()

  return analyseMixinOverrides(moduleResolver, editor.document, cancellationTokenSource.token)
    .then(async members => {
      let member = members.find(item => item.name === memberName)

      if (!member && members.length) {
        const pickedMember = await window.showQuickPick(members.map(item => ({
          label: item.name,
          detail: localize('mixinMemberLens.memberQuickPickDetail', '{0} mixin(s)', item.mixins.length),
          member: item
        })), {
          title: localize('mixinMemberLens.memberQuickPickTitle', 'Members overridden by mixins'),
          placeHolder: localize('mixinMemberLens.memberQuickPickPlaceholder', 'Select a member to inspect applied mixins.')
        })

        member = pickedMember && pickedMember.member
      }

      if (!member) {
        return window.showInformationMessage(localize(
          'mixinMemberLens.noMember',
          'No mixin override was found for this member anymore.'
        ))
      }

      const picked = await window.showQuickPick(member.mixins.map(mixin => {
        const location = mixin.memberLoc ? convertLocToRange(mixin.memberLoc) : undefined

        return {
          label: mixin.mixinModulePath,
          description: workspace.asRelativePath(mixin.mixinFilePath, false),
          detail: localize(
            'mixinMemberLens.quickPickDetail',
            'Configured in {0}',
            workspace.asRelativePath(mixin.configFilePath, false)
          ),
          location,
          mixin
        }
      }), {
        title: localize('mixinMemberLens.quickPickTitle', 'Mixins overriding {0}', member.name),
        placeHolder: localize('mixinMemberLens.quickPickPlaceholder', 'Select a mixin to open its file.')
      })

      if (picked) {
        const location = picked.location
          ? { uri: picked.mixin.mixinFilePath ? Uri.file(picked.mixin.mixinFilePath) : undefined, range: picked.location }
          : await getPreferredMixinLocation(picked.mixin.mixinFilePath)

        if (location.uri) {
          return openDocumentAtLocation(location)
        }
      }
    })
    .finally(() => cancellationTokenSource.dispose())
}