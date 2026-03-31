define(['moduleObservableBase'], function (Base) {
  return Base.extend({
    declareObservables () {
      this._super()
      this.parentObservable = this.getObservable('parent')
    }
  })
})