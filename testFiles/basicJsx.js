require(['jsx!moduleA.jsx', 'jsx!moduleB.jsx'], function(a, b) {
    var foo = a;
    var bar = b;
    foo.baz();
    bar.prop;
    return <div></div>;
});
