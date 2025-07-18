import { GrimStr } from "./GrimStr";
import { GrimVal, AstJson } from "./GrimVal";
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
}

class GrimLet extends GrimVal {
    private args: Array<GrimVal>;
    private body: GrimVal;
    static isAtom(): boolean {
        return false; // GrimLet is not an atom
    }
    constructor(args: Array<GrimVal>, body: GrimVal) {
        super();
        this.args = args;
        this.body = body;
    }
    toString(): string {
        let argsStr = this.args.map(arg => arg.toString()).join(", ");
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
        let args = argBody[0] as GrimList;
        // TODO check that args are all Def(Var(name), value) pairs and pull those apart
        let body = argBody[1];
        return new GrimLet(args.asArray(), body);
    }
}

export { GrimApp, GrimFun, GrimLet };
