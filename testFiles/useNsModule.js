define(['uiComponent'], function (Component) {
  return Component.extend({
    initialize: function () {
      this.useNs(function (ns) {
        return ns.statusOptions
      })
    }
  })
})
