const test = require('tehanu')(__filename)
const assert = require('assert')
const { parseModule, findExtendMethodDefinitions } = require('../src/codeParser')

function parseTest (input) {
  return parseModule(input, { loc: true })
}

test('should extract methods from extend object', () => {
  const input = `define([], function (Component) {
    return Component.extend({
      initialize: function () {},
      methodStyle () {},
      value: 10,
      defaults: {
        a: 1
      }
    })
  })`

  const methodNames = findExtendMethodDefinitions(parseTest(input)).map(method => method.name)

  assert.deepEqual(methodNames, ['initialize', 'methodStyle'])
})

test('should extract methods from target mixin extension', () => {
  const input = `define([], function () {
    return function (target) {
      return target.extend({
        getProductFamilyMultiplier (family) {
          return family
        }
      })
    }
  })`

  const methods = findExtendMethodDefinitions(parseTest(input))

  assert.equal(methods.length, 1)
  assert.equal(methods[0].name, 'getProductFamilyMultiplier')
  assert.ok(methods[0].loc)
})
