const { env } = require('vscode')
const { getPluralFormForCardinalByLocale } = require('fast-plural-rules')

const locale = process.env.VSCODE_NLS_LOCALE || env.language || 'en'

module.exports.configureLocalization = nls =>
  nls.config({ messageFormat: nls.MessageFormat.bundle, bundleFormat: nls.BundleFormat.standalone })

module.exports.choosePlural = (count, message) => {
  const variants = message.split('|||')
  return variants[getPluralFormForCardinalByLocale(locale, count)] || variants[0]
}
