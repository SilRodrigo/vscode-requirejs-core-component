const { parseModule, findFirstExtendCall, findExtendMethodDefinitions } = require('./codeParser')
const { getFileStateAndContent } = require('./fileAccess')
const { findAppliedMixins } = require('./appliedMixins')

function isSupportedLanguage (document) {
  const { languageId } = document

  return languageId === 'javascript' || languageId === 'javascriptreact'
}

function normalizeMethodMap (methodDefinitions) {
  const byName = new Map()

  methodDefinitions.forEach(definition => {
    if (!definition || !definition.name || !definition.loc || byName.has(definition.name)) {
      return
    }

    byName.set(definition.name, definition)
  })

  return byName
}

async function analyseMixinOverrides (moduleResolver, document, cancellationToken) {
  if (!document || !isSupportedLanguage(document)) {
    return []
  }

  let astRoot

  try {
    astRoot = parseModule(document.getText(), {
      loc: true,
      jsx: document.languageId === 'javascriptreact'
    })
  } catch (_error) {
    return []
  }

  if (!findFirstExtendCall(astRoot)) {
    return []
  }

  const membersByName = normalizeMethodMap(findExtendMethodDefinitions(astRoot))
  if (!membersByName.size) {
    return []
  }

  const appliedMixins = await findAppliedMixins(moduleResolver, document.fileName, cancellationToken)
  if (!appliedMixins.length) {
    return []
  }

  const mixedMembersByName = new Map()

  for (const appliedMixin of appliedMixins) {
    let mixinState
    let mixinAstRoot

    try {
      mixinState = await getFileStateAndContent(appliedMixin.mixinFilePath)
      mixinAstRoot = parseModule(mixinState.content, { loc: true, jsx: true })
    } catch (_error) {
      continue
    }

    findExtendMethodDefinitions(mixinAstRoot).forEach(method => {
      const member = membersByName.get(method.name)

      if (!member) {
        return
      }

      const existing = mixedMembersByName.get(method.name) || {
        name: method.name,
        loc: member.loc,
        mixins: []
      }

      const duplicate = existing.mixins.find(mixin => {
        return mixin.mixinFilePath === appliedMixin.mixinFilePath &&
          mixin.mixinModulePath === appliedMixin.mixinModulePath
      })
      if (!duplicate) {
        existing.mixins.push({
          ...appliedMixin,
          memberLoc: method.loc
        })
      }

      mixedMembersByName.set(method.name, existing)
    })
  }

  return Array.from(mixedMembersByName.values())
    .filter(member => member.mixins.length)
    .sort((left, right) => left.name.localeCompare(right.name))
}

module.exports = {
  analyseMixinOverrides
}
