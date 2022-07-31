import a from 'esmA'
import b from 'esmB'

var foo = a
var bar = b
foo.baz()
bar.prop
var { bar: bar2 } = foo
var { prop } = bar
bar2
prop
