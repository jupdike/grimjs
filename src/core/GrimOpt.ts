import { GrimVal, AstJson } from "./GrimVal.js";
import { CanTaggedApp, CanAst, CanStr } from "../parser/CanAst.js";
import { GrimStr } from "./GrimStr.js";
import { Builder } from "./Builder.js";

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
        return this.value === null;
    }

    head(): string {
        return "Option";
    }

    static maker(ast: CanAst | Array<GrimVal>, builder: Builder): GrimVal {
        if (Array.isArray(ast)) {
            if (ast.length === 0) {
                return GrimOpt.None; // Empty array means None
            }
            if (ast.length === 1 && ast[0] instanceof GrimVal) {
                return GrimOpt.Some(ast[0]); // Single value means Some(value)
            }
            console.warn(`GrimOpt.maker received unexpected array format: ${JSON.stringify(ast)}`);
            return new GrimError(["NOPE_CanOpt"]);
        }
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Some") {
            if (ast.args.length === 0) {
                return GrimOpt.None;
            }
            if (ast.args.length === 1) {
                const arg = builder.fromAst(ast.args[0]);
                return GrimOpt.Some(arg);
            }
        }
        console.warn(`GrimOpt.maker received unexpected AST type: ${ast.constructor.name}`);
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
        return true;
    }

    head(): string {
        return "Error";
    }

    static maker(ast: CanAst, builder: Builder): GrimVal {
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Error") {
            const errorArgs = ast.args.map(arg => {
                if (arg instanceof CanStr) {
                    return arg.str;
                }
                return builder.fromAst(arg);
            });
            return new GrimError(errorArgs);
        }
        console.warn(`GrimError.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimError(["NOPE_CanError"]);
    }

}

export { GrimOpt, GrimError };
