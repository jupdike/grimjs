import { GrimError } from "./GrimOpt.js";
import { GrimVal, strOf } from "./GrimVal.js";
import { AstJson } from "./GrimVal.js";
import { CanAst, CanStr } from "../parser/CanAst.js";

class GrimStr extends GrimVal {
    readonly value: string;
    constructor(value: string) {
        super();
        this.value = value;
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

    static maker(ast: CanAst | Array<GrimVal>): GrimVal {
        if (ast instanceof CanStr) {
            return new GrimStr(ast.str);
        }
        if (Array.isArray(ast)) {
            if (ast.length !== 1 || !(ast[0] instanceof GrimStr)) {
                console.warn(`GrimStr.maker received unexpected array length, or item is not a string: ${ast.length}`);
                return new GrimError(["NOPE_CanStr"]);
            }
            return ast[0];
        }
        console.warn(`GrimStr.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimError(["NOPE_CanStr"]);
    }
}

export { GrimStr };
