define([], function () {
  return function (target) {
    return target.extend({
      defaults: {
        localFlag: true
      },

      check () {
        this._super()
        this.localFlag
        this.negotiation
      }
    })
  }
})
