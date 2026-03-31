define(['moduleObservableParent'], function (Parent) {
  return Parent.extend({
    declareObservables () {
      this._super()
      this.localObservable = this.getObservable('local')
    },

    afterRender () {
      this.localObservable
      this.parentObservable
      this.pendingState
      this.getObservable('state')
    }
  })
})