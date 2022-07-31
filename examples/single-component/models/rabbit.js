define(['models/animal'], function (Animal) {
  function Rabbit () {
    Animal.call(this, 'Rabbit')
  }

  Rabbit.prototype = Object.create(Animal.prototype)
  Rabbit.prototype.constructor = Rabbit

  Rabbit.prototype.squeak = function () {
    console.log(this.name + ' squeaked.')
  }

  return Rabbit
})
