const { window, workspace, Uri, Selection, CancellationTokenSource } = require('vscode')
const { findOverridesForDocument } = require('./xmlLayoutAnalyser')

function openAtLine (uri, line) {
  return workspace.openTextDocument(uri)
    .then(document => window.showTextDocument(document, { preview: false }))
    .then(editor => {
      const range = editor.document.lineAt(line).range
      editor.selection = new Selection(range.start, range.start)
      editor.revealRange(range)
    })
}

module.exports = async function showXmlLayoutOverrides (documentUri, itemPath) {
  let uri = documentUri

  if (typeof uri === 'string') {
    uri = Uri.parse(uri)
  }

  const document = await workspace.openTextDocument(uri)
  const cancellationTokenSource = new CancellationTokenSource()
  const items = await findOverridesForDocument(document, cancellationTokenSource.token)

  let item = items.find(i => i.path === itemPath)

  if (!item && items.length) {
    const picked = await window.showQuickPick(
      items.map(i => ({
        label: i.path,
        description: `${i.overridingFiles.length} override(s)`,
        item: i
      })),
      { title: 'Items with overrides', placeHolder: 'Select an item' }
    )
    item = picked && picked.item
  }

  if (!item) return

  if (item.overridingFiles.length === 1) {
    return openAtLine(item.overridingFiles[0].uri, item.overridingFiles[0].line)
  }

  const picked = await window.showQuickPick(
    item.overridingFiles.map(f => ({
      label: workspace.asRelativePath(f.uri, false),
      file: f
    })),
    { title: `Overrides for "${item.path}"`, placeHolder: 'Select a file to open' }
  )

  if (picked) {
    return openAtLine(picked.file.uri, picked.file.line)
  }
}
