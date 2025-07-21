import gmp from "gmp-wasm";
import type { GMPLib } from "gmp-wasm";
import { Builder } from "./Builder.js"; // This loads all the makers
import { build } from "pegjs/lib/compiler/visitor.js";

let gmpLib: GMPLib = await gmp.init();
if (!gmpLib) {
    throw new Error("GMP library failed to initialize");
}
console.log("got GMPLib with this many bindings:", Object.keys((gmpLib as any).binding).length);
let builder: Builder = new Builder(gmpLib); // Initialize the builder with gmp-wasm

builder.analyzeOne("'test'");
builder.analyzeOne("Tag('Test')");
builder.analyzeOne("Str('test')");

builder.analyzeOne("True");
builder.analyzeOne("False");

builder.analyzeOne("None");

// // fails, as expected -->
// // builder.analyzeOne("x");  // because x is not defined

builder.analyzeOne("Sym('x')"); // this is like Quote(x), you get a symbol, not the value bound to x in scope

builder.analyzeOne('Bool("True")');
builder.analyzeOne('Bool("False")');

builder.analyzeOne("Anything");
builder.analyzeOne('Tag("Anything")');

builder.analyzeOne('"Hello, world!"');
builder.analyzeOne('Str("Hello, world!")');
builder.analyzeOne('Str("Hello, \\"world\\"!")');

builder.analyzeOne('Var("x")');

builder.analyzeOne('None');
// // ? analyzeOne('Option()');  // probably a bad idea
// // ? analyzeOne('Option("None")');
builder.analyzeOne('Some()'); // ==> None

builder.analyzeOne('Some(None)'); // not None
builder.analyzeOne('Some("value")');

builder.analyzeOne('Some([])'); // ==> nested empty list inside of Some

builder.analyzeOne('List()');
builder.analyzeOne('List("a")');
builder.analyzeOne('List("a", "b", "c")');

builder.analyzeOne('[]');
builder.analyzeOne('["a"]');
builder.analyzeOne('["a", "b", "c"]');

builder.analyzeOne('Error("Description of problem goes here")');

builder.analyzeOne("12345");
builder.analyzeOne('Nat("12345")');

builder.analyzeOne('0.1234');
builder.analyzeOne('Dec("0.1234")');

builder.analyzeOne('123.456');
builder.analyzeOne('123.');
builder.analyzeOne('.456');
builder.analyzeOne('123.456e+2');
builder.analyzeOne('123.e-1');
builder.analyzeOne('.456e2');

builder.analyzeOne('Dec("123.456")');
builder.analyzeOne('Dec("123.")');
builder.analyzeOne('Dec(".456")');
builder.analyzeOne('Dec("123.456e+2")');
builder.analyzeOne('Dec("123.e-1")');
builder.analyzeOne('Dec(".456e2")');

// -------------------------------
// // Empty Tuples are not allowed
// // analyzeOne('Tuple()');
// // analyzeOne('()');
// // analyzeOne('(,)');
// -------------------------------
// // Tuples of one or more elements
// //analyzeOne('Tuple("a")'); // we don't want to allow this either
// //analyzeOne('("a",)'); // not parsing any more

builder.analyzeOne('("a", "b")');
builder.analyzeOne('("a", "b", "c")');
builder.analyzeOne('Tuple("a", "b", "c")');

builder.analyzeOne('{"key": "value", "another": "thing"}');
builder.analyzeOne('Map(Tuple("key", "value"), Tuple("another", "thing"))');

builder.analyzeOne('{"key": "value", "another": "thing"}');
builder.analyzeOne("{'key': 'value', 'another': 'thing'}");
builder.analyzeOne('{key: "value", another: "thing"}');
builder.analyzeOne('{Key: "value", Another: "thing"}');
builder.analyzeOne('{1: "value", 2: "thing"}');
builder.analyzeOne('{(1, 2): "value", (3, 4): "thing"}');

builder.analyzeOne('Map(Tuple("a", 1), Tuple("b", 1), Tuple("c", 1))');
builder.analyzeOne('(Map)(Tuple("a", 1), Tuple("b", 1), Tuple("c", 1))');
builder.analyzeOne('Map(Tuple("key", "value"), Tuple("another", "thing"))');

builder.analyzeOne('Error("Something\'s Always Wrong with", Dec("123.456"))');
builder.analyzeOne('Error("Something\'s Always Wrong with", Var("x"), "at", {location: {start: {line: 1, column: 2}, end: {line: 3, column: 4}}})');

builder.analyzeOne('Set("a", "b", "c")');
builder.analyzeOne('(Set)("a", "b", "c")');
builder.analyzeOne('Set()');
builder.analyzeOne('Set("a", "b", "c", "a")'); // duplicates removed
builder.analyzeOne('Set("a", "b", "c", "a", "b")'); // duplicates removed

builder.analyzeOne('x => 42');
builder.analyzeOne('(x => 42)(5)');

// // WORKS! k or const
builder.analyzeOne('( (x,y) => (y) )(5, 42)');
builder.analyzeOne('((x, y) => y)(5, 42)');

// should fail because f is not defined
// // builder.analyzeOne('f("x")');
// // builder.analyzeOne('(f)("x")');
// // builder.analyzeOne('App(f,"x")');
// // builder.analyzeOne('(f)("x", "y")');

// analyzeOne('0(list)'); // <-- this parses, but doesn't build yet // should we not allow this?

builder.analyzeOne("Mul(6, 7)"); // Should return 42, a very important number
builder.analyzeOne("1234567890123456789012345678901234567890 * 9876543210987654321098765432109876543210");
builder.analyzeOne('((x, y) => x * y)(6, 7)'); // Should return 42, a very important number
builder.analyzeOne('((x) => x * 7)(6)'); // Should return 42, a very important number

builder.analyzeOne('(x := 6) => x * 7');
builder.analyzeOne('((z := 2) => (z * 3))');
builder.analyzeOne('(x := 6, y := 7) => x * y');
builder.analyzeOne('(x := ((z := 2) => (z * 3)), y := 7) => x * y');
builder.analyzeOne('Let([(x, 6), (y, 7)], x * y)');
builder.analyzeOne('Let([(Sym("x"), 6), (Sym("y"), 7)], x * y)');
