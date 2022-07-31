define(function () {
  function Animal (name) {
    console.log(name + ' created.');
  }

  Object.assign(Animal.prototype, {
    die: function () {
      console.log(this.name + ' died.');
    }
  });

  return Animal;
});
