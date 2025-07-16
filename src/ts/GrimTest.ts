import gmp from 'gmp-wasm';

import parser from  "../parser.js"
import { Ast } from "../ast.js"
import { GrimVal, Location, AstJson, locToStr } from "./GrimVal.js";
import { GrimBool } from "./GrimBool.js";
import { GrimAst, GrimTag, GrimVar } from "./GrimAst.js";
import { GrimNat, GrimDec } from "./GrimNum.js";
import { GrimStr } from "./GrimStr.js";
import { GrimError, GrimOpt } from "./GrimOpt.js";
import { GrimList, GrimTuple, GrimMap } from "./GrimCollect.js";

function addMakers() {
    GrimVal.makerMap.set("Tag", (children: Array<AstJson | string>) => {
        //console.log('Parsed AST JSON ***:', JSON.stringify(ast, null, 2));
        // a few special built-in tags that are self-evaluating
        if(children && children.length == 1 && children[0] === "True") {
            return GrimBool.True;
        }
        if(children && children.length == 1 && children[0] === "False") {
            return GrimBool.False;
        }
        if(children && children.length == 1 && children[0] === "None") {
            return GrimOpt.None;
        }
        if(children && children.length == 1 && typeof children[0] === "string") {
            return new GrimTag(children[0]);
        }
        if(children && children.length == 1 && typeof children[0] === "object" &&
            children[0].tag === "Str" && children[0].children && children[0].children.length === 1 &&
            typeof children[0].children[0] === "string") {
            return new GrimTag(children[0].children[0]);
        }
        console.warn(`No maker found for Tag with children: ${JSON.stringify(children, null, 2)}`);
        return new GrimTag("[TODO Tag maker broken somehow]");
    });
    // TODO Var(x) --> prints as itself, so x := Var("x") would print as 'Var(x)' or 'x' without the quotes
    //   so for use in a CAS, a := Var("a") and b:= Var("b") ... z := Var("z")
    //   and alpha := Var("alpha") and beta := Var("beta") ... omega := Var("omega")
    //   and ⍺ := Var("⍺") and β := Var("β") ... ⍵ := Var("⍵")
    //   ? even cooler(?) is that you could do z := CC("z") which is a complex number variable
    GrimVal.makerMap.set("Var", (children: Array<AstJson | string>) => {
        if (children.length === 1 && typeof children[0] === "string") {
            return new GrimVar(children[0]);
        }
        if (children.length === 1 && typeof children[0] === "object"
            && children[0].tag === "Str" && children[0].children
            && children[0].children.length === 1 && typeof children[0].children[0] === "string") {
            return new GrimVar(children[0].children[0]);
        }
        return new GrimAst("NOPE");
    });
    // TODO Sym(x) --> can only evaluate if bound lexically in code, otherwise it is an error
    GrimVal.makerMap.set("Sym", (children: Array<AstJson | string>) => {
        if (children.length === 1 && typeof children[0] === "string") {
            return new GrimVar(children[0]);
        }
        if (children.length === 1 && typeof children[0] === "object"
            && children[0].tag === "Str" && children[0].children
            && children[0].children.length === 1 && typeof children[0].children[0] === "string") {
            return new GrimVar(children[0].children[0]);
        }
        return new GrimAst("NOPE");
    });
    GrimVal.makerMap.set("Bool", (children: Array<AstJson | string>) => {
        if (children[0] === "True") {
            return GrimBool.True;
        }
        if (children[0] === "False") {
            return GrimBool.False;
        }
        if (children.length === 1 && typeof children[0] === "string") {
            // console.log('Parsed AST JSON <> <> *** <> <>:', JSON.stringify(children, null, 2));
            // If it's a string, we can assume it's a boolean value
            return new GrimBool(children[0] === "True");
        }
        if (children.length === 1 && typeof children[0] === "object"
            && children[0].tag === "Str" && children[0].children
            && children[0].children.length === 1 && typeof children[0].children[0] === "string") {
            // console.log('Parsed AST JSON <> <> *** <> <>:', JSON.stringify(children, null, 2));
            // If it's a string, we can assume it's a boolean value
            return new GrimBool(children[0].children[0] === "True");
        }
        return new GrimAst("NOPE");
    });
    GrimVal.makerMap.set("Nat", (children: Array<AstJson | string>) => {
        // console.log('Parsed AST JSON 765 ***:', JSON.stringify(children, null, 2));
        if (children.length === 1 &&
            (typeof children[0] === "number" || typeof children[0] === "string")) {
            return new GrimNat(children[0]);
        }
        if (children.length === 1 && typeof children[0] === "object"
            && children[0].tag === "Str" && children[0].children
            && children[0].children.length === 1 &&
            (typeof children[0].children[0] === "string" ||
             typeof children[0].children[0] === "number")) {
            return new GrimNat(children[0].children[0]);
        }
        return new GrimAst("NOPE");
    });
    GrimVal.makerMap.set("Dec", (children: Array<AstJson | string>) => {
        // console.log('Parsed AST JSON 765 ***:', JSON.stringify(children, null, 2));
        if (children.length === 1 &&
            (typeof children[0] === "number" || typeof children[0] === "string")) {
            return new GrimDec(children[0]);
        }
        if (children.length === 1 && typeof children[0] === "object"
            && children[0].tag === "Str" && children[0].children
            && children[0].children.length === 1 &&
            (typeof children[0].children[0] === "string" ||
             typeof children[0].children[0] === "number")) {
            return new GrimNat(children[0].children[0]);
        }
        return new GrimAst("NOPE");
    });
    GrimVal.makerMap.set("Str", (children: Array<AstJson | string>) => {
        // console.log('Parsed AST JSON 765 ***:', JSON.stringify(children, null, 2));
        if (children.length === 1 && typeof children[0] === "string") {
            return new GrimStr(children[0]);
        }
        if (children.length === 1 && typeof children[0] === "object"
            && children[0].tag === "Str" && children[0].children
            && children[0].children.length === 1 && typeof children[0].children[0] === "string") {
            return new GrimStr(children[0].children[0]);
        }
        return new GrimAst("NOPE");
    });
    GrimVal.makerMap.set("Some", (children: Array<AstJson | string>) => {
        // console.log('Parsed AST JSON 765 ***:', JSON.stringify(children, null, 2));
        if (children.length === 0) {
            return GrimOpt.None;
        }
        if (children.length === 1 && typeof children[0] === "string") {
            return GrimOpt.Some(new GrimStr(children[0]));
        }
        if (children.length === 1 && typeof children[0] === "object") {
            return GrimOpt.Some(GrimVal.fromAst(children[0]));
        }
        return new GrimAst("NOPE");
    });
    GrimVal.makerMap.set("Error", (children: Array<AstJson | string>) => {
        return new GrimError(children.map(child => {
            if (typeof child === "string") {
                return child;
            }
            let val = GrimVal.fromAst(child);
            return val;
        }));
    });

    // Collection types, from Immutable.js
    GrimVal.makerMap.set("List", (children: Array<AstJson | string>) => {
        //console.log('LIST: Parsed AST JSON >>>***:', JSON.stringify(children, null, 2));
        return new GrimList(children.map(child => {
            if (typeof child === "string") {
                return new GrimStr(child);
            }
            // is this even necessary?
            if (typeof child === "object" && child.tag === "Str" && child.children &&
                child.children.length === 1 && typeof child.children[0] === "string") {
                return new GrimStr(child.children[0]);
            }
            // handle other types
            return GrimVal.fromAst(child);
        }));
    });
    GrimVal.makerMap.set("Tuple", (children: Array<AstJson | string>) => {
        //console.log('TUPLE: Parsed AST JSON >>>***:', JSON.stringify(children, null, 2));
        if (children.length === 0) {
            throw new Error("Empty tuples are not allowed in Grim");
        }
        return new GrimTuple(children.map(child => {
            if (typeof child === "string") {
                return new GrimStr(child);
            }
            // is this even necessary?
            if (typeof child === "object" && child.tag === "Str" && child.children &&
                child.children.length === 1 && typeof child.children[0] === "string") {
                return new GrimStr(child.children[0]);
            }
            // handle other types
            return GrimVal.fromAst(child);
        }));
    });
    GrimVal.makerMap.set("Map", (children: Array<AstJson | string>) => {
        // console.log('MAP: Parsed AST JSON >>>***:', JSON.stringify(children, null, 2));
        function keyToString(key: AstJson | string): GrimVal {
            if (typeof key === "string") {
                return new GrimStr(key);
            }
            let keyVal = GrimVal.fromAst(key);
            if (keyVal instanceof GrimVar) {
                return new GrimStr(keyVal.toString()); // Convert to string representation
            }
            if (keyVal instanceof GrimStr || keyVal instanceof GrimNat || keyVal instanceof GrimDec ||
                keyVal instanceof GrimBool || keyVal instanceof GrimTag) {
                return keyVal;
            }
            if (keyVal instanceof GrimTuple) {
                return keyVal;
            }
            return new GrimStr("[Invalid Key: " + keyVal.toString() + "]");
        }
        let entries: [GrimVal, GrimVal][] = [];
        for (let child of children) {
            if (typeof child === "object" &&
                (child.tag === "Pair" || child.tag === "List" || child.tag === "Tuple")
                && child.children
                && child.children.length === 2
            ) {
                let key = keyToString(child.children[0]);
                let value =
                    typeof child.children[1] == "string"
                    ? new GrimStr(child.children[1])
                    : GrimVal.fromAst(child.children[1]);
                entries.push([key, value]);
            }
        }
        if (entries.length !== children.length) {
            return new GrimError(["Invalid Map, expected pairs of key-value, but got: ", JSON.stringify(children)]);
        }
        return new GrimMap(entries);
    });
    // TODO Set

    // TODO Fun
    // TODO Apply or @ or whatever
    // Def
    // Quote(x) or ~x
    //   can't use backtick, since text editors really want
    //   backticks to be paired together `xyz`, so use that for something else?
    // Macro

    // Match .. ?
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

// analyzeOne("True");
// analyzeOne("False");
// analyzeOne('Bool("True")');
// analyzeOne('Bool("False")');

// analyzeOne("Anything");
// analyzeOne('Tag("Anything")');

// analyzeOne("12345");
// analyzeOne('Nat("12345")');

// analyzeOne('"Hello, world!"');
// analyzeOne('Str("Hello, world!")');
// analyzeOne('Str("Hello, \\"world\\"!")');

// analyzeOne('0.1234');
// analyzeOne('Dec("0.1234")');

// analyzeOne('123.456');
// analyzeOne('123.');
// analyzeOne('.456');
// analyzeOne('123.456e+2');
// analyzeOne('123.e-1');
// analyzeOne('.456e2');

// analyzeOne('Dec("123.456")');
// analyzeOne('Dec("123.")');
// analyzeOne('Dec(".456")');
// analyzeOne('Dec("123.456e+2")');
// analyzeOne('Dec("123.e-1")');
// analyzeOne('Dec(".456e2")');

// analyzeOne('List()');
// analyzeOne('List("a")');
// analyzeOne('List("a", "b", "c")');

// analyzeOne('[]');
// analyzeOne('["a"]');
// analyzeOne('["a", "b", "c"]');

// Empty Tuples are not allowed
// analyzeOne('Tuple()');
// analyzeOne('()');
// analyzeOne('(,)');

// Tuples of one or more elements
// analyzeOne('Tuple("a")');
// analyzeOne('("a",)');
// analyzeOne('("a", "b", "c")');
// analyzeOne('Tuple("a", "b", "c")');

// analyzeOne('None');
// // // ? analyzeOne('Option()');  // probably a bad idea
// // // ? analyzeOne('Option("None")');
// analyzeOne('Some()'); // ==> None

// analyzeOne('Some(None)'); // not None
// analyzeOne('Some("value")');
// analyzeOne('Some([])'); // ==> nested empty list inside of Some

// analyzeOne('Error("Description of problem goes here")');
// analyzeOne('Error("Something\'s Always Wrong with", Dec("123.456"))');
// TODO fix Var and Map first //analyzeOne('Error("Something\'s Always Wrong with", Var("x"), "at", {location: {start: {line: 1, column: 2}, end: {line: 3, column: 4}}})');

// analyzeOne('{"key": "value", "another": "thing"}');
// analyzeOne("{'key': 'value', 'another': 'thing'}");
// analyzeOne('{key: "value", another: "thing"}');
// analyzeOne('{Key: "value", Another: "thing"}');
// analyzeOne('{1: "value", 2: "thing"}');
analyzeOne('{(1, 2): "value", (3, 4): "thing"}');
