define(['uiComponent'], function (Component) {
  return Component.extend({
    declareObservables () {
      this.pendingState = this.getObservable('pending')
    },

    getObservable (name) {
      return name
    }
  })
})