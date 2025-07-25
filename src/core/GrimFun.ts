import { GrimVal, AstJson } from "./GrimVal";
import { CanApp, CanTaggedApp, CanAst } from "../parser/CanAst.js";
import { GrimList } from "./GrimCollect";
import { Builder } from "./Builder.js";
import { GrimError } from "./GrimOpt.js";

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
        let rhsStr = this.rhs.map(r => r.toCanonicalString()).join(", ");
        return `App(${this.lhs.toCanonicalString()}, List(${rhsStr}))`;
    }

    // static wrap(one: AstJson | string, builder: Builder): GrimVal {
    //     return typeof one === 'string' ? new GrimStr(one) : builder.fromAst(one);
    // }

    static maker(ast: CanAst | Array<GrimVal>, builder: Builder): GrimVal {
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
            const lhs = builder.fromAst(ast.fun);
            const rhs: Array<GrimVal> = ast.args.map(arg => builder.fromAst(arg));
            return new GrimApp(lhs, rhs);
        }
        if (ast instanceof CanTaggedApp && ast.tag.tag === "App") {
            if (ast.args.length === 0) {
                console.warn("GrimApp.maker called with no args, returning empty GrimVal");
                return new GrimVal();
            }
            const lhs = builder.fromAst(ast.args[0]);
            const rhs = ast.args.slice(1).map(arg => builder.fromAst(arg));
            return new GrimApp(lhs, rhs);
        }
        console.warn(`GrimApp.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimVal();
    }
}

class GrimFun extends GrimVal {
    args: Array<GrimVal>;
    body: GrimVal;
    isAtom(): boolean {
        return true; // GrimFun is an atom in the sense that it is evaluates to itself
    }
    constructor(args: Array<GrimVal>, body: GrimVal) {
        super();
        this.args = args;
        this.body = body;
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

    static maker(ast: CanAst | Array<GrimVal>, builder: Builder): GrimVal {
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
            return new GrimFun(args.asArray(), body);
        }
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Fun") {
            if (ast.args.length !== 2) {
                console.warn("GrimFun.maker called with insufficient args, returning empty GrimVal");
                return new GrimVal();
            }
            const argsAst = builder.fromAst(ast.args[0]);
            const body = builder.fromAst(ast.args[1]);

            if (argsAst instanceof GrimList) {
                return new GrimFun(argsAst.asArray(), body);
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

    static maker(ast: CanAst | Array<GrimVal>, builder: Builder): GrimVal {
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
            const bindingsAst = builder.fromAst(ast.args[0]);
            const body = builder.fromAst(ast.args[1]);

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
