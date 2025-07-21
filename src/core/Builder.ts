import { List, Map, Set } from "immutable";

import type { GMPLib } from "gmp-wasm";

import parser from  "../parser/_parser-sugar.js"

import { GrimVal } from "./GrimVal.js";
import { GrimBool } from "./GrimBool.js";
import { GrimApp, GrimFun, GrimLet } from "./GrimFun.js";
import { GrimTag, GrimVar, GrimSym } from "./GrimAst.js";
import { GrimNat, GrimDec } from "./GrimNum.js";
import { GrimStr } from "./GrimStr.js";
import { GrimError, GrimOpt } from "./GrimOpt.js";
import { GrimList, GrimTuple, GrimMap, GrimSet } from "./GrimCollect.js";
import { Location, CanApp, CanAst, CanStr, CanTag, CanTaggedApp } from "../parser/CanAst.js";
import { Eval, EvalState } from "./Eval.js";

type AstToVal = (ast: CanAst | Array<GrimVal>, builder: Builder) => GrimVal;

type FuncType = (args: Array<GrimVal>) => GrimVal;

class Builder {
    constructor(gmpLib: GMPLib) {
        this.gmpLib = gmpLib;
        this.addMakers();
    }
    gmpLib: GMPLib; // Will be set after gmp.init(), by async caller
    private makerMap: Map<string, AstToVal> = Map<string, AstToVal>();
    didInit = false;

    addMaker(tag: string, maker: AstToVal) {
        this.makerMap = this.makerMap.set(tag, maker);
    }

    // is this needed?
    getMaker(tag: string): AstToVal | undefined {
        return this.makerMap.get(tag);
    }

    fromAst(ast: CanAst): GrimVal {
        if (ast instanceof CanStr) {
            // String literal
            const maker = this.makerMap.get("Str");
            return maker ? maker(ast, this) : new GrimVal();
        }
        if (ast instanceof CanTag) {
            // Tag literal
            const maker = this.makerMap.get("Tag");
            return maker ? maker(ast, this) : new GrimVal();
        }
        if (ast instanceof CanApp) {
            // Function application
            const maker = this.makerMap.get("@");
            return maker ? maker(ast, this) : new GrimError(["NOPE_fromAst_CanApp"]);
        }
        if (ast instanceof CanTaggedApp) {
            // Tagged application - use the tag to determine the maker
            const tagName = ast.tag.tag;
            const maker = this.makerMap.get(tagName);
            if (!maker) {
                console.warn(`Builder.fromAst: No maker found for tag '${tagName}'`);
                const appMaker = this.makerMap.get("@");
                const tagMaker = this.makerMap.get("Tag");
                if (appMaker && tagMaker) {
                    return appMaker(
                        new CanApp(ast.location, new CanTag(ast.location, tagName), ast.args),
                        this
                    );
                }
            }
            return maker ? maker(ast, this) : new GrimVal();
        }
        
        if(!ast) {
            console.warn("builder.fromAst received undefined or null AST");
            return new GrimVal();
        }
        console.warn(`No CanAst maker found for AST type: ${ast.constructor.name}`);
        return new GrimVal();
    }

    // [Add,Int,Int]: <func>
    // [Bool,Str]: <func>
    // [Opt,Str]: <func>
    // [Tag,Str]: <func>
    // [Error]: <func> // TODO allow varargs ... maybe use App?
    // [List]: <func> // TODO allow varargs ... maybe use App?
    // [Map]: <func> // TODO allow varargs ... maybe use App?
    // [Set]: <func> // TODO allow varargs ... maybe use App?
    // [Tuple]: <func> // TODO allow varargs ... maybe use App?
    // Fun is not first-class, it is a special form
    callableTagMethodTupleToFuncMap: Map<List<string>, FuncType> = Map();
    callableTagMethodIsAvailable: Set<string> = Set();

    addCallableTag(tag: List<string>, func: FuncType) {
        if(tag.size < 2) {
            console.warn("GrimTag.addCallableTag called with invalid tag (needs at least 2 parts)");
            return;
        }
        this.callableTagMethodIsAvailable = this.callableTagMethodIsAvailable.add(tag.join('.'));
        this.callableTagMethodTupleToFuncMap = this.callableTagMethodTupleToFuncMap.set(tag, func);
    }

    isCallable(val: GrimVal): boolean {
        if (val instanceof GrimTag) {
            if (this.callableTagMethodIsAvailable.has(val.value)) {
                return true;
            }
            if (this.makerMap.has(val.value)) {
                return true; // If there's a maker for this tag, it is callable
            }
            // some tags are callable, like "Add", "Mul", etc.
            // but only under certain conditions
        }
        if (val instanceof GrimFun) {
            return true; // GrimFun is callable
        }
        return false;
    }

    // TESTING CODE
    locToStr(loc: Location | undefined): string {
        if(!loc) {
            return "unknown location";
        }
        return `line ${loc.start.line} col ${loc.start.column} to line ${loc.end.line} col ${loc.end.column}`;
    }

    check(str: string, start: string | null = null, onlyErrors = false): CanAst {
        start = start || "Start";
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
            console.log(str, '  ~~ EXCEPTION THROWN as ~~>\n  ', `Error('${e.message}', '${this.locToStr(e.location)}')` );
            //return Ast( e.location || 'unknown', "Error", [e.message] );
            return new CanTaggedApp(e.location,
                new CanTag(e.location, "Error"),
                [e.message, e.location].map(x => new CanStr(e.location, x))
            );
        }
    }

    analyzeOne(str: string) {
        let ast: CanAst = this.check(str);
        //console.log('Parsed AST JSON    :', JSON.stringify(ast, null, 2));
        console.log('Parsed AST toString:', ast.toString());
        // TODO work on this
        let val = this.fromAst(ast);
        console.log('GrimVal from AST   :', val.toString());
        let state = new EvalState(val, Map(), this);
        let result: GrimVal | null = null;
        try {
            result = Eval.evaluate(state).expr;
        } catch (e) {
            console.error('Eval error          :', e);
        }
        if (result) {
            console.log('Eval result        :', result.toString());
        }
    }

    private addMakers() {
        if (this.didInit) {
            return;
        }
        this.didInit = true;

        // CanAst makers - register the same makers for type-safe CanAst processing
        this.addMaker("Str", GrimStr.maker);
        this.addMaker("Nat", GrimNat.maker);
        this.addMaker("Dec", GrimDec.maker);

        // includes a few builtin atoms like True, False, None
        this.addMaker("Tag", GrimTag.maker);
        // Sym("x") --> can only evaluate if bound lexically in code, otherwise it is an error / Build error (not just an Eval error)
        this.addMaker("Sym", GrimSym.maker);
        // Var("x") always evaluates to itself, but could be used to bind a variable with some extra operator or function
        this.addMaker("Var", GrimVar.maker);
        this.addMaker("Bool", GrimBool.maker);
        this.addMaker("Some", GrimOpt.maker);
        this.addMaker("Error", GrimError.maker);

        // // Collection types
        this.addMaker("List", GrimList.maker);
        // // version of List with fixed length, very different later in the type system
        // // can only be pair or wider
        this.addMaker("Tuple", GrimTuple.maker);
        this.addMaker("Map", GrimMap.maker);
        this.addMaker("Set", GrimSet.maker);

        // // Function application and definitions
        this.addMaker("App", GrimApp.maker);
        this.addMaker("@", GrimApp.maker);
        this.addMaker("Fun", GrimFun.maker);
        // this.addMaker("Let", GrimLet.maker);

        this.addCallableTag(List(["Mul", "Nat", "Nat"]), (args: Array<GrimVal>) => {
            console.log("called Mul.Nat.Nat 1");
            if (args.length !== 2) {
                console.log("called Mul.Nat.Nat 2");
                console.warn("GrimTag.addCallableTag called with invalid args for Mul.Nat.Nat");
                return new GrimError(["Mul.Nat.Nat requires exactly 2 arguments"]);
            }
            console.log("called Mul.Nat.Nat 3");
            if (args[0] instanceof GrimNat && args[1] instanceof GrimNat) {
                //return new GrimNat(args[0].value.add(args[1].value));
                console.log("called Mul.Nat.Nat 4");
                return GrimNat.fromBinaryFunction(this.gmpLib, args[0], args[1], (a: any, b: any) => {
                    console.log("called Mul.Nat.Nat 5");
                    return a.mul(b); // Use GMP's multiply function for IntegerType
                });
            }
            console.log("called Mul.Nat.Nat 6");
            return new GrimError(["Mul(Nat,Nat) requires Nat arguments"]);
        });
    }
}

export { Builder }
