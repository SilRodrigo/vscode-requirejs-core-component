define(['uiComponent'], function (Component) {
  return Component.extend({
    defaults: {
      parentFlag: true
    },

    getObservable (name) {
      return name
    }
  })
})
