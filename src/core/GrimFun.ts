import { GrimStr } from "./GrimStr";
import { GrimVal, AstJson } from "./GrimVal";
import { CanApp, CanTaggedApp, CanAst } from "../parser/CanAst.js";
import { GrimList } from "./GrimCollect";

class GrimApp extends GrimVal {
    // Represents an application of a function to arguments
    // "App" node has a single left-hand side (lhs) and a list of right-hand side items (rhs)
    // e.g. lhs(rhs...) or if rhs is x, y then it is App(lhs: f, rhs: [x, y])
    // e.g. f(x, y) --> App(f, x, y) --> App(lhs: f, rhs: [x, y])
    // you get the idea
    private lhs: GrimVal;
    private rhs: Array<GrimVal>;

    head(): string { return 'App'; }

    static isAtom(): boolean {
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

    static wrap(one: AstJson | string): GrimVal {
        return typeof one === 'string' ? new GrimStr(one) : GrimVal.fromAst(one);
    }

    static maker(children: Array<AstJson | string>): GrimVal {
        if (children.length === 0) {
            console.warn("GrimApp.maker called with no children, returning empty GrimVal");
            return new GrimVal();
        }
        return new GrimApp(
            GrimApp.wrap(children[0]),
            children.slice(1).map(GrimApp.wrap)
        );
    }

    static canAstMaker(ast: CanAst): GrimVal {
        if (ast instanceof CanApp) {
            const lhs = GrimVal.fromCanAst(ast.fun);
            const rhs = ast.args.map(arg => GrimVal.fromCanAst(arg));
            return new GrimApp(lhs, rhs);
        }
        if (ast instanceof CanTaggedApp && ast.tag.tag === "App") {
            if (ast.args.length === 0) {
                console.warn("GrimApp.canAstMaker called with no args, returning empty GrimVal");
                return new GrimVal();
            }
            const lhs = GrimVal.fromCanAst(ast.args[0]);
            const rhs = ast.args.slice(1).map(arg => GrimVal.fromCanAst(arg));
            return new GrimApp(lhs, rhs);
        }
        console.warn(`GrimApp.canAstMaker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimVal();
    }
}

class GrimFun extends GrimVal {
    private args: Array<GrimVal>;
    private body: GrimVal;
    static isAtom(): boolean {
        return false; // GrimFun is not an atom
    }
    constructor(args: Array<GrimVal>, body: GrimVal) {
        super();
        this.args = args;
        this.body = body;
    }
    toString(): string {
        let argsStr = this.args.map(arg => arg.toString()).join(", ");
        return `Fun(List(${argsStr}), ${this.body.toString()})`;
    }

    static maker(children: Array<AstJson | string>): GrimVal {
        if (children.length != 2) {
            console.warn("GrimFun.maker called with insufficient children, returning empty GrimVal");
            return new GrimVal();
        }
        let argBody = children.map(GrimApp.wrap);
        if (argBody.length != 2) {
            console.warn("GrimFun.maker called with insufficient children, returning empty GrimVal");
            return new GrimVal();
        }
        if (typeof argBody[0] != typeof GrimList.Empty) {
            console.warn("GrimFun.maker called with first child not a GrimList, returning empty GrimVal");
            return new GrimVal();
        }
        let args = argBody[0] as GrimList;
        let body = argBody[1];
        return new GrimFun(args.asArray(), body);
    }

    static canAstMaker(ast: CanAst): GrimVal {
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Fun") {
            if (ast.args.length !== 2) {
                console.warn("GrimFun.canAstMaker called with insufficient args, returning empty GrimVal");
                return new GrimVal();
            }
            const argsAst = GrimVal.fromCanAst(ast.args[0]);
            const body = GrimVal.fromCanAst(ast.args[1]);
            
            if (argsAst instanceof GrimList) {
                return new GrimFun(argsAst.asArray(), body);
            } else {
                console.warn("GrimFun.canAstMaker called with first arg not a GrimList, returning empty GrimVal");
                return new GrimVal();
            }
        }
        console.warn(`GrimFun.canAstMaker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimVal();
    }
}

class GrimLet extends GrimVal {
    private bindings: Array<GrimVal>; // TODO make this a GrimMap or Immutable.Map
    private body: GrimVal;
    static isAtom(): boolean {
        return false; // GrimLet is not an atom
    }
    constructor(args: Array<GrimVal>, body: GrimVal) {
        super();
        this.bindings = args;
        this.body = body;
    }
    toString(): string {
        let argsStr = this.bindings.map(arg => arg.toString()).join(", ");
        return `Let(List(${argsStr}), ${this.body.toString()})`;
    }

    static maker(children: Array<AstJson | string>): GrimVal {
        if (children.length != 2) {
            console.warn("GrimLet.maker called with insufficient children, returning empty GrimVal");
            return new GrimVal();
        }
        let argBody = children.map(GrimApp.wrap);
        if (argBody.length != 2) {
            console.warn("GrimLet.maker called with insufficient children, returning empty GrimVal");
            return new GrimVal();
        }
        if (typeof argBody[0] != typeof GrimList.Empty) {
            console.warn("GrimLet.maker called with first child not a GrimList, returning empty GrimVal");
            return new GrimVal();
        }
        let bindings = argBody[0] as GrimList;
        // TODO check that bindings are all Def(Var(name), value) pairs and pull those apart

        let body = argBody[1];
        return new GrimLet(bindings.asArray(), body);
    }

    static canAstMaker(ast: CanAst): GrimVal {
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Let") {
            if (ast.args.length !== 2) {
                console.warn("GrimLet.canAstMaker called with insufficient args, returning empty GrimVal");
                return new GrimVal();
            }
            const bindingsAst = GrimVal.fromCanAst(ast.args[0]);
            const body = GrimVal.fromCanAst(ast.args[1]);
            
            if (bindingsAst instanceof GrimList) {
                return new GrimLet(bindingsAst.asArray(), body);
            } else {
                console.warn("GrimLet.canAstMaker called with first arg not a GrimList, returning empty GrimVal");
                return new GrimVal();
            }
        }
        console.warn(`GrimLet.canAstMaker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimVal();
    }
}

export { GrimApp, GrimFun, GrimLet };
