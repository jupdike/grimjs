import { List, Map, PairSorting, Set } from "immutable";
import type { GMPLib } from "gmp-wasm";
import { GrimParser } from "../parser/GrimParser.js";

import * as parserCanon from '../parser/_parser-canon.js';

import { GrimVal } from "./GrimVal.js";
import { GrimBool } from "./GrimBool.js";
import { GrimApp, GrimFun, GrimLet } from "./GrimFun.js";
import { GrimTag, GrimVar, GrimSym } from "./GrimAst.js";
import { GrimNat, GrimDec, GrimInt, GrimRat } from "./GrimNum.js";
import { GrimStr } from "./GrimStr.js";
import { GrimError, GrimOpt } from "./GrimOpt.js";
import { GrimList, GrimTuple, GrimMap, GrimSet } from "./GrimCollect.js";
import { Location, CanApp, CanAst, CanStr, CanTag, CanTaggedApp } from "../parser/CanAst.js";
import { Eval, EvalState } from "./Eval.js";

type AstToVal = (ast: CanAst | Array<GrimVal>, builder: Builder) => GrimVal;
type FuncType = (args: Array<GrimVal>) => GrimVal;

interface TestEntry {
    sugar: string;
    desugared: string;
    built: string;
    canonical: string;
    evaluated: string;
}

interface TestSuite {
    section: string;
    entries: Array<TestEntry>;
}

// a builder is really a module, TODO rename it to Module or something
class Builder {
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

    static groupDefinitions(lines: Array<string>): Array<string> {
        // Group the lines into a list of definitions based on balanced delimiters and simple leading whitespace
        //
        // Should follow most programmer's intuition about how a chunk of code is indented by most text editors
        // and how it is grouped by balanced delimiters, e.g. (), [], {}, etc.
        // This allows users to write a lot of blocks of code without needing to use semicolons, or
        // forcing programmers to use double newlines to separate definitions.
        //
        // Group lines based on these intuitive rules:
        // 1. New definitions start on a new line with no leading whitespace
        // 2. Definitions can be continued on the next line with leading whitespace
        // 3. If a line has no leading whitespace, it completes the definition, if it has balanced delimiters
        // 4. Definitions must be balanced by delimiters by the time they end
        // 5. Comments starting with // are ignored, and empty lines (or lines with only whitespace) are ignored
        // 6. Lines with tabs are not allowed, as they are not consistent across editors
        let ret: Array<string> = [];
        let delimiterStack: Array<number> = [];
        let oneDefinition: Array<string> = [];
        lines.forEach((line) => {
            if (line.startsWith("#") || line.startsWith("//") || line.length < 1) {
                // Skip #xyz pre-parse commands, and comments
                return;
            }
            if (line.indexOf("\t") >= 0) {
                throw new Error("Tab characters are not allowed in Grim. Deal with it.");
            }
            line = line.trimEnd();
            let startedOutBalanced = delimiterStack.length === 0;
            let leadingWhitespaceCount = (line.match(/^\s*/)?.[0] || "").length;
            //console.log(`Processing line: '${line}' with leading whitespace count: ${leadingWhitespaceCount} and ended with delimiter stack: [${delimiterStack.join(", ")}]`);
            // Check for opening and closing delimiters
            for (var i = 0; i < line.length; i++) {
                var char = line[i];
                // track where opening delimiters are found
                if (char === "(" || char === "{" || char === "[") {
                    delimiterStack.push(leadingWhitespaceCount);
                } else if (char === ")" || char === "}" || char === "]") {
                    if (delimiterStack.length === 0) {
                        throw new Error(`Unmatched closing delimiter: ${char}`);
                    }
                    delimiterStack.pop();
                }
            }
            // If we have balanced delimiters, and no leading whitespace, add the line to the list
            if (startedOutBalanced && delimiterStack.length === 0 && leadingWhitespaceCount === 0) {
                //console.error(`Self-contained definition found: '${line}'`);
                // make sure not to nix accumulated lines
                if (oneDefinition.length > 0) {
                    ret.push(oneDefinition.join("\n"));
                    oneDefinition = []; // Reset for the next definition
                }
                ret.push(line); // Add the line as a complete definition
            }
            else if (delimiterStack.length > 0 && leadingWhitespaceCount > 0) {
                //console.error(`Continuing definition with leading whitespace: '${line}'`);
                // If we are still inside a definition, accumulate the line
                oneDefinition.push(line);
                //console.error(`Accumulated definition: '${oneDefinition.join("\n")}'`);
            }
            else if (delimiterStack.length === 0) {
                //console.error(`Got to the end of a definition: '${line}', oneDefinition.length: ${oneDefinition.length}`);
                if (oneDefinition.length > 0) {
                    oneDefinition.push(line);
                    ret.push(oneDefinition.join("\n"));
                    oneDefinition = []; // Reset for the next definition
                } else {
                    //console.error(`Extra unexpected ending delimiters: '${line}'`);
                }
            }
            else {
                //console.error(`Unmatched delimiters or unexpected leading whitespace in line: '${line}'`);
                // Otherwise, continue building the current definition
                oneDefinition.push(line);
            }
        });
        if (oneDefinition.length > 0) {
            // If there's any remaining definition, add it
            ret.push(oneDefinition.join("\n"));
        }
        return ret;
    }

    static parseTestLines(yaml: string): Array<TestSuite> {
        // Parse the YAML string into a JavaScript object
        // Real YAML messes with my quotation marks, so we use a custom parser that preserves explicit quotes
        let ret: Array<TestSuite> = [];
        let currentSuite: TestSuite = { section: "", entries: [] };
        let currentEntry: TestEntry = {
            sugar: "",
            desugared: "",
            built: "",
            canonical: "",
            evaluated: "",
        };
        yaml.split("\n").forEach((line) => {
            line = line.trim();
            if (line.length === 0) {
                // Skip empty lines
                return;
            }
            if (line.startsWith("#")) {
                let section = line.substring(1).trim(); // Remove comment marker
                if (section !== "") {
                    if (currentSuite.entries.length > 0) {
                        ret.push(currentSuite); // Save the previous suite (but not an empty one)
                    }
                    currentSuite = { section: section, entries: [] }; // Start a new suite
                } else {
                    if (currentEntry.sugar !== "") {
                        currentSuite.entries.push(currentEntry); // Save the current entry
                    }
                    // start over for blank comments
                    currentEntry = {
                        sugar: "",
                        desugared: "",
                        built: "",
                        canonical: "",
                        evaluated: "",
                    };
                }
                return;
            } else {
                if (line.indexOf(":") > 0) {
                    // This is a key-value pair
                    let parts = line.split(":");
                    let key = parts[0].trim();
                    let value = parts.slice(1).join(":").trim();
                    currentEntry[key as keyof TestEntry] = value;
                }
            }
        });
        ret.push(currentSuite);
        console.log(`Parsed ${ret.length} test suites from YAML`);
        return ret;
    }
    runTests(testSuites: Array<TestSuite>) {
        console.error(`Found ${this.castPairs.size} cast pairs`);
        let n = 0;
        if (!testSuites || testSuites.length === 0) {
            console.warn("No test suites provided to Builder.runTests");
            return;
        }
        for (const suite of testSuites) {
            console.log(`# ${suite.section}`);
            suite.entries.forEach((entry: TestEntry) => {
                this.testOneEntry(entry);
                n++;
            });
        }
        console.log(`All ${n} tests completed.`);
    }

    static fromDefinitions(parser: GrimParser, gmpLib: GMPLib, definitions: Array<string>) {
        let builder = new Builder(parser, gmpLib);
        console.error(`Building a module with ${definitions.length} definitions...`);
        for (const def of definitions) {
            builder.addOneDefinition(def);
        }
        return builder;
    }

    moduleEnv: Map<string, GrimVal> = Map<string, GrimVal>(); // Environment for variable bindings

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
        console.error(`No. Casts: ${this.castPairs.size} -- moduleEnv size: ${this.moduleEnv.size} -- Defs: ${keySummary.join(", ")}`);
        console.log("#");
    }

    testParseDefs(definitions: Array<string>) {
        console.log(`Testing ${definitions.length} definitions...`);
        for (const def of definitions) {
            this.analyzeOne(def, false, "Definition"); // Analyze each definition
        }
        console.log(`${definitions.length} definitions parsed successfully.`);
    }

    private parser: GrimParser;
    readonly gmpLib: GMPLib; // Will be set after gmp.init(), by async caller
    private makerMap: Map<string, AstToVal> = Map<string, AstToVal>();
    private didInit = false;

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
                // this is not a problem, because we can use the tag to find a maker and restructure the AST
                //console.warn(`Builder.fromAst: No maker found for tag '${tagName}'`);
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
            var ret = this.parser.parse(str, {startRule: start});
            // if (!onlyErrors) {
            //     console.log('---');
            //     console.log(str, '\n  ~~ parses as ~~>\n', ret.toString() );
            // }
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

    analyzeOne(str: string, onlyErrors = false, startRule: string | null = null) {
        let ast: CanAst = this.check(str, startRule, onlyErrors);
        //console.log('Parsed AST JSON    :', JSON.stringify(ast, null, 2));
        //console.log('Parsed AST toString:', ast.toString());
        let val = this.fromAst(ast);
        //console.log('GrimVal from AST   :', val.toString());
        let canon = val.toCanonicalString();
        //console.log('Canonical string   :', canon);
        if (!onlyErrors) {
            console.log(canon);
        }
        //let state = new EvalState(val, Map(), this);
        // let result: GrimVal | null = null;
        // try {
        //     result = Eval.evaluate(state).expr;
        // } catch (e) {
        //     console.error('Eval error          :', e);
        // }
        // if (result) {
        //     console.log('Eval result        :', result.toString());
    }

    private sugarToAst(sugar: string, options: { startRule: string }): CanAst | null {
        try {
            var ret = this.parser.parse(sugar, options);
            return ret;
        } catch (e) {
            console.error('Error parsing sugar:', e);
            return null;
        }
    }

    private evaluatedModuleEnv(): Map<string, GrimVal> {
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

    private evalOne(val: GrimVal): string {
        let state = new EvalState(val, this.evaluatedModuleEnv(), this);
        let result: GrimVal | null = null;
        try {
            result = Eval.evaluate(state).expr;
        } catch (e) {
            console.error('Eval error:', e);
            return `Error('${e.message}')`;
        }
        if (result) {
            return result.toString();
        }
        return "<ERROR_SO_NO_RESULT>";
    }

    private parseCanon(input: string): CanAst | null {
        try {
            return parserCanon.parse(input, { startRule: "Start" });
        } catch (e) {
            console.error('Error parsing canonical:', e);
            return null;
        }
    }

    readonly reportMismatches: boolean = true; // Set to true to report mismatches in test output
    private testOneEntry(entry: TestEntry) {
        if (!entry.sugar) {
            console.warn("Test entry has no sugar:", entry);
            return;
        }
        console.log(`sugar:       ${entry.sugar}`);
        let ast: CanAst | null = this.sugarToAst(entry.sugar, { startRule: "Expression" });
        if (!ast) {
            console.error("Failed to parse sugar:", entry.sugar);
            return;
        }
        let oneAstStr = ast.toString();
        console.log(`desugared:   ${oneAstStr}`);
        if (this.reportMismatches && oneAstStr !== entry.desugared) {
            console.error(`Desugared AST does not match expected: ${oneAstStr} !== ${entry.desugared}`);
        }
        let built: GrimVal = this.fromAst(ast);
        console.log(`built:       ${built.toString()}`);
        if (this.reportMismatches && built.toString() !== entry.built) {
            console.error(`Built GrimVal does not match expected: ${built.toString()} !== ${entry.built}`);
        }
        let canonical: string = built.toCanonicalString();
        console.log(`canonical:   ${canonical}`);
        if (this.reportMismatches) {
            // parse using ParserCanon and compare that too
            let parsedCanon: CanAst | null = this.parseCanon(canonical);
            if (!parsedCanon) {
                console.error("Failed to parse canonical string:", canonical);
                return;
            }
            // Check if the parsed canonical string matches the expected canonical string
            let canonStr = parsedCanon.toString();
            //console.log(`parsedCanon: ${canonStr}`);
            if (canonStr !== entry.canonical) {
                console.error(`Parsed canonical string does not match expected: ${canonStr} !== ${entry.canonical}`);
            }
        }
        if (this.reportMismatches && canonical !== entry.canonical) {
            console.error(`Canonical string does not match expected: ${canonical} !== ${entry.canonical}`);
        }
        let evaluated: string = this.evalOne(built);
        console.log(`evaluated:   ${evaluated}`);
        if (this.reportMismatches && evaluated !== entry.evaluated) {
            console.error(`Evaluated result does not match expected: ${evaluated} !== ${entry.evaluated}`);
        }
        console.log("#");
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

        this.addCallableTag(List(["Mul", "Nat", "Nat"]),
            GrimNat.wrapBinaryOp(this, (a, b) => { return a.mul(b); }));
        this.addCallableTag(List(["Add", "Nat", "Nat"]),
            GrimNat.wrapBinaryOp(this, (a, b) => { return a.add(b); }));

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

        this.addCallableTag(List(["Div", "Int", "Int"]),
            GrimRat.wrapBinaryOp(this, (a, b) => { return a.div(b); }));
        this.addCallableTag(List(["Div", "Nat", "Nat"]),
            GrimRat.wrapBinaryOp(this, (a, b) => { return a.div(b); }));
        this.addCallableTag(List(["Div", "Rat", "Rat"]),
            GrimRat.wrapBinaryOp(this, (a, b) => { return a.div(b); }));
        this.addCallableTag(List(["Mul", "Rat", "Rat"]),
            GrimRat.wrapBinaryOp(this, (a, b) => {
                return a.mul(b);
            }));

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
    }
}

export { Builder, FuncType };
export type { TestEntry, TestSuite };
