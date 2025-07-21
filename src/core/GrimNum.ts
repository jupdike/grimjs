import type { GMPLib } from 'gmp-wasm';
import gmp from 'gmp-wasm';
import { Integer } from "gmp-wasm/dist/types/integer.js";
import { GrimVal } from "./GrimVal.js";
import { CanTaggedApp, CanStr, CanAst } from "../parser/CanAst.js";
import { GrimError } from "./GrimOpt.js";
import { GrimStr } from './GrimStr.js';
import { Builder } from './Builder.js';
import type { FuncType } from './Builder.js';

class GrimNat extends GrimVal {
    value: string;
    constructor(value: number | string) {
        super();
        if (typeof value === "string") {
            value = value.trim();
            if (!/^\d+$/.test(value)) {
                throw new Error(`Invalid string for GrimNat: ${value}. Expected a string of one or more decimal digits.`);
            }
            this.value = value.trim();
        }
        else if (typeof value === "number") {
            this.value = ""+(value|0); // Convert to string, ensuring no decimal point
        }
        else {
            throw new Error(`Invalid type for GrimNat: ${typeof value}. Expected number or string.`);
        }
    }

    toString(): string {
        return this.value;
    }

    isAtom(): boolean {
        return true;
    }

    head(): string {
        return "Nat";
    }

    static maker(ast: CanAst | Array<GrimVal>): GrimVal {
        if (Array.isArray(ast)) {
            // TODO could allow cast from other types?, to GrimNat
            // later
            if (ast.length !== 1 || !(ast[0] instanceof GrimNat ||
                ast[0] instanceof CanStr || ast[0] instanceof GrimStr)) {
                console.warn(`GrimNat.maker received unexpected array format: ${JSON.stringify(ast)}`);
                return new GrimError(["NOPE_CanNat"]);
            }
            if (ast[0] instanceof GrimNat) {
                return ast[0]; // Already a GrimNat, just return it
            }
            if (ast[0] instanceof GrimStr) {
                return new GrimNat(ast[0].value);
            }
            if (ast[0] instanceof CanStr) {
                return new GrimNat(ast[0].toString());
            }
        }
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Nat" && ast.args.length === 1) {
            const arg = ast.args[0];
            if (arg instanceof CanStr) {
                return new GrimNat(arg.str);
            }
        }
        console.warn(`GrimNat.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimError(["NOPE_CanNat"]);
    }

    private static fromBinaryFunction(gmpLib: GMPLib, left: GrimVal, right: GrimVal,
        fn: (a: any, b: any) => string): GrimVal {
        if (left instanceof GrimNat && right instanceof GrimNat) {
            let ret: string = "";
            const roundingMode = gmp.FloatRoundingMode.ROUND_DOWN;
            const options = { precisionBits: 400, roundingMode };
            const ctx = gmpLib.getContext(options);
            let x: any = ctx.Integer(left.value);
            let y: any = ctx.Integer(right.value);
            ret = fn(x, y).toString();
            setTimeout(() => ctx.destroy(), 50);
            return new GrimNat(ret);
        }
        return new GrimError(["NOPE_CanNat"]);
    }

    static wrapBinaryOp(builder: Builder, fn: (a: any, b: any) => any): FuncType {
        return (args: Array<GrimVal>) => {
            if (args.length !== 2) {
                console.warn("GrimTag.addCallableTag called with invalid args for Op.Type.Type");
                return new GrimError(["Op.Type.Type requires exactly 2 arguments"]);
            }
            if (args[0] instanceof GrimNat && args[1] instanceof GrimNat) {
                return GrimNat.fromBinaryFunction(builder.gmpLib, args[0], args[1], (a: any, b: any) => {
                    return fn(a, b); // Use GMP's operation on two IntegerTypes
                });
            }
            return new GrimError(["Op.Type.Type requires Type arguments"]);
        };
    }
}

class GrimInt extends GrimNat {
    value: string;
    constructor(value: number | string) {
        super(0); // don't call the parent constructor,
        // we handle it here because negative numbers are allowed in Int but not in Nat
        if (typeof value === "string") {
            value = value.trim();
            if (!/^-?\d+$/.test(value)) {
                throw new Error(`Invalid string for GrimInt: ${value}. Expected an integer.`);
            }
            this.value = value;
        } else if (typeof value === "number") {
            this.value = "" + (value | 0); // Convert to string, ensuring no decimal point
        } else {
            throw new Error(`Invalid type for GrimInt: ${typeof value}. Expected number or string.`);
        }
    }

    toString(): string {
        return this.value;
    }

    head(): string {
        return "Int";
    }

    static maker(ast: CanAst | Array<GrimVal>): GrimVal {
        if (Array.isArray(ast)) {
            // TODO could allow cast from other types?, to GrimNat
            // later
            if (ast.length !== 1 || !(ast[0] instanceof GrimNat ||
                ast[0] instanceof CanStr || ast[0] instanceof GrimStr)) {
                console.warn(`GrimInt.maker received unexpected array format: ${JSON.stringify(ast)}`);
                return new GrimError(["NOPE_CanInt"]);
            }
            if (ast[0] instanceof GrimInt) {
                return ast[0]; // Already a GrimInt, just return it
            }
            if (ast[0] instanceof GrimNat) {
                return new GrimInt(ast[0].value); // Convert GrimNat to GrimInt
            }
            if (ast[0] instanceof GrimStr) {
                return new GrimInt(ast[0].value);
            }
            if (ast[0] instanceof CanStr) {
                return new GrimInt(ast[0].toString());
            }
        }
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Int" && ast.args.length === 1) {
            const arg = ast.args[0];
            if (arg instanceof CanStr) {
                return new GrimInt(arg.str);
            }
        }
        console.warn(`GrimInt.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimError(["NOPE_CanInt"]);
    }

     private static fromBinaryFunction(gmpLib: GMPLib, left: GrimVal, right: GrimVal,
        fn: (a: any, b: any) => string): GrimVal {
        if ((left instanceof GrimInt  || left instanceof GrimNat) &&
            (right instanceof GrimInt || right instanceof GrimNat)) {
            let ret: string = "";
            const roundingMode = gmp.FloatRoundingMode.ROUND_DOWN;
            const options = { precisionBits: 400, roundingMode };
            const ctx = gmpLib.getContext(options);
            let x: any = ctx.Integer(left.value);
            let y: any = ctx.Integer(right.value);
            ret = fn(x, y).toString();
            setTimeout(() => ctx.destroy(), 50);
            return new GrimInt(ret);
        }
        return new GrimError(["NOPE_CanInt"]);
    }

    static wrapBinaryOp(builder: Builder, fn: (a: any, b: any) => any): FuncType {
        return (args: Array<GrimVal>) => {
            if (args.length !== 2) {
                console.warn("GrimTag.addCallableTag called with invalid args for Op.Type.Type");
                return new GrimError(["Op.Type.Type requires exactly 2 arguments"]);
            }
            if (args[0] instanceof GrimNat && args[1] instanceof GrimNat) {
                return GrimInt.fromBinaryFunction(builder.gmpLib, args[0], args[1], (a: any, b: any) => {
                    return fn(a, b); // Use GMP's operation on two IntegerTypes
                });
            }
            return new GrimError(["Op.Type.Type requires Type arguments"]);
        };
    }
}

class GrimDec extends GrimVal {
    constructor(private value: number | string) {
        super();
        if (typeof value === "string") {
            // problem should check with regex
            this.value = value.trim();
            // also should ensure that digits, a decimal point and/or exponent are present
            if (!/^(\d+\.(\d+)?|\d*\.(\d+)?)([eE][+-]?\d+)?$/.test(this.value)) {
                throw new Error(`Invalid string for GrimDec: ${value}. Expected a decimal number.`);
            }
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

    static maker(ast: CanAst | Array<GrimVal>): GrimVal {
        if (Array.isArray(ast)) {
            // TODO could allow cast from other types?, to GrimDec
            // later
            if (ast.length !== 1 ||
                !(ast[0] instanceof GrimDec ||
                    ast[0] instanceof GrimNat ||
                    ast[0] instanceof CanStr ||
                    ast[0] instanceof GrimStr)
            ) {
                console.warn(`GrimDec.maker received unexpected array format: ${JSON.stringify(ast)}`);
                return new GrimError(["NOPE_CanDec"]);
            }
            if (ast[0] instanceof GrimDec) {
                return ast[0]; // Already a GrimDec, just return it
            }
            if (ast[0] instanceof GrimNat) {
                let s: string = ast[0].value.trim();
                if (s.indexOf('.') === -1) {
                    s += '.0'; // Ensure it has a decimal point
                }
                return new GrimDec(s);
            }
            if (ast[0] instanceof CanStr) {
                return new GrimDec(ast[0].str);
            }
            if (ast[0] instanceof GrimStr) {
                return new GrimDec(ast[0].value);
            }
        }
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

export { GrimNat, GrimInt, GrimDec };
