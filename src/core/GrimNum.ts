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
        // TODO new code to create @(number, ...children)
        return new GrimError(["NOPE_Nat"]);
    }

    static canAstMaker(ast: CanAst): GrimVal {
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Nat" && ast.args.length === 1) {
            const arg = ast.args[0];
            if (arg instanceof CanStr) {
                return new GrimNat(arg.str);
            }
        }
        console.warn(`GrimNat.canAstMaker received unexpected AST type: ${ast.constructor.name}`);
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
        // TODO new code to create @(number, ...children)
        return new GrimError(["NOPE_Dec"]);
    }

    static canAstMaker(ast: CanAst): GrimVal {
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Dec" && ast.args.length === 1) {
            const arg = ast.args[0];
            if (arg instanceof CanStr) {
                return new GrimDec(arg.str);
            }
        }
        console.warn(`GrimDec.canAstMaker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimError(["NOPE_CanDec"]);
    }
}

export { GrimNat, GrimDec };
