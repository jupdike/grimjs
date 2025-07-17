import { GrimStr } from "./GrimStr";
import { GrimVal, AstJson } from "./GrimVal";

export class GrimApp extends GrimVal {
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
