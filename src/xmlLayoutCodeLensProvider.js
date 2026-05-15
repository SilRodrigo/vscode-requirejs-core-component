const { workspace, CodeLens, Range, Position } = require('vscode')
const { findOverridesForDocument } = require('./xmlLayoutAnalyser')

class XmlLayoutCodeLensProvider {
  getSettings () {
    return workspace.getConfiguration('requireModuleSupport')
  }

  isEnabled () {
    return this.getSettings().get('enableXmlLayoutCodeLensProvider') !== false
  }

  async provideCodeLenses (document, cancellationToken) {
    if (!this.isEnabled()) return []

    const globs = this.getSettings().get('xmlLayoutPaths') || []
    if (!globs.length) return []

    const items = await findOverridesForDocument(document, cancellationToken)

    return items.map(item => {
      const count = item.overridingFiles.length
      const range = new Range(new Position(item.line, 0), new Position(item.line, 0))
      return new CodeLens(range, {
        title: count === 1 ? '1 override' : `${count} overrides`,
        command: 'requireModuleSupport.showXmlLayoutOverrides',
        arguments: [document.uri, item.path]
      })
    })
  }
}

module.exports = XmlLayoutCodeLensProvider
