import { AstJson, GrimVal } from "./GrimVal.js";
import { CanTaggedApp, CanStr, CanAst } from "../parser/CanAst.js";
import { GrimError } from "./GrimOpt.js";

class GrimNat extends GrimVal {
    constructor(private value: number | string) {
        super();
        if (typeof value === "string") {
            this.value = value.trim();
        }
        else if (typeof value === "number") {
            this.value = value;
        }
        else {
            throw new Error(`Invalid type for GrimNat: ${typeof value}. Expected number or string.`);
        }
    }

    toString(): string {
        return this.value.toString();
    }

    isAtom(): boolean {
        return true;
    }

    head(): string {
        return "Nat";
    }

    static maker(ast: CanAst): GrimVal {
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Nat" && ast.args.length === 1) {
            const arg = ast.args[0];
            if (arg instanceof CanStr) {
                return new GrimNat(arg.str);
            }
        }
        console.warn(`GrimNat.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimError(["NOPE_CanNat"]);
    }
}

class GrimDec extends GrimVal {
    constructor(private value: number | string) {
        super();
        if (typeof value === "string") {
            this.value = value.trim();
        }
        else if (typeof value === "number") {
            this.value = value;
        }
        else {
            throw new Error(`Invalid type for GrimDec: ${typeof value}. Expected number or string.`);
        }
    }

    toString(): string {
        return this.value.toString();
    }

    isAtom(): boolean {
        return true;
    }

    head(): string {
        return "Dec";
    }

    static maker(ast: CanAst): GrimVal {
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Dec" && ast.args.length === 1) {
            const arg = ast.args[0];
            if (arg instanceof CanStr) {
                return new GrimDec(arg.str);
            }
        }
        console.warn(`GrimDec.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimError(["NOPE_CanDec"]);
    }
}

export { GrimNat, GrimDec };
