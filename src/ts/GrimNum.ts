import { AstJson, GrimVal } from "./GrimVal.js";
import { GrimAst } from "./GrimAst.js";

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

    static maker(children: Array<AstJson | string>): GrimVal {
        // console.log('Parsed AST JSON 765 ***:', JSON.stringify(children, null, 2));
        if (children.length === 1 &&
            (typeof children[0] === "number" || typeof children[0] === "string")) {
            return new GrimNat(children[0]);
        }
        if (children.length === 1 && typeof children[0] === "object"
            && children[0].tag === "Str" && children[0].children
            && children[0].children.length === 1 &&
            (typeof children[0].children[0] === "string" ||
             typeof children[0].children[0] === "number")) {
            return new GrimNat(children[0].children[0]);
        }
        return new GrimAst("NOPE");
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

    static maker(children: Array<AstJson | string>): GrimVal {
        // console.log('Parsed AST JSON 765 ***:', JSON.stringify(children, null, 2));
        if (children.length === 1 &&
            (typeof children[0] === "number" || typeof children[0] === "string")) {
            return new GrimDec(children[0]);
        }
        if (children.length === 1 && typeof children[0] === "object"
            && children[0].tag === "Str" && children[0].children
            && children[0].children.length === 1 &&
            (typeof children[0].children[0] === "string" ||
             typeof children[0].children[0] === "number")) {
            return new GrimNat(children[0].children[0]);
        }
        return new GrimAst("NOPE");
    }
}

export { GrimNat, GrimDec };
