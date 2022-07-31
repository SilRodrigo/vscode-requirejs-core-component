define(function () {
  function Animal (name) {
    console.log(name + ' was born.')
    this.name = name
  }

  Object.assign(Animal.prototype, {
    die: function () {
      console.log(this.name + ' died.')
    }
  })

  return Animal
})
