define(['moduleThisMemberParent'], function (Parent) {
  return Parent.extend({
    defaults: {
      localFlag: true
    },

    afterRender () {
      this.localFlag
      this.parentFlag
      this.getObservable('state')
    }
  })
})
