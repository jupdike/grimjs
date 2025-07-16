import parser from  "../parser.js"
import { Ast } from "../ast.js"
import { GrimVal, Location, AstJson, locToStr } from "./GrimVal.js";
import { GrimBool } from "./GrimBool.js";
import { GrimAst, GrimTag } from "./GrimAst.js";
import { GrimNat } from "./GrimNat.js";
import { GrimStr } from "./GrimStr.js";

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
    GrimVal.makerMap.set("Bool", (children: Array<AstJson | string>) => {
        // console.log('Parsed AST JSON 765 ***:', JSON.stringify(children, null, 2));
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
    // Decimal numbers
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

analyzeOne("12345");
analyzeOne('Nat("12345")');
