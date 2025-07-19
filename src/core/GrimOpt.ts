import { GrimVal, AstJson } from "./GrimVal.js";
import { CanTaggedApp, CanAst, CanStr } from "../parser/CanAst.js";
import { GrimStr } from "./GrimStr.js";

class GrimOpt extends GrimVal {
    private value: GrimVal | null;

    static None: GrimOpt = new GrimOpt(null);

    static Some(value: GrimVal): GrimOpt {
        return new GrimOpt(value);
    }

    private constructor(value: GrimVal | null) {
        super();
        this.value = value;
    }

    toString(): string {
        return this.value ? `Some(${this.value.toString()})` : "None";
    }

    isAtom(): boolean {
        return false; // Options are not considered atoms
    }

    head(): string {
        return "Option";
    }

    static maker(children: Array<AstJson | string>): GrimVal {
        if (children.length === 0) {
            return GrimOpt.None;
        }
        if (children.length === 1 && typeof children[0] === "string") {
            return GrimOpt.Some(new GrimStr(children[0]));
        }
        if (children.length === 1 && typeof children[0] === "object") {
            return GrimOpt.Some(GrimVal.fromAst(children[0]));
        }
        return new GrimError(["NOPE_Opt"]);
    }

    static canAstMaker(ast: CanAst): GrimVal {
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Some") {
            if (ast.args.length === 0) {
                return GrimOpt.None;
            }
            if (ast.args.length === 1) {
                const arg = GrimVal.fromCanAst(ast.args[0]);
                return GrimOpt.Some(arg);
            }
        }
        console.warn(`GrimOpt.canAstMaker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimError(["NOPE_CanOpt"]);
    }
}

class GrimError extends GrimVal {
    private message: Array<string | GrimVal | AstJson>;

    constructor(message: Array<string | GrimVal | AstJson>) {
        super();
        this.message = message;
    }

    toString(): string {
        let pieces: Array<string> = [];
        for (let part of this.message) {
            if (typeof part === "string") {
                pieces.push(part);
            } else if (part instanceof GrimVal) {
                pieces.push(part.toString());
            } else {
                pieces.push(JSON.stringify(part));
            }
        }
        return `Error(${pieces.join(", ")})`;
    }

    isAtom(): boolean {
        return false; // Errors are not considered atoms
    }

    head(): string {
        return "Error";
    }

    static maker(children: Array<AstJson | string>): GrimVal {
        return new GrimError(children.map(child => {
            if (typeof child === "string") {
                return child;
            }
            let val = GrimVal.fromAst(child);
            return val;
        }));
    }

    static canAstMaker(ast: CanAst): GrimVal {
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Error") {
            const errorArgs = ast.args.map(arg => {
                if (arg instanceof CanStr) {
                    return arg.str;
                }
                return GrimVal.fromCanAst(arg);
            });
            return new GrimError(errorArgs);
        }
        console.warn(`GrimError.canAstMaker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimError(["NOPE_CanError"]);
    }

}

export { GrimOpt, GrimError };
