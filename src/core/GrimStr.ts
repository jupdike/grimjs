import { GrimError } from "./GrimOpt.js";
import { GrimVal, strOf } from "./GrimVal.js";
import { AstJson } from "./GrimVal.js";
import { CanAst, CanStr } from "../parser/CanAst.js";

class GrimStr extends GrimVal {
    constructor(private value: string) {
        super();
    }

    toString(): string {
        return strOf(this.value);
    }
    isAtom(): boolean {
        return true;
    }
    head(): string {
        return "Str";
    }

    equals(other: GrimVal): boolean {
        if (other instanceof GrimStr) {
            if (this.value.length !== other.value.length) {
                return false;
            }
            return this.value === other.value;
        }
        if (other instanceof GrimVal) {
            return this.equals(other);
        }
        return false;
    }

    static maker(ast: CanAst): GrimVal {
        if (ast instanceof CanStr) {
            return new GrimStr(ast.str);
        }
        console.warn(`GrimStr.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimError(["NOPE_CanStr"]);
    }
}

export { GrimStr };
