import { GrimVal, AstJson } from "./GrimVal";
import { Set } from 'immutable';
import { CanApp, CanTaggedApp, CanAst } from "../parser/CanAst.js";
import { GrimList } from "./GrimCollect";
import { GrimModule } from "./GrimModule.js";
import { GrimError } from "./GrimOpt.js";
import { GrimSym, GrimTag } from "./GrimAst.js";

class GrimApp extends GrimVal {
    // Represents an application of a function to arguments
    // "App" node has a single left-hand side (lhs) and a list of right-hand side items (rhs)
    // e.g. lhs(rhs...) or if rhs is x, y then it is App(lhs: f, rhs: [x, y])
    // e.g. f(x, y) --> App(f, x, y) --> App(lhs: f, rhs: [x, y])
    // you get the idea
    lhs: GrimVal;
    rhs: Array<GrimVal>;

    head(): string { return 'App'; }

    isAtom(): boolean {
        return false; // GrimApp is not an atom
    }

    constructor(lhs: GrimVal, rhs: Array<GrimVal>) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
    }

    // TODO toString() should never print because that would be unevaluated?
    toString(): string {
        let rhsStr = this.rhs.map(r => r.toString()).join(", ");
        return `${this.lhs.toString()}@(${rhsStr})`;
        // TODO remove @ from above, but useful to keep for now, for debugging
    }

    toCanonicalString(): string {
        if (this.lhs instanceof GrimTag) {
            return `${this.lhs.value}(${this.rhs.map(r => r.toCanonicalString()).join(", ")})`;
        }
        let rhsStr = this.rhs.map(r => r.toCanonicalString()).join(", ");
        return `App(${this.lhs.toCanonicalString()}, ${rhsStr})`;
    }

    // static wrap(one: AstJson | string, module: GrimModule): GrimVal {
    //     return typeof one === 'string' ? new GrimStr(one) : module.fromAst(one);
    // }

    exprMap(fn: (node: GrimVal) => GrimVal): GrimVal {
        const newLhs = this.lhs.exprMap(fn);
        const newRhs = this.rhs.map(arg => arg.exprMap(fn));
        return new GrimApp(newLhs, newRhs);
    }

    static maker(ast: CanAst | Array<GrimVal>, module: GrimModule): GrimVal {
        if (Array.isArray(ast)) {
            if (ast.length !== 2) {
                console.warn("GrimApp.maker called with wrong number of args, expected 2, returning empty GrimVal");
                return new GrimVal();
            }
            const lhs = ast[0];
            if (!(ast[1] instanceof GrimList)) {
                console.warn("GrimApp.maker called with first arg not a GrimVal, returning empty GrimVal");
                return new GrimVal();
            }
            const rhs: Array<GrimVal> = ast[1].asArray();
            return new GrimApp(lhs, rhs);
        }
        if (ast instanceof CanApp) {
            const lhs = module.fromAst(ast.fun);
            const rhs: Array<GrimVal> = ast.args.map(arg => module.fromAst(arg));
            return new GrimApp(lhs, rhs);
        }
        if (ast instanceof CanTaggedApp && ast.tag.tag === "App") {
            if (ast.args.length === 0) {
                console.warn("GrimApp.maker called with no args, returning empty GrimVal");
                return new GrimVal();
            }
            const lhs = module.fromAst(ast.args[0]);
            const rhs = ast.args.slice(1).map(arg => module.fromAst(arg));
            return new GrimApp(lhs, rhs);
        }
        console.warn(`GrimApp.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimVal();
    }
}

class GrimFun extends GrimVal {
    funcName: string = 'Boring'; // for runtime-inspection purposes, not used in evaluation

    args: Array<GrimVal>;
    body: GrimVal;
    isAtom(): boolean {
        return true; // GrimFun is an atom in the sense that it is evaluates to itself
    }
    constructor(args: Array<GrimVal>, body: GrimVal, funcName: string) {
        super();
        this.args = args;
        this.body = body;
        if (funcName === undefined || funcName === null || funcName === '') {
            let hash1 = new GrimList(args).hashCode();
            let hash2 = body.hashCode();
            let hash = (hash1 + hash2).toString(16); // convert to hex string
            // use the hash as the function name if not provided
            // this is useful for debugging and runtime inspection
            // but not used in evaluation
            this.funcName = 'fun_'+hash.substring(6); // default name if not provided
        } else {
            this.funcName = funcName;
        }
        //console.error(`GrimFun created with funcName: ${this.funcName}`);
    }
    
    toString(): string {
        let argsStr = this.args.map(arg => arg.toString()).join(", ");
        // TODO ultimately this should not be printable because of lexical scoping
        // but for now, it is useful to see the function definition
        return `Fun(List(${argsStr}), ${this.body.toString()})`;
    }

    toCanonicalString(): string {
        let argsStr = this.args.map(arg => arg.toCanonicalString()).join(", ");
        return `Fun(List(${argsStr}), ${this.body.toCanonicalString()})`;
    }

    exprMap(fn: (node: GrimVal) => GrimVal): GrimVal {
        const newArgs = this.args.map(arg => arg.exprMap(fn));
        const newBody = this.body.exprMap(fn);
        return new GrimFun(newArgs, newBody, this.funcName + "ExprMapped");
    }

    static maker(ast: CanAst | Array<GrimVal>, module: GrimModule): GrimVal {
        // this means you can build functions at runtime with Fun acting as a first-class callable thing
        if (Array.isArray(ast)) {
            if (ast.length !== 2) {
                console.warn("GrimFun.maker called with wrong number of args, expected 2, returning empty GrimVal");
                return new GrimError(["GrimFun.maker called with wrong number of args, expected 2"]);
            }
            const args = ast[0];
            const body = ast[1];
            if (!(args instanceof GrimList)) {
                console.warn("GrimFun.maker called with first arg not a GrimList, returning empty GrimVal");
                return new GrimError(["GrimFun.maker called with first arg not a GrimList"]);
            }
            return new GrimFun(args.asArray(), body, "");
        }
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Fun") {
            if (ast.args.length !== 2) {
                console.warn("GrimFun.maker called with insufficient args, returning empty GrimVal");
                return new GrimVal();
            }
            const argsAst = module.fromAst(ast.args[0]);
            const body = module.fromAst(ast.args[1]);
            if (argsAst instanceof GrimList) {
                let arr = argsAst.asArray();
                let set = Set<string>();
                for (let arg of arr) {
                    if (arg instanceof GrimSym) {
                        if (set.has(arg.value)) {
                            throw new Error(`Duplicate argument name '${arg.value}' in ast: ${ast.toString()}`);
                        }
                        set = set.add(arg.value);
                    } else {
                        console.warn("GrimFun.maker called with arg not a GrimSym, returning empty GrimVal");
                        return new GrimError([ `GrimFun.maker called with arg not a GrimSym: ${arg.toString()}`]);
                    }
                }
                return new GrimFun(arr, body, "");
            } else {
                console.warn("GrimFun.maker called with first arg not a GrimList, returning empty GrimVal");
                return new GrimVal();
            }
        }
        console.warn(`GrimFun.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimVal();
    }
}

class GrimLet extends GrimVal {
    readonly bindings: Array<GrimVal>; // TODO make this a GrimMap or Immutable.Map
    readonly body: GrimVal;

    constructor(args: Array<GrimVal>, body: GrimVal) {
        super();
        this.bindings = args;
        this.body = body;
    }

    isAtom(): boolean {
        return false; // GrimLet is not an atom
    }

    toString(): string {
        let argsStr = this.bindings.map(arg => arg.toString()).join(", ");
        return `Let(List(${argsStr}), ${this.body.toString()})`;
    }

    toCanonicalString(): string {
        let argsStr = this.bindings.map(arg => arg.toCanonicalString()).join(", ");
        return `Let(List(${argsStr}), ${this.body.toCanonicalString()})`;
    }

    exprMap(fn: (node: GrimVal) => GrimVal): GrimVal {
        const newBindings = this.bindings.map(binding => binding.exprMap(fn));
        const newBody = this.body.exprMap(fn);
        return new GrimLet(newBindings, newBody);
    }

    static maker(ast: CanAst | Array<GrimVal>, module: GrimModule): GrimVal {
        if (Array.isArray(ast)) {
            if (ast.length !== 2) {
                console.warn("GrimLet.maker called with wrong number of args, expected 2, returning empty GrimVal");
                return new GrimVal();
            }
            const bindings = ast[0];
            const body = ast[1];
            if (!(bindings instanceof GrimList)) {
                console.warn("GrimLet.maker called with first arg not a GrimList, returning empty GrimVal");
                return new GrimVal();
            }
            return new GrimLet(bindings.asArray(), body);
        }
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Let") {
            if (ast.args.length !== 2) {
                console.warn("GrimLet.maker called with insufficient args, returning empty GrimVal");
                return new GrimVal();
            }
            const bindingsAst = module.fromAst(ast.args[0]);
            // TODO check that there are no duplicate names in bindingsAst
            const body = module.fromAst(ast.args[1]);

            if (bindingsAst instanceof GrimList) {
                return new GrimLet(bindingsAst.asArray(), body);
            } else {
                console.warn("GrimLet.maker called with first arg not a GrimList, returning empty GrimVal");
                return new GrimVal();
            }
        }
        console.warn(`GrimLet.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimVal();
    }
}

export { GrimApp, GrimFun, GrimLet };
