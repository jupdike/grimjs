import gmp from 'gmp-wasm';

import parser from  "../parser.js"
import { Ast } from "../ast.js"
import { GrimVal, Location, AstJson, locToStr } from "./GrimVal.js";
import { GrimBool } from "./GrimBool.js";
import { GrimApp } from "./GrimFun.js";
import { GrimAst, GrimTag, GrimVar, GrimSym } from "./GrimAst.js";
import { GrimNat, GrimDec } from "./GrimNum.js";
import { GrimStr } from "./GrimStr.js";
import { GrimError, GrimOpt } from "./GrimOpt.js";
import { GrimList, GrimTuple, GrimMap, GrimSet } from "./GrimCollect.js";

function addMakers() {
    // includes a few builtin atoms like True, False, None
    GrimVal.makerMap.set("Tag",  GrimTag.maker);

    // Var("x") always evaluates to itself, but could be used to bind a variable with some extra operator or function
    GrimVal.makerMap.set("Var", GrimVar.maker);
    // Sym("x") --> can only evaluate if bound lexically in code, otherwise it is an error / Build error (not just an Eval error)
    GrimVal.makerMap.set("Sym", GrimSym.maker);
    GrimVal.makerMap.set("Bool", GrimBool.maker);
    GrimVal.makerMap.set("Nat", GrimNat.maker);
    GrimVal.makerMap.set("Dec", GrimDec.maker);
    GrimVal.makerMap.set("Str", GrimStr.maker);
    GrimVal.makerMap.set("Some", GrimOpt.maker);
    GrimVal.makerMap.set("Error", GrimError.maker);

    // Collection types, from Immutable.js
    GrimVal.makerMap.set("List", GrimList.maker);
    GrimVal.makerMap.set("Tuple", GrimTuple.maker); // just another wrapper for list
    GrimVal.makerMap.set("Map", GrimMap.maker);
    GrimVal.makerMap.set("Set", GrimSet.maker);

    // Function application
    GrimVal.makerMap.set("App", GrimApp.maker);
    GrimVal.makerMap.set("@", GrimApp.maker);
}
addMakers();

function check(str: string, start: string | null = null, onlyErrors = false): AstJson {
    start = start || "Expr";
    try {
        var ret = parser.parse(str, {startRule: start});
        if (!onlyErrors) {
            console.log('---');
            console.log(str, '\n  ~~ parses as ~~>\n', ret.toString() );
        }
        return ret;
    } catch (e) {
        console.log('---');
        //console.log("Error", [e.message]);
        console.log(str, '  ~~ EXCEPTION THROWN as ~~>\n  ', `Error('${e.message}', '${locToStr(e.location)}')` );
        return Ast( e.location || 'unknown', "Error", [e.message] );
    }
}
//gmp.init().then(({ getContext }) => {
//   const ctx = getContext();
//});

function analyzeOne(str: string) {
    let ast = check(str);
    //console.log('Parsed AST JSON    :', JSON.stringify(ast, null, 2));
    console.log('Parsed AST toString:', ast.toString());
    // TODO work on this
    let val = GrimVal.fromAst(ast);
    console.log('GrimVal from AST   :', val.toString());
}

analyzeOne("True");
analyzeOne("False");
analyzeOne('Bool("True")');
analyzeOne('Bool("False")');

analyzeOne("Anything");
analyzeOne('Tag("Anything")');

analyzeOne("12345");
analyzeOne('Nat("12345")');

analyzeOne('"Hello, world!"');
analyzeOne('Str("Hello, world!")');
analyzeOne('Str("Hello, \\"world\\"!")');

analyzeOne('0.1234');
analyzeOne('Dec("0.1234")');

analyzeOne('123.456');
analyzeOne('123.');
analyzeOne('.456');
analyzeOne('123.456e+2');
analyzeOne('123.e-1');
analyzeOne('.456e2');

analyzeOne('Dec("123.456")');
analyzeOne('Dec("123.")');
analyzeOne('Dec(".456")');
analyzeOne('Dec("123.456e+2")');
analyzeOne('Dec("123.e-1")');
analyzeOne('Dec(".456e2")');

analyzeOne('List()');
analyzeOne('List("a")');
analyzeOne('List("a", "b", "c")');

analyzeOne('[]');
analyzeOne('["a"]');
analyzeOne('["a", "b", "c"]');

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
analyzeOne('Tuple("a", "b", "c")');

analyzeOne('None');
// // ? analyzeOne('Option()');  // probably a bad idea
// // ? analyzeOne('Option("None")');
analyzeOne('Some()'); // ==> None

analyzeOne('Some(None)'); // not None
analyzeOne('Some("value")');
analyzeOne('Some([])'); // ==> nested empty list inside of Some

analyzeOne('Error("Description of problem goes here")');
analyzeOne('Error("Something\'s Always Wrong with", Dec("123.456"))');
analyzeOne('Error("Something\'s Always Wrong with", Var("x"), "at", {location: {start: {line: 1, column: 2}, end: {line: 3, column: 4}}})');

analyzeOne('{"key": "value", "another": "thing"}');
analyzeOne("{'key': 'value', 'another': 'thing'}");
analyzeOne('{key: "value", another: "thing"}');
analyzeOne('{Key: "value", Another: "thing"}');
analyzeOne('{1: "value", 2: "thing"}');
analyzeOne('{(1, 2): "value", (3, 4): "thing"}');

analyzeOne('Set("a", "b", "c")');
analyzeOne('Set()');
analyzeOne('Set("a", "b", "c", "a")'); // duplicates removed
analyzeOne('Set("a", "b", "c", "a", "b")'); // duplicates removed

analyzeOne('(Map)("a", "b", "c")'); // <-- nice, this works

// analyzeOne('0(list)'); // <-- this parses, but doesn't build yet

analyzeOne('f("x")');
analyzeOne('(f)("x")');
analyzeOne('App(f,"x")');
analyzeOne('(f)("x", "y")');
