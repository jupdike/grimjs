// TODO figure this one out
import gmp from "gmp-wasm";
import type { GMPLib } from "gmp-wasm";
import { Integer } from "gmp-wasm/dist/types/integer.js";

import parser from  "../parser/_parser-sugar.js"
import { CanAst, CanStr, CanTag, CanTaggedApp } from "../parser/CanAst.js"
import { Builder } from "./Builder.js"; // This loads all the makers
import { GrimVal, locToStr } from "./GrimVal.js";
import { EvalState, Eval } from "./Eval.js";
import { GrimNat } from "./GrimNum.js";
import { GrimTag } from "./GrimAst.js";
import { List } from "immutable";

// WORKS! k or const
//analyzeOne('( (x,y) => (y) )(4, 5)');

// let func = GrimTag.callableTagMethodTupleToFuncMap.get(List(["Mul", "Nat", "Nat"]));
// if (func) {
//     let ret = func([new GrimNat("12345678987654321"), new GrimNat("98765432123456789")]);
//     console.log('GrimTag callable Mul result:', ret.toString());
// }

// async function multiplyBigIntegers() {
//     await gmp.init(); // Initialize GMP-wasm

//     // Parse two large integers from strings
//     const a: Integer = gmp.Integer.fromString("1234567890123456789012345678901234567890");
//     const b: Integer = gmp.Integer.fromString("9876543210987654321098765432109876543210");

//     // Multiply them
//     const result: Integer = a.mul(b);

//     // Print the result as a string
//     console.log(result.toString());
// }
// multiplyBigIntegers();

// works
// gmp.init().then(({ getContext }) => {
//     const ctx = getContext();
//     let x = ctx.Integer("1234567890123456789012345678901234567890");
//     let y = ctx.Integer("9876543210987654321098765432109876543210");
//     let z = x.mul(y);
//     console.log(z.toString());
//     setTimeout(() => ctx.destroy(), 50);
// });

// works
// gmp.init().then((ob) => {
//     const ctx = ob.getContext();
//     let x = ctx.Integer("1234567890123456789012345678901234567890");
//     let y = ctx.Integer("9876543210987654321098765432109876543210");
//     let z = x.mul(y);
//     console.log(z.toString());
//     setTimeout(() => ctx.destroy(), 50);
// });

// works
async function multiplyBigIntegers(): Promise<GMPLib> {
    let ob = await gmp.init();
    let ret = ob as GMPLib; // Type assertion to GMPLib
    const ctx = ob.getContext();
    let x = ctx.Integer("1234567890123456789012345678901234567890");
    let y = ctx.Integer("9876543210987654321098765432109876543210");
    let z = x.mul(y);
    console.log(z.toString());
    setTimeout(() => ctx.destroy(), 50);
    return ret; // Return the GMP library object for further use if needed
}
let gmpLib: GMPLib = await multiplyBigIntegers();
console.log("After with multiplyBigIntegers(), got a lib");

let builder: Builder = new Builder(gmpLib); // Initialize the builder with gmp-wasm

builder.analyzeOne("Mul(6, 7)"); // Should return 42, a very important number
builder.analyzeOne("Mul(1234567890123456789012345678901234567890, 9876543210987654321098765432109876543210)");
builder.analyzeOne('((x, y) => x * y)(6, 7)'); // Should return 42, a very important number
builder.analyzeOne('((x) => x * 7)(6)'); // Should return 42, a very important number

/*
builder.analyzeOne("True");
builder.analyzeOne("False");
builder.analyzeOne('Bool("True")');
builder.analyzeOne('Bool("False")');

builder.analyzeOne("Anything");
builder.analyzeOne('Tag("Anything")');

builder.analyzeOne("12345");
builder.analyzeOne('Nat("12345")');

builder.analyzeOne('"Hello, world!"');
builder.analyzeOne('Str("Hello, world!")');
builder.analyzeOne('Str("Hello, \\"world\\"!")');

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

builder.analyzeOne('List()');
builder.analyzeOne('List("a")');
builder.analyzeOne('List("a", "b", "c")');

builder.analyzeOne('[]');
builder.analyzeOne('["a"]');
builder.analyzeOne('["a", "b", "c"]');

// -------------------------------
// // Empty Tuples are not allowed
// // analyzeOne('Tuple()');
// // analyzeOne('()');
// // analyzeOne('(,)');
// -------------------------------

// // Tuples of one or more elements
//analyzeOne('Tuple("a")'); // we don't want to allow this either
//analyzeOne('("a",)'); // not parsing any more
//analyzeOne('("a", "b", "c")');
builder.analyzeOne('Tuple("a", "b", "c")');

builder.analyzeOne('None');
// // ? analyzeOne('Option()');  // probably a bad idea
// // ? analyzeOne('Option("None")');
builder.analyzeOne('Some()'); // ==> None

builder.analyzeOne('Some(None)'); // not None
builder.analyzeOne('Some("value")');
builder.analyzeOne('Some([])'); // ==> nested empty list inside of Some

builder.analyzeOne('Error("Description of problem goes here")');
builder.analyzeOne('Error("Something\'s Always Wrong with", Dec("123.456"))');
builder.analyzeOne('Error("Something\'s Always Wrong with", Var("x"), "at", {location: {start: {line: 1, column: 2}, end: {line: 3, column: 4}}})');

// analyzeOne('0(list)'); // <-- this parses, but doesn't build yet // should we not allow this?

builder.analyzeOne('f("x")');
builder.analyzeOne('(f)("x")');
builder.analyzeOne('App(f,"x")');
builder.analyzeOne('(f)("x", "y")');

builder.analyzeOne('x => x + 4');
builder.analyzeOne('(x => x + 4)(4)');
builder.analyzeOne('(x := 5) => x + 4');

builder.analyzeOne('{"key": "value", "another": "thing"}');
builder.analyzeOne('Map(Tuple("key", "value"), Tuple("another", "thing"))');

builder.analyzeOne('{"key": "value", "another": "thing"}');
builder.analyzeOne("{'key': 'value', 'another': 'thing'}");
builder.analyzeOne('{key: "value", another: "thing"}');
builder.analyzeOne('{Key: "value", Another: "thing"}');
builder.analyzeOne('{1: "value", 2: "thing"}');
builder.analyzeOne('{(1, 2): "value", (3, 4): "thing"}');

builder.analyzeOne('Set("a", "b", "c")');
builder.analyzeOne('(Set)("a", "b", "c")');
builder.analyzeOne('Set()');
builder.analyzeOne('Set("a", "b", "c", "a")'); // duplicates removed
builder.analyzeOne('Set("a", "b", "c", "a", "b")'); // duplicates removed

builder.analyzeOne('Map(Tuple("a", 1), Tuple("b", 1), Tuple("c", 1))');
builder.analyzeOne('(Map)(Tuple("a", 1), Tuple("b", 1), Tuple("c", 1))');
builder.analyzeOne('Map(Tuple("key", "value"), Tuple("another", "thing"))');
*/
