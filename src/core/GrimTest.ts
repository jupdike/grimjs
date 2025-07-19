import gmp from 'gmp-wasm';

// TODO put in new robust parser instead
import parser from  "../parser/_parser-old.js"
import { Ast } from "../parser/OldAst.js"
import { GrimVal, AstJson, locToStr } from "./GrimVal.js";
import type { Location } from "./GrimVal.js";

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
analyzeOne('(Set)("a", "b", "c")');
analyzeOne('Set()');
analyzeOne('Set("a", "b", "c", "a")'); // duplicates removed
analyzeOne('Set("a", "b", "c", "a", "b")'); // duplicates removed

// analyzeOne('0(list)'); // <-- this parses, but doesn't build yet // should we not allow this?

analyzeOne('f("x")');
analyzeOne('(f)("x")');
analyzeOne('App(f,"x")');
analyzeOne('(f)("x", "y")');

// TODO why is this broken?
//analyzeOne('Map(Pair("a", 1), Pair("b", 1), Pair("c", 1))');
// TODO once that works, this should work too
//analyzeOne('(Map)(Pair("a", 1), Pair("b", 1), Pair("c", 1))');

analyzeOne('x => x + 4');
analyzeOne('(x => x + 4)(4)');
analyzeOne('(x := 5) => x + 4');

analyzeOne('Map(Pair("key", "value"), Pair("another", "thing"))');
