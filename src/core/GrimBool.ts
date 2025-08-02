import { GrimVal } from "./GrimVal.js";
import { AstJson } from "./GrimVal.js";
import { CanTaggedApp, CanStr, CanAst } from "../parser/CanAst.js";
import { GrimError } from "./GrimOpt.js";
import { GrimStr } from "./GrimStr.js";

class GrimBool extends GrimVal {
    static True = new GrimBool();
    static False = new GrimBool(false);

    private value: boolean;

    isAtom(): boolean {
        return true; // GrimBool is an atom
    }

    public constructor(value: boolean = true) {
        super();
        this.value = value;
    }

    toString(): string {
        return this.value ? 'True' : 'False';
    }

    head(): string {
        return 'Bool';
    }

    equals(other: GrimVal): boolean {
        if (other instanceof GrimBool) {
            return this.value === other.value;
        }
        return false;
    }

    isTrue() : boolean { return this.value;  }
    isFalse(): boolean { return !this.value; }

    static maker(ast: CanAst | Array<GrimVal>): GrimVal {
        if (Array.isArray(ast)) {
            if (ast.length !== 1 || !(ast[0] instanceof GrimBool || ast[0] instanceof GrimStr)) {
                console.warn(`GrimBool.maker received unexpected array length, or item is not a boolean: ${ast.length}`);
                return new GrimError(["NOPE_CanBool"]);
            }
            // already a GrimBool, just return it
            if (ast[0] instanceof GrimBool) {
                return ast[0];
            }
            if (ast[0] instanceof GrimStr) {
                if (ast[0].value !== "True" && ast[0].value !== "False") {
                    console.warn(`GrimBool.maker received unexpected string: ${ast[0].value}`);
                    return new GrimError(["NOPE_CanBool"]);
                }
                return new GrimBool(ast[0].value === "True");
            }
        }
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Bool" && ast.args.length === 1) {
            const arg = ast.args[0];
            if (arg instanceof CanStr) {
                return new GrimBool(arg.str === "True");
            }
        }
        console.warn(`GrimBool.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimError(["NOPE_CanBool"]);
    }
}

export { GrimBool };
