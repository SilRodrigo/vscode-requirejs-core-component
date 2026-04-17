define(['mixinTargetBase'], function (Base) {
  return Base.extend({
    defaults: {
      category: null
    },

    check () {
      return true
    }
  })
})
