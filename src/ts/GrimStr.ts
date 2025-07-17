import { GrimAst } from "./GrimAst.js";
import { GrimVal, strOf } from "./GrimVal.js";
import { AstJson } from "./GrimVal.js";

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

    static maker(children: Array<string | AstJson>): GrimVal {
        // console.log('Parsed AST JSON 765 ***:', JSON.stringify(children, null, 2));
        if (children.length === 1 && typeof children[0] === "string") {
            return new GrimStr(children[0]);
        }
        if (children.length === 1 && typeof children[0] === "object"
            && children[0].tag === "Str" && children[0].children
            && children[0].children.length === 1 && typeof children[0].children[0] === "string") {
            return new GrimStr(children[0].children[0]);
        }
        return new GrimAst("NOPE");
    }
}

export { GrimStr };
