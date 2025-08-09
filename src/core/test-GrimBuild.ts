import gmp from "gmp-wasm";
import type { GMPLib } from "gmp-wasm";
import { readFileSync } from "fs";
import type { TestEntry, TestSuite } from "./Tester.js"; // Import types for test entries and suites
import { Tester } from "./Tester.js";
import { Builder } from "./Builder.js"; // This loads all the makers
import { GrimParser } from "../parser/GrimParser.js";

let gmpLib: GMPLib = await gmp.init();
if (!gmpLib) {
    throw new Error("GMP library failed to initialize");
}
console.log("got GMPLib with this many bindings:", Object.keys((gmpLib as any).binding).length);

const bootDotGrimPath = "src/core/boot.grim"
let parser = new GrimParser(bootDotGrimPath);
let bootGrim = readFileSync(bootDotGrimPath, "utf8");
let bootDefinitions = GrimParser.groupDefinitions(bootGrim.split("\n")); // Parse the boot definitions
let bootModule = Builder.fromDefinitions(parser, gmpLib, bootDefinitions); // Test the definitions

let mainTestsYaml = readFileSync("src/test/test-table.yaml", "utf8");
let tester = new Tester(bootModule);
let mainTestsJson = Tester.parseTestLines(mainTestsYaml) as Array<TestSuite>;
tester.runTests(mainTestsJson);

// for showing how these definitions are grouped into lines
// for (let def of bootDefinitions) {
//     console.log("---");
//     console.log(def);
// }
// for testing parsing on all these definitions grouped into lines
// for (let def of bootDefinitions) {
//     builder.analyzeOne(def, true); // Analyze each boot definition
// }
// console.log(`${bootDefinitions.length} definitions parsed successfully.`);

/*
// This is a comment
Int :> Nat
Rat :> Int
Rat :> Nat

f(x, y) := x + y

// // fails, as expected -->
// // builder.analyzeOne("x");  // because x is not defined
// // ? analyzeOne('Option()');  // probably a bad idea
// // ? analyzeOne('Option("None")');
builder.analyzeOne('Some([])'); // ==> nested empty list inside of Some
// -------------------------------
// // Empty Tuples are not allowed
// // analyzeOne('Tuple()');
// // analyzeOne('()');
// // analyzeOne('(,)');
// -------------------------------
// // Tuples of one or more elements
// //analyzeOne('Tuple("a")'); // we don't want to allow this either
// //analyzeOne('("a",)'); // not parsing any more
builder.analyzeOne('Set("a", "b", "c", "a")'); // duplicates removed
builder.analyzeOne('Set("a", "b", "c", "a", "b")'); // duplicates removed
// should fail because f is not defined
// // builder.analyzeOne('f("x")');
// // builder.analyzeOne('(f)("x")');
// // builder.analyzeOne('App(f,"x")');
// // builder.analyzeOne('(f)("x", "y")');
// analyzeOne('0(list)'); // <-- this parses, but doesn't build yet // should we not allow this?
also fails, as expected -->
sugar:       (x, x) => x / 2

sugar:       True ? One $ Two
sugar:       False ? One $ Two
*/
