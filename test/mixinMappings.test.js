const test = require('tehanu')(__filename)
const assert = require('assert')
const { parseModule, findRequireJsMixinMappings } = require('../src/codeParser')

function parseTest (input) {
  return parseModule(input, { loc: true })
}

test('should extract enabled mixin mappings from requirejs-config', () => {
  const input = `var config = {
    config: {
      mixins: {
        'Vendor_Module/js/original': {
          'Vendor_Module/js/mixin/one': true,
          'Vendor_Module/js/mixin/two': false
        }
      }
    }
  }`

  assert.deepEqual(findRequireJsMixinMappings(parseTest(input)).map(mapping => ({
    targetModulePath: mapping.targetModulePath,
    mixinModulePath: mapping.mixinModulePath,
    enabled: mapping.enabled
  })), [
    {
      targetModulePath: 'Vendor_Module/js/original',
      mixinModulePath: 'Vendor_Module/js/mixin/one',
      enabled: true
    },
    {
      targetModulePath: 'Vendor_Module/js/original',
      mixinModulePath: 'Vendor_Module/js/mixin/two',
      enabled: false
    }
  ])
})

test('should ignore unrelated objects named config without mixins', () => {
  const input = 'var somethingElse = { config: { paths: {} } }'

  assert.deepEqual(findRequireJsMixinMappings(parseTest(input)), [])
})