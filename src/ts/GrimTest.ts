import parser from  "../parser.js"
import { Ast } from "../ast.js"
import { GrimVal, Location, AstJson } from "./GrimVal.js";
import { GrimBool } from "./GrimBool.js";
import { GrimAst } from "./GrimAst.js";
import { GrimNum } from "./GrimNum.js";
import { GrimStr } from "./GrimStr.js";

function addMakers() {
    GrimVal.makerMap.set("Tag", (children: Array<AstJson | string>) => {
        //console.log('Parsed AST JSON ***:', JSON.stringify(ast, null, 2));
        if(children && children.length == 1 && children[0] === "True") {
            return GrimBool.True;
        }
        if(children && children.length == 1 && children[0] === "False") {
            return GrimBool.False;
        }
        // if(ast.args && ast.args.length == 1) {
        //     return new GrimTag(ast.args[0]); // assuming args[0] is a string
        // }
        return new GrimAst("NADA");
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

analyzeOne("True");
analyzeOne("False");
analyzeOne('Bool("True")');
analyzeOne('Bool("False")');

