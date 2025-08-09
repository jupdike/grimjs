import { List, Map, PairSorting, Set } from "immutable";
import { DivMode, type GMPLib } from "gmp-wasm";
import { GrimParser } from "../parser/GrimParser.js";

import { GrimVal } from "./GrimVal.js";
import { GrimBool } from "./GrimBool.js";
import { GrimApp, GrimFun, GrimLet } from "./GrimFun.js";
import { GrimTag, GrimVar, GrimSym } from "./GrimAst.js";
import { GrimNat, GrimDec, GrimInt, GrimRat } from "./GrimNum.js";
import { GrimStr } from "./GrimStr.js";
import { GrimError, GrimOpt } from "./GrimOpt.js";
import { GrimList, GrimTuple, GrimMap, GrimSet } from "./GrimCollect.js";
import { CanApp, CanAst, CanStr, CanTag, CanTaggedApp } from "../parser/CanAst.js";
import { Eval, EvalState } from "./Eval.js";

type AstToVal = (ast: CanAst | Array<GrimVal>, module: GrimModule) => GrimVal;
type FuncType = (args: Array<GrimVal>) => GrimVal;

enum TagAppType {
    MDMA, // Multi-dispatch method application
    Maker, // Maker is like a constructor, single argument, usually a string, also used for casts
    MacroRules, // Macro rules for symbolically transforming code
}

type MacroMatchRule = {
    args: Array<GrimVal>;
    body: GrimVal;
};

class GrimModule {
    // ensure that each tag app can only be called in one of three ways
    private tagAppTypes: Map<string, TagAppType> = Map();

    private castPairs: Set<List<string>> = Set();
    addCast(tagBig: string, tagSmall: string) {
        // This is a way to add a cast from one tag to another, e.g. from "Nat" into "Int"
        // console.error(`Adding cast from ${tagBig} to ${tagSmall}`);
        this.castPairs = this.castPairs.add(List([tagBig, tagSmall]));
    }
    hasCast(tagBig: string, tagSmall: string): boolean {
        // console.error(`CastPairs: ${this.castPairs.size}`);
        // console.error(`Checking cast to ${tagBig} :> ${tagSmall}`);
        let ret: boolean = this.castPairs.has(List([tagBig, tagSmall]));
        // console.error(`         Cast to ${tagBig} :> ${tagSmall}  --> ${ret}`);
        return ret;
    }

    constructor(parser: GrimParser, gmpLib: GMPLib) {
        this.parser = parser;
        this.gmpLib = gmpLib;
        this.addMakers();
    }

    static fromDefinitions(parser: GrimParser, gmpLib: GMPLib, definitions: Array<string>): GrimModule {
        let module = new GrimModule(parser, gmpLib);
        console.error(`Building a module with ${definitions.length} definitions...`);
        for (const def of definitions) {
            module.addOneDefinition(def);
        }
        return module;
    }

    moduleEnv: Map<string, GrimVal> = Map<string, GrimVal>(); // Environment for variable bindings

    sugarToAst(sugar: string, options: { startRule: string }): CanAst | null {
        try {
            var ret = this.parser.parse(sugar, options);
            return ret;
        } catch (e) {
            console.error('Error parsing sugar:', e);
            return null;
        }
    }

    private macroMatchRules: Map<string, List<MacroMatchRule>> = Map();
    private addMacroMatchRule(tag: string, args: Array<GrimVal>, body: GrimVal) {
        if (!this.tagAppTypes.has(tag)) {
            this.tagAppTypes = this.tagAppTypes.set(tag, TagAppType.MacroRules);
        }
        if (this.tagAppTypes.get(tag) !== TagAppType.MacroRules) {
            throw new Error(`Tag '${tag}' is not a MacroRules type, does some other job instead. Tags can only have one job.`);
        }
        let rules = this.macroMatchRules.get(tag) || List();
        rules = rules.push({ args, body });
        this.macroMatchRules = this.macroMatchRules.set(tag, rules);
    }

    private static tagStringFromTagAst(tagAst: CanAst): string | null {
        if (tagAst instanceof CanTag) {
            return tagAst.tag;
        } else if (tagAst instanceof CanTaggedApp && tagAst.tag.tag === "Tag" &&
            tagAst.args.length === 1 && tagAst.args[0] instanceof CanStr) {
            return tagAst.args[0].str;
        } else {
            return null;
        }
    }

    private addOneDefinition(def: string) {
        let sugar = def.trim();
        console.log(`sugar:       ${sugar}`);
        let ast: CanAst | null = this.sugarToAst(sugar, { startRule: "Definition" });
        if (!ast) {
            console.error("Failed to parse sugar:", sugar);
            return;
        }
        let oneAstStr = ast.toString();
        console.log(`desugared:   ${oneAstStr}`);
        if (ast instanceof CanTaggedApp) {
            let tagStr = ast.tag.tag;
            if (tagStr === "DefMacroMatchRule") {
                // Handle DefMacroMatchRule specifically
                if (ast.args.length !== 3) {
                    console.error(`DefMacroMatchRule requires exactly 3 arguments, got ${ast.args.length}`);
                    return;
                }
                let [tagAst, argsAst, bodyAst] = ast.args;
                let tag: string = GrimModule.tagStringFromTagAst(tagAst) || "";
                if (tag === "") {
                    console.error(`DefMacroMatchRule first argument must be a Tag, got ${tagAst.constructor.name}`);
                    return;
                }
                //console.error(`DefMacroMatchRule tag: ${tag}`);
                if (!(argsAst instanceof CanTaggedApp) || argsAst.tag.tag !== "List") {
                    console.error(`DefMacroMatchRule second argument must be a List of arguments, got ${argsAst.constructor.name}`);
                    return;
                }
                let args: Array<GrimVal> = argsAst.args.map(arg => {
                    let tg = GrimModule.tagStringFromTagAst(arg);
                    if (tg) {
                        return new GrimTag(tg);
                    } else {
                        return this.fromAst(arg);
                    }
                });
                //console.error(`DefMacroMatchRule args: ${args.map(a => a.toCanonicalString()).join(", ")}`);
                let body: GrimVal | null = this.fromAst(bodyAst);
                if (!body) {
                    console.error(`DefMacroMatchRule body must be a valid expression, got ${bodyAst.constructor.name}`);
                    return;
                }
                this.addMacroMatchRule(tag, args, body);
            }
            if (tagStr === "DefCast") {
                // Handle DefCast specifically
                if (ast.args.length !== 2) {
                    console.error(`DefCast requires exactly 2 arguments, got ${ast.args.length}`);
                    return;
                }
                let bigTag: string | null = null;
                let smallTag: string | null = null;
                if (ast.args[0] instanceof CanTag) {
                    // The first argument is a tag, e.g. "Int"
                    bigTag = (ast.args[0] as CanTag).tag;
                    console.log(`bigTag:      ${bigTag}`);
                }
                if (ast.args[0] instanceof CanTaggedApp && ast.args[0].tag.tag === "Tag"
                    && ast.args[0].args.length === 1
                    && ast.args[0].args[0] instanceof CanStr) {
                    bigTag = (ast.args[0].args[0] as CanStr).str;
                    console.log(`bigTag:      ${bigTag}`);
                }
                if (ast.args[1] instanceof CanTag) {
                    // The second argument is a tag, e.g. "Nat"
                    smallTag = (ast.args[1] as CanTag).tag;
                    console.log(`smallTag:    ${smallTag}`);
                }
                if (ast.args[1] instanceof CanTaggedApp && ast.args[1].tag.tag === "Tag"
                    && ast.args[1].args.length === 1
                    && ast.args[1].args[0] instanceof CanStr) {
                    smallTag = (ast.args[1].args[0] as CanStr).str;
                    console.log(`smallTag:    ${smallTag}`);
                }
                if (!bigTag || !smallTag) {
                    console.error("DefCast requires both a big tag and a small tag");
                    return;
                }
                this.addCast(bigTag, smallTag);
            }
            if (tagStr === "Def") {
                if (ast.args.length < 2 || ast.args.length > 3) {
                    console.error(`Def requires 2 or 3 arguments, got ${ast.args.length}`);
                    return;
                }
                let lhs = ast.args[0];
                if (!(lhs instanceof CanTaggedApp) || lhs.tag.tag !== "Sym" || lhs.args.length !== 1
                    || !(lhs.args[0] instanceof CanStr)) {
                    console.error(`Def first argument must be a Sym, got ${lhs.constructor.name}`);
                    return;
                }
                let lhsName = (lhs.args[0] as CanStr).str;
                if (ast.args.length === 2) {
                    // This is a simple definition, e.g. "y := x + 1"
                    let rhs = ast.args[1];
                    //console.error(`Defining ${lhsName} with expression as rhs: ${rhs.toString()}`);
                    // build rhs into a GrimVal
                    let val = this.fromAst(rhs);
                    if (val instanceof GrimFun) {
                        //console.error(`Defining ${val.funcName} as an anonymous function, so rename it to ${lhsName}`);
                        val.funcName = lhsName; // Set the function name for runtime inspection
                        //console.error(`Renamed function to ${val.funcName}`);
                    }
                    // Store it in the module environment.
                    // note that the rhs is code and not evaluated yet, because function definitions might
                    // call each other in any order
                    this.moduleEnv = this.moduleEnv.set(lhsName, val);
                }
                else if (ast.args.length === 3) {
                    // This is a function definition, e.g. "f(x) := x + 1"
                    let params = ast.args[1];
                    let body = ast.args[2];
                    if (!(params instanceof CanTaggedApp) || params.tag.tag !== "List") {
                        console.error(`Def second argument must be a List of parameters, got ${params.constructor.name}`);
                        return;
                    }
                    //console.error(`Defining ${lhsName} with parameters: ${params.toString()} and body: ${body.toString()}`);
                    // build function from params and body into a GrimFun
                    let paramsList: Array<GrimVal> = params.args.map(arg => {
                        if (arg instanceof CanTaggedApp && arg.tag.tag === "Sym" && arg.args.length === 1
                            && arg.args[0] instanceof CanStr) {
                            return new GrimSym((arg.args[0] as CanStr).str);
                        }
                        console.error(`Def parameters must be Sym, got ${arg.constructor.name}`);
                        return new GrimError(["Def parameters must be Sym, got " + arg.constructor.name]);
                    });
                    let bodyVal = this.fromAst(body);
                    let fun = new GrimFun(paramsList, bodyVal, lhsName);
                    this.moduleEnv = this.moduleEnv.set(lhsName, fun);
                }
            }
        }
        let keySummary: Array<string> = this.moduleEnv.keySeq().toArray();
        let macroSummary: Array<string> = this.macroMatchRules.keySeq().map(k => `${k}(${this.macroMatchRules.get(k)?.size || 0})`).toArray();
        console.error(`No. Casts: ${this.castPairs.size} -- moduleEnv size: ${this.moduleEnv.size} -- Defs: ${keySummary.join(", ")} -- Macros: ${macroSummary.join(", ")}`);
        console.log("#");
    }

    evaluatedModuleEnv(): Map<string, GrimVal> {
        // This is a convenience method to evaluate the module environment
        // and return the values as GrimVals.
        let evaluatedEnv: Map<string, GrimVal> = Map<string, GrimVal>();
        // lift GrimFun instances in the moduleEnv to the top
        this.moduleEnv
            .filter((val) => val instanceof GrimFun)
            .forEach((val, key) => {
                let result = Eval.evaluate(new EvalState(val, evaluatedEnv, this)).expr;
                evaluatedEnv = evaluatedEnv.set(key, result);
            });
        // scalars and other values are evaluated after all functions are lifted to the top
        this.moduleEnv
            .filter((val) => !(val instanceof GrimFun))
            .forEach((val, key) => {
                let result = Eval.evaluate(new EvalState(val, evaluatedEnv, this)).expr;
                evaluatedEnv = evaluatedEnv.set(key, result);
            });
        return evaluatedEnv;
    }

    readonly parser: GrimParser;
    readonly gmpLib: GMPLib; // Will be set after gmp.init(), by async caller

    private makerMap: Map<string, AstToVal> = Map<string, AstToVal>();
    private didInit = false;

    addMaker(tag: string, maker: AstToVal) {
        if (!this.tagAppTypes.has(tag)) {
            this.tagAppTypes = this.tagAppTypes.set(tag, TagAppType.Maker);
        }
        if (this.tagAppTypes.get(tag) !== TagAppType.Maker) {
            throw new Error(`Tag '${tag}' is not a Maker type, does some other job instead. Tags can only have one job.`);
        }
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
                // this is not a problem, because we can use the tag to find a maker and restructure the AST
                //console.warn(`GrimModule.fromAst: No maker found for tag '${tagName}'`);
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
            console.warn("GrimModule.fromAst received undefined or null AST");
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

    addCallableTag(tagTuple: List<string>, func: FuncType) {
        if(tagTuple.size < 2) {
            console.warn("GrimTag.addCallableTag called with invalid tag (needs at least 2 parts)");
            return;
        }
        let tag = tagTuple[0];
        if (!this.tagAppTypes.has(tag)) {
            this.tagAppTypes = this.tagAppTypes.set(tag, TagAppType.MDMA);
        }
        if (this.tagAppTypes.get(tag) !== TagAppType.MDMA) {
            throw new Error(`Tag '${tag}' is not a Multi-Dispatch Method Application type, does some other job instead. Tags can only have one job.`);
        }
        this.callableTagMethodIsAvailable = this.callableTagMethodIsAvailable.add(tagTuple.join('.'));
        this.callableTagMethodTupleToFuncMap = this.callableTagMethodTupleToFuncMap.set(tagTuple, func);
    }

    addCallableTagEqNeqPair(tags: List<string>, func: FuncType) {
        if (tags.get(0) != "Eq") {  // Ensure the first tag is "Eq"
            throw new Error("GrimTag.addCallableTagEqNeqPair called with invalid tags (first tag must be 'Eq')");
        }
        this.addCallableTag(tags, func);
        // Negate the result of Eq for Neq
        let neqTags = tags.set(0, "Neq");
        this.addCallableTag(neqTags, (args: Array<GrimVal>) => {
            let bool = func(args) as GrimBool;
            //console.error("Result of Eq for Neq:", bool.toString(), " -- negating");
            return bool.not();
        });
    }

    isCallable(val: GrimVal): boolean {
        if (val instanceof GrimTag) {
            // needs an enum
            if (!this.tagAppTypes.has(val.value)) {
                return false;
            }
            // and needs to be in an appropriate map
            if (this.tagAppTypes.get(val.value) === TagAppType.MDMA && this.callableTagMethodIsAvailable.has(val.value)) {
                return true;
            }
            if (this.tagAppTypes.get(val.value) === TagAppType.Maker && this.makerMap.has(val.value)) {
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

    private addMakers() {
        if (this.didInit) {
            return;
        }
        this.didInit = true;

        // CanAst makers - register the same makers for type-safe CanAst processing
        this.addMaker("Str", GrimStr.maker);
        this.addMaker("Nat", GrimNat.maker);
        this.addMaker("Int", GrimInt.maker);
        this.addMaker("Rat", GrimRat.maker);
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
        this.addMaker("Let", GrimLet.maker);

        // TODO note that casts are now added in boot.grim instead of in code here
        // this.addCast("Int", "Nat");
        // this.addCast("Rat", "Int");
        // this.addCast("Rat", "Nat");
        // users can add casts in their own code:
        //   DefCast(Int, Nat)
        // or
        //   Int :> Nat
        // ---
        // casting allows just these definitions
        //   Tag(x, x)
        //   Tag(y, y)
        //   Tag(z, z)
        // plus
        //   y :> x
        //   z :> y
        //   z :> x
        // to be used in a function like this:
        // to automatically cast from
        // Tag(x, y)
        // or
        // Tag(y, x)
        // or
        // Tag(z, x)
        // or
        // Tag(z, y)
        // TO...
        // Tag(y, y)
        // or
        // Tag(z, z)
        // as long as Z(y) and Z(x) are defined
        // This all eliminates a lot of boilerplate M x N code

        this.addCallableTag(List(["Mul", "Nat", "Nat"]),
            GrimNat.wrapBinaryOp(this, (a, b) => { return a.mul(b); }));
        this.addCallableTag(List(["Add", "Nat", "Nat"]),
            GrimNat.wrapBinaryOp(this, (a, b) => { return a.add(b); }));
        this.addCallableTag(List(["Pow", "Nat", "Nat"]),
            GrimNat.wrapBinaryOp(this, (a, b) => { return a.pow(b); }));
        this.addCallableTag(List(["Mod", "Nat", "Nat"]),
            GrimNat.wrapBinaryOp(this, (a, b) => {
                let c = a.div(b, DivMode.FLOOR);
                let r = a.sub(c.mul(b));
                return r;
            }));
        this.addCallableTag(List(["Lt", "Nat", "Nat"]),
            GrimNat.wrapBinaryOpBool(this, (a, b) => { return a.lessThan(b); }));
        this.addCallableTag(List(["LtEq", "Nat", "Nat"]),
            GrimNat.wrapBinaryOpBool(this, (a, b) => { return a.lessOrEqual(b); }));
        this.addCallableTag(List(["Gt", "Nat", "Nat"]),
            GrimNat.wrapBinaryOpBool(this, (a, b) => { return a.greaterThan(b); }));
        this.addCallableTag(List(["GtEq", "Nat", "Nat"]),
            GrimNat.wrapBinaryOpBool(this, (a, b) => { return a.greaterOrEqual(b); }));

        this.addCallableTag(List(["Pos", "Nat"]), (args: Array<GrimVal>) => {
            if (args.length !== 1 || !(args[0] instanceof GrimNat)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Pos.Nat");
                return new GrimError(["Pos.Nat requires exactly 1 Nat argument"]);
            }
            return args[0];
        });
        this.addCallableTag(List(["Neg", "Nat"]), (args: Array<GrimVal>) => {
            if (args.length !== 1 || !(args[0] instanceof GrimNat)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Neg.Nat");
                return new GrimError(["Neg.Nat requires exactly 1 Nat argument"]);
            }
            if (args[0] instanceof GrimNat) {
                return new GrimInt("-" + args[0].value);
            }
            return new GrimError(["Neg.Nat requires Nat argument"]);
        });

        this.addCallableTag(List(["Sub", "Nat", "Nat"]),
            GrimInt.wrapBinaryOp(this, (a, b) => { return a.sub(b); }));
        this.addCallableTag(List(["Mul", "Int", "Int"]),
            GrimInt.wrapBinaryOp(this, (a, b) => { return a.mul(b); }));
        this.addCallableTag(List(["Add", "Int", "Int"]),
            GrimInt.wrapBinaryOp(this, (a, b) => { return a.add(b); }));
        this.addCallableTag(List(["Sub", "Int", "Int"]),
            GrimInt.wrapBinaryOp(this, (a, b) => { return a.sub(b); }));
        this.addCallableTag(List(["Pow", "Int", "Int"]),
            GrimInt.wrapBinaryOp(this, (a, b) => { return a.pow(b); }));
        this.addCallableTag(List(["Mod", "Int", "Int"]),
            GrimInt.wrapBinaryOp(this, (a, b) => {
                let c = a.div(b, DivMode.FLOOR);
                let r = a.sub(c.mul(b));
                return r;
            }));
        this.addCallableTag(List(["Lt", "Int", "Int"]),
            GrimInt.wrapBinaryOpBool(this, (a, b) => { return a.lessThan(b); }));
        this.addCallableTag(List(["LtEq", "Int", "Int"]),
            GrimInt.wrapBinaryOpBool(this, (a, b) => { return a.lessOrEqual(b); }));
        this.addCallableTag(List(["Gt", "Int", "Int"]),
            GrimInt.wrapBinaryOpBool(this, (a, b) => { return a.greaterThan(b); }));
        this.addCallableTag(List(["GtEq", "Int", "Int"]),
            GrimInt.wrapBinaryOpBool(this, (a, b) => { return a.greaterOrEqual(b); }));

        this.addCallableTag(List(["Pos", "Int"]), (args: Array<GrimVal>) => {
            if (args.length !== 1 || !(args[0] instanceof GrimInt)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Pos.Int");
                return new GrimError(["Pos.Int requires exactly 1 Int argument"]);
            }
            return args[0];
        });
        this.addCallableTag(List(["Neg", "Int"]), (args: Array<GrimVal>) => {
            if (args.length !== 1 || !(args[0] instanceof GrimInt)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Neg.Int");
                return new GrimError(["Neg.Int requires exactly 1 Int argument"]);
            }
            if (args[0] instanceof GrimInt) {
                if (args[0].value.startsWith("-")) {
                    // already negative, just return it
                    return new GrimInt(args[0].value.substring(1)); // remove the leading '-'
                }
                else {
                    return new GrimInt(-args[0].value);
                }
            }
            return new GrimError(["Neg.Int requires Int argument"]);
        });

        this.addCallableTag(List(["Pos", "Dec"]), (args: Array<GrimVal>) => {
            if (args.length !== 1 || !(args[0] instanceof GrimDec)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Pos.Dec");
                return new GrimError(["Pos.Dec requires exactly 1 Dec argument"]);
            }
            return args[0];
        });
        this.addCallableTag(List(["Neg", "Dec"]), (args: Array<GrimVal>) => {
            if (args.length !== 1 || !(args[0] instanceof GrimDec)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Neg.Dec");
                return new GrimError(["Neg.Dec requires exactly 1 Dec argument"]);
            }
            if (args[0] instanceof GrimDec) {
                if (args[0].value.startsWith("-")) {
                    // already negative, just return it
                    return new GrimDec(args[0].value.substring(1)); // remove the leading '-'
                }
                else {
                    return new GrimDec(-args[0].value);
                }
            }
            return new GrimError(["Neg.Dec requires Dec argument"]);
        });

        this.addCallableTag(List(["Div", "Int", "Int"]),
            GrimRat.wrapBinaryOp(this, (a, b) => { return a.div(b); }));
        this.addCallableTag(List(["Div", "Nat", "Nat"]),
            GrimRat.wrapBinaryOp(this, (a, b) => { return a.div(b); }));
        this.addCallableTag(List(["Div", "Rat", "Rat"]),
            GrimRat.wrapBinaryOp(this, (a, b) => { return a.div(b); }));
        this.addCallableTag(List(["Mul", "Rat", "Rat"]),
            GrimRat.wrapBinaryOp(this, (a, b) => { return a.mul(b); }));
        this.addCallableTag(List(["Add", "Rat", "Rat"]),
            GrimRat.wrapBinaryOp(this, (a, b) => { return a.add(b); }));
        // not built-in to Rational in GMP
        // but int^rat does exist
        //this.addCallableTag(List(["Pow", "Rat", "Rat"]),
        //    GrimRat.wrapBinaryOp(this, (a, b) => { return a.pow(b); }));
        this.addCallableTag(List(["Lt", "Rat", "Rat"]),
            GrimRat.wrapBinaryOpBool(this, (a, b) => { return a.lessThan(b); }));
        this.addCallableTag(List(["LtEq", "Rat", "Rat"]),
            GrimRat.wrapBinaryOpBool(this, (a, b) => { return a.lessOrEqual(b); }));
        this.addCallableTag(List(["Gt", "Rat", "Rat"]),
            GrimRat.wrapBinaryOpBool(this, (a, b) => { return a.greaterThan(b); }));
        this.addCallableTag(List(["GtEq", "Rat", "Rat"]),
            GrimRat.wrapBinaryOpBool(this, (a, b) => { return a.greaterOrEqual(b); }));

        this.addCallableTag(List(["Add", "Dec", "Dec"]),
            GrimDec.wrapBinaryOp(this, (a, b) => { return a.add(b); }));
        this.addCallableTag(List(["Pow", "Dec", "Dec"]),
            GrimDec.wrapBinaryOp(this, (a, b) => { return a.pow(b); }));
        this.addCallableTag(List(["Sub", "Dec", "Dec"]),
            GrimDec.wrapBinaryOp(this, (a, b) => { return a.sub(b); }));
        this.addCallableTag(List(["Mul", "Dec", "Dec"]),
            GrimDec.wrapBinaryOp(this, (a, b) => { return a.mul(b); }));
        this.addCallableTag(List(["Div", "Dec", "Dec"]),
            GrimDec.wrapBinaryOp(this, (a, b) => { return a.div(b); }));

        this.addCallableTag(List(["Lt", "Dec", "Dec"]),
            GrimDec.wrapBinaryOpBool(this, (a, b) => { return a.lessThan(b); }));
        this.addCallableTag(List(["LtEq", "Dec", "Dec"]),
            GrimDec.wrapBinaryOpBool(this, (a, b) => { return a.lessOrEqual(b); }));
        this.addCallableTag(List(["Gt", "Dec", "Dec"]),
            GrimDec.wrapBinaryOpBool(this, (a, b) => { return a.greaterThan(b); }));
        this.addCallableTag(List(["GtEq", "Dec", "Dec"]),
            GrimDec.wrapBinaryOpBool(this, (a, b) => { return a.greaterOrEqual(b); }));

        this.addCallableTag(List(["Lt", "Str", "Str"]), (args: Array<GrimVal>) => {
            if (args.length !== 2 || !(args[0] instanceof GrimStr) || !(args[1] instanceof GrimStr)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Lt.Str");
                return new GrimError(["Lt.Str.Str requires exactly 2 Str arguments"]);
            }
            let cmp = args[0].value.localeCompare(args[1].value);
            return new GrimBool(cmp < 0);
        });
        this.addCallableTag(List(["LtEq", "Str", "Str"]), (args: Array<GrimVal>) => {
            if (args.length !== 2 || !(args[0] instanceof GrimStr) || !(args[1] instanceof GrimStr)) {
                console.warn("GrimTag.addCallableTag called with invalid args for LtEq.Str");
                return new GrimError(["LtEq.Str.Str requires exactly 2 Str arguments"]);
            }
            let cmp = args[0].value.localeCompare(args[1].value);
            return new GrimBool(cmp <= 0);
        });
        this.addCallableTag(List(["Gt", "Str", "Str"]), (args: Array<GrimVal>) => {
            if (args.length !== 2 || !(args[0] instanceof GrimStr) || !(args[1] instanceof GrimStr)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Gt.Str");
                return new GrimError(["Gt.Str.Str requires exactly 2 Str arguments"]);
            }
            let cmp = args[0].value.localeCompare(args[1].value);
            return new GrimBool(cmp > 0);
        });
        this.addCallableTag(List(["GtEq", "Str", "Str"]), (args: Array<GrimVal>) => {
            if (args.length !== 2 || !(args[0] instanceof GrimStr) || !(args[1] instanceof GrimStr)) {
                console.warn("GrimTag.addCallableTag called with invalid args for GtEq.Str");
                return new GrimError(["GtEq.Str.Str requires exactly 2 Str arguments"]);
            }
            let cmp = args[0].value.localeCompare(args[1].value);
            return new GrimBool(cmp >= 0);
        });

        // Equality checks
        this.addCallableTagEqNeqPair(List(["Eq", "Bool", "Bool"]), (args: Array<GrimVal>) => {
            if (args.length !== 2 || !(args[0] instanceof GrimBool) || !(args[1] instanceof GrimBool)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Eq.Bool");
                return new GrimError(["Eq.Bool requires exactly 2 Bool arguments"]);
            }
            if (args[0] instanceof GrimBool && args[1] instanceof GrimBool) {
                return new GrimBool(args[0].equals(args[1]));
            }
            return new GrimError(["Eq.Bool.Bool requires Bool arguments"]);
        });
        this.addCallableTagEqNeqPair(List(["Eq", "Nat", "Nat"]), (args: Array<GrimVal>) => {
            if (args.length !== 2 || !(args[0] instanceof GrimNat) || !(args[1] instanceof GrimNat)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Eq.Nat");
                return new GrimError(["Eq.Nat requires exactly 2 Nat arguments"]);
            }
            if (args[0] instanceof GrimNat && args[1] instanceof GrimNat) {
                return new GrimBool(args[0].equals(args[1]));
            }
            return new GrimError(["Eq.Nat.Nat requires Nat arguments"]);
        });
        this.addCallableTagEqNeqPair(List(["Eq", "Int", "Int"]), (args: Array<GrimVal>) => {
            if (args.length !== 2) {
                console.warn("GrimTag.addCallableTag called with invalid args for Eq.Int");
                return new GrimError(["Eq.Int requires exactly 2 arguments"]);
            }
            let args0 = args[0];
            let args1 = args[1];
            if (args0 instanceof GrimNat) {
                args0 = new GrimInt(args0.value); // Cast Nat to Int
            }
            if (args1 instanceof GrimNat) {
                args1 = new GrimInt(args1.value); // Cast Nat to Int
            }
            if (args0 instanceof GrimInt && args1 instanceof GrimInt) {
                return new GrimBool(args0.equals(args1));
            }
            return new GrimError(["Eq.Int.Int requires 2 Int arguments"]);
        });
        this.addCallableTagEqNeqPair(List(["Eq", "Rat", "Rat"]), (args: Array<GrimVal>) => {
            if (args.length !== 2) {
                console.warn("GrimTag.addCallableTag called with invalid args for Eq.Int");
                return new GrimError(["Eq.Int requires exactly 2 arguments"]);
            }
            let args0 = args[0];
            let args1 = args[1];
            if (args0 instanceof GrimNat || args0 instanceof GrimInt) {
                args0 = new GrimRat(new GrimInt(args0.value), new GrimInt(1)); // Cast Nat or Int to Rat
            }
            if (args1 instanceof GrimNat || args1 instanceof GrimInt) {
                args1 = new GrimRat(new GrimInt(args1.value), new GrimInt(1)); // Cast Nat or Int to Rat
            }
            if (args0 instanceof GrimRat && args1 instanceof GrimRat) {
                return new GrimBool(args0.equals(args1));
            }
            return new GrimError(["Eq.Rat.Rat requires 2 Rat arguments"]);
        });
        this.addCallableTagEqNeqPair(List(["Eq", "Dec", "Dec"]), (args: Array<GrimVal>) => {
            if (args.length !== 2) {
                console.warn("GrimTag.addCallableTag called with invalid args for Eq.Dec");
                return new GrimError(["Eq.Dec requires exactly 2 arguments"]);
            }
            let args0 = args[0];
            let args1 = args[1];
            if (args0 instanceof GrimNat || args0 instanceof GrimInt) {
                args0 = new GrimDec(args0.value); // Cast Nat or Int to Dec
            }
            else if (args0 instanceof GrimRat) {
                args0 = GrimDec.maker([args0], this); // Cast Rat to Dec
            }
            if (args1 instanceof GrimNat || args1 instanceof GrimInt) {
                args1 = new GrimDec(args1.value); // Cast Nat or Int to Dec
            }
            else if (args1 instanceof GrimRat) {
                args1 = GrimDec.maker([args1], this); // Cast Rat to Dec
            }
            if (args0 instanceof GrimDec && args1 instanceof GrimDec) {
                return new GrimBool(args0.equals(args1));
            }
            return new GrimError(["Eq.Dec.Dec requires 2 Dec arguments"]);
        });
        this.addCallableTagEqNeqPair(List(["Eq", "Str", "Str"]), (args: Array<GrimVal>) => {
            if (args.length !== 2 || !(args[0] instanceof GrimStr) || !(args[1] instanceof GrimStr)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Eq.Str");
                return new GrimError(["Eq.Str requires exactly 2 Str arguments"]);
            }
            if (args[0] instanceof GrimStr && args[1] instanceof GrimStr) {
                return new GrimBool(args[0].equals(args[1]));
            }
            return new GrimError(["Eq.Str.Str requires Str arguments"]);
        });
        this.addCallableTagEqNeqPair(List(["Eq", "Option", "Option"]), (args: Array<GrimVal>) => {
            if (args.length !== 2 || !(args[0] instanceof GrimOpt) || !(args[1] instanceof GrimOpt)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Eq.Opt");
                return new GrimError(["Eq.Opt requires exactly 2 Opt arguments"]);
            }
            if (args[0] instanceof GrimOpt && args[1] instanceof GrimOpt) {
                if (args[0].isNone() && args[1].isNone()) {
                    return new GrimBool(true); // Both are None
                } else if (args[0].value != null && args[1].value != null) {
                    return new GrimBool(args[0].value.equals(args[1].value));
                }
                return new GrimBool(false); // One is Some, the other is None
            }
            return new GrimError(["Eq.Opt.Opt requires Opt arguments"]);
        });
        this.addCallableTagEqNeqPair(List(["Eq", "Tag", "Tag"]), (args: Array<GrimVal>) => {
            if (args.length !== 2 || !(args[0] instanceof GrimTag) || !(args[1] instanceof GrimTag)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Eq.Tag");
                return new GrimError(["Eq.Tag requires exactly 2 Tag arguments"]);
            }
            if (args[0] instanceof GrimTag && args[1] instanceof GrimTag) {
                return new GrimBool(args[0].equals(args[1]));
            }
            return new GrimError(["Eq.Tag.Tag requires Tag arguments"]);
        });
        this.addCallableTagEqNeqPair(List(["Eq", "Var", "Var"]), (args: Array<GrimVal>) => {
            if (args.length !== 2 || !(args[0] instanceof GrimVar) || !(args[1] instanceof GrimVar)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Eq.Var");
                return new GrimError(["Eq.Var requires exactly 2 Var arguments"]);
            }
            if (args[0] instanceof GrimVar && args[1] instanceof GrimVar) {
                return new GrimBool(args[0].equals(args[1]));
            }
            return new GrimError(["Eq.Var.Var requires Var arguments"]);
        });
        this.addCallableTagEqNeqPair(List(["Eq", "Sym", "Sym"]), (args: Array<GrimVal>) => {
            if (args.length !== 2 || !(args[0] instanceof GrimSym) || !(args[1] instanceof GrimSym)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Eq.Sym");
                return new GrimError(["Eq.Sym requires exactly 2 Sym arguments"]);
            }
            if (args[0] instanceof GrimSym && args[1] instanceof GrimSym) {
                return new GrimBool(args[0].equals(args[1]));
            }
            return new GrimError(["Eq.Sym.Sym requires Sym arguments"]);
        });
        this.addCallableTagEqNeqPair(List(["Eq", "List", "List"]), (args: Array<GrimVal>) => {
            if (args.length !== 2 || !(args[0] instanceof GrimList) || !(args[1] instanceof GrimList)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Eq.List");
                return new GrimError(["Eq.List requires exactly 2 List arguments"]);
            }
            if (args[0] instanceof GrimList && args[1] instanceof GrimList) {
                return new GrimBool(args[0].equals(args[1]));
            }
            return new GrimError(["Eq.List.List requires List arguments"]);
        });
        this.addCallableTagEqNeqPair(List(["Eq", "Map", "Map"]), (args: Array<GrimVal>) => {
            if (args.length !== 2 || !(args[0] instanceof GrimMap) || !(args[1] instanceof GrimMap)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Eq.Map");
                return new GrimError(["Eq.Map requires exactly 2 Map arguments"]);
            }
            if (args[0] instanceof GrimMap && args[1] instanceof GrimMap) {
                return new GrimBool(args[0].equals(args[1]));
            }
            return new GrimError(["Eq.Map.Map requires Map arguments"]);
        });
        this.addCallableTagEqNeqPair(List(["Eq", "Set", "Set"]), (args: Array<GrimVal>) => {
            if (args.length !== 2 || !(args[0] instanceof GrimSet) || !(args[1] instanceof GrimSet)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Eq.Set");
                return new GrimError(["Eq.Set requires exactly 2 Set arguments"]);
            }
            if (args[0] instanceof GrimSet && args[1] instanceof GrimSet) {
                return new GrimBool(args[0].equals(args[1]));
            }
            return new GrimError(["Eq.Set.Set requires Set arguments"]);
        });
        this.addCallableTagEqNeqPair(List(["Eq", "Tuple", "Tuple"]), (args: Array<GrimVal>) => {
            if (args.length !== 2 || !(args[0] instanceof GrimTuple) || !(args[1] instanceof GrimTuple)) {
                console.warn("GrimTag.addCallableTag called with invalid args for Eq.Tuple");
                return new GrimError(["Eq.Tuple requires exactly 2 Tuple arguments"]);
            }
            if (args[0] instanceof GrimTuple && args[1] instanceof GrimTuple) {
                return new GrimBool(args[0].equals(args[1]));
            }
            return new GrimError(["Eq.Tuple.Tuple requires Tuple arguments"]);
        });
    }
}

export { GrimModule, FuncType };
