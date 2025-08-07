import type { GMPLib } from 'gmp-wasm';
import gmp from 'gmp-wasm';
import { Integer } from "gmp-wasm/dist/types/integer.js";
import { GrimVal } from "./GrimVal.js";
import { CanTaggedApp, CanStr, CanAst } from "../parser/CanAst.js";
import { GrimError } from "./GrimOpt.js";
import { GrimStr } from './GrimStr.js';
import { Builder } from './Builder.js';
import type { FuncType } from './Builder.js';
import { GrimBool } from './GrimBool.js';

// for api for GMP's wrapped Float, see:
//   https://github.com/Daninet/gmp-wasm/blob/master/src/float.ts
// for api for GMP's wrapped Integer, see:
//  https://github.com/Daninet/gmp-wasm/blob/master/src/integer.ts

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

    toCanonicalString(): string {
        // canonical form only has strings, tags, parentheses, commas, not even numbers
        return `Nat("${this.value}")`;
    }

    isAtom(): boolean {
        return true;
    }

    head(): string {
        return "Nat";
    }

    static maker(ast: CanAst | Array<GrimVal>, builder: Builder): GrimVal {
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

    static fromBinaryFunction(gmpLib: GMPLib, left: GrimVal, right: GrimVal,
        fn: (a: any, b: any) => string): GrimVal {
        if (left instanceof GrimNat && right instanceof GrimNat) {
            let ret: string = "";
            const ctx = gmpLib.getContext();
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

    static wrapBinaryOpBool(builder: Builder, fn: (a: any, b: any) => boolean): FuncType {
        return (args: Array<GrimVal>) => {
            if (args.length !== 2) {
                console.warn("GrimTag.addCallableTag called with invalid args for Op.Type.Type");
                return new GrimError(["Op.Type.Type requires exactly 2 arguments"]);
            }
            if (args[0] instanceof GrimNat && args[1] instanceof GrimNat) {
                const gmpLib = builder.gmpLib;
                if (!gmpLib) {
                    console.error("GrimNat.wrapBinaryOpBool called but builder.gmpLib is null");
                    return new GrimError(["GMP library not initialized"]);
                }
                const ctx = gmpLib.getContext();
                let x: any = ctx.Integer(args[0].value);
                let y: any = ctx.Integer(args[1].value);
                let result: boolean = fn(x, y);
                setTimeout(() => ctx.destroy(), 50);
                return GrimBool.fromBool(result);
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

    toCanonicalString(): string {
        // canonical form only has strings, tags, parentheses, commas, not even numbers
        return `Int("${this.value}")`;
    }

    head(): string {
        return "Int";
    }

    static maker(ast: CanAst | Array<GrimVal>, builder: Builder): GrimVal {
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

    static fromBinaryFunction(gmpLib: GMPLib, left: GrimVal, right: GrimVal,
        fn: (a: any, b: any) => string): GrimVal {
        if ((left instanceof GrimInt  || left instanceof GrimNat) &&
            (right instanceof GrimInt || right instanceof GrimNat)) {
            let ret: string = "";
            const ctx = gmpLib.getContext();
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

    static wrapBinaryOpBool(builder: Builder, fn: (a: any, b: any) => boolean): FuncType {
        return (args: Array<GrimVal>) => {
            if (args.length !== 2) {
                console.warn("GrimTag.addCallableTag called with invalid args for Op.Type.Type");
                return new GrimError(["Op.Type.Type requires exactly 2 arguments"]);
            }
            if (args[0] instanceof GrimInt && args[1] instanceof GrimInt) {
                const gmpLib = builder.gmpLib;
                if (!gmpLib) {
                    console.error("GrimInt.wrapBinaryOpBool called but builder.gmpLib is null");
                    return new GrimError(["GMP library not initialized"]);
                }
                const ctx = gmpLib.getContext();
                let x: any = ctx.Integer(args[0].value);
                let y: any = ctx.Integer(args[1].value);
                let result: boolean = fn(x, y);
                setTimeout(() => ctx.destroy(), 50);
                return GrimBool.fromBool(result);
            }
            return new GrimError(["Op.Type.Type requires Type arguments"]);
        };
    }
}

class GrimRat extends GrimVal {
    readonly numerator: GrimInt;
    readonly denominator: GrimInt;
    constructor(numerator: GrimInt, denominator: GrimInt) {
        super();
        this.numerator = numerator;
        this.denominator = denominator;
    }

    toString(): string {
        return `${this.numerator.toString()}/${this.denominator.toString()}`;
    }

    isAtom(): boolean {
        // Rational numbers are considered atoms -- although they print
        // as fractions which must be eval'd to get back to a Rat
        return true;
    }

    head(): string {
        return "Rat";
    }

    toCanonicalString(): string {
        // canonical form only has strings, tags, parentheses, commas, not even numbers
        return `Rat("${this.toString()}")`;
    }

    static maker(ast: CanAst | Array<GrimVal>, builder: Builder): GrimVal {
        if (Array.isArray(ast)) {
            // If it's an array, we expect two elements: numerator and denominator
            if (ast.length !== 1) {
                console.warn("GrimRat.maker received invalid array length");
                return new GrimError(["NOPE_CanRat1"]);
            }
            if (ast[0] instanceof GrimRat) {
                return ast[0]; // Already a GrimRat, just return it
            }
            if (ast[0] instanceof GrimInt || ast[0] instanceof GrimNat) {
                // If it's a GrimInt or GrimNat, we expect it to be a valid numerator/denominator pair
                return new GrimRat(ast[0], new GrimInt("1")); // Default denominator to 1
            }
            if (ast[0] instanceof GrimStr) {
                // If it's a GrimInt, GrimNat, or GrimStr, we
                // expect it to be a valid numerator/denominator pair
                return GrimRat.fromString(ast[0].value);
            }
        }
        if (ast instanceof CanStr) {
            return GrimRat.fromString(ast.str);
        }
        // If it's a single AST node, we need to handle it accordingly
        return new GrimError(["NOPE_CanRat2"]);
    }

    static fromString(value: string): GrimVal {
        const parts = value.split('/');
        if (parts.length === 1) {
            // If there's no denominator, treat it as a whole number
            return new GrimRat(new GrimInt(parts[0].trim()), new GrimInt("1"));
        }
        if (parts.length !== 2) {
            console.warn(`GrimRat.fromString received invalid format: ${value}`);
            return new GrimError(["NOPE_CanRat"]);
        }
        // If there are two parts, treat them as numerator and denominator
        const numerator = new GrimInt(parts[0].trim());
        const denominator = new GrimInt(parts[1].trim());
        if (denominator.value === "0") {
            console.warn("GrimRat.fromString received zero denominator, returning error");
            return new GrimError(["NOPE_CanRat"]);
        }
        return new GrimRat(numerator, denominator);
    }

    static fromBinaryFunction(gmpLib: GMPLib, left: GrimVal, right: GrimVal,
        fn: (a: any, b: any) => string): GrimVal {
        if (!(left instanceof GrimRat)) {
            left = GrimRat.fromString(left.toString());
        }
        if (!(right instanceof GrimRat)) {
            right = GrimRat.fromString(right.toString());
        }
        if (left instanceof GrimRat && right instanceof GrimRat) {
            let ret: string = "";
            const ctx = gmpLib.getContext();
            let x: any = ctx.Rational(left.toString());
            let y: any = ctx.Rational(right.toString());
            let val: any = fn(x, y);
            if (val.denominator() == 1) {
                return new GrimInt(val.numerator().toString());
            }
            let result = val.toString();
            let final = GrimRat.fromString(result);

            setTimeout(() => ctx.destroy(), 50);
            return final;
        }
        return new GrimError(["NOPE_CanInt"]);
    }

    static wrapBinaryOp(builder: Builder, fn: (a: any, b: any) => any): FuncType {
        return (args: Array<GrimVal>) => {
            if (args.length !== 2) {
                console.error("uno -- GrimTag.addCallableTag called with invalid args for Rat -- Op.Type.Type");
                return new GrimError(["Rat -- Op.Type.Type requires exactly 2 arguments"]);
            }
            let args0 = args[0];
            let args1 = args[1];
            if (!(args0 instanceof GrimRat)) {
                args0 = GrimRat.fromString(args0.toString());
            }
            if (!(args1 instanceof GrimRat)) {
                args1 = GrimRat.fromString(args1.toString());
            }
            if (args0 instanceof GrimRat && args1 instanceof GrimRat) {
                return GrimRat.fromBinaryFunction(builder.gmpLib, args0, args1, (a: any, b: any) => {
                    return fn(a, b); // Use GMP's operation on two IntegerTypes
                });
            }
            return new GrimError(["dos -- Rat -- Op.Type.Type requires Type arguments"]);
        };
    }
}

class GrimDec extends GrimVal {
    readonly value: string;
    constructor(value: number | string) {
        super();
        if (typeof value === "string") {
            // should check with regex
            this.value = value.trim();
            // the result of some decimal operations may be a natural number or integer
            // so do not throw an error if it is a whole number
            if (/^([+-])?\d+$/.test(this.value)) {
                this.value = this.value;
            }
            // normally ensure that digits, a decimal point and/or exponent are present
            else if (!/^([+-])?(\d+\.(\d*)|\d*\.\d+)([eE][+-]?\d+)?$/.test(this.value)) {
                throw new Error(`Invalid string for GrimDec: |${value}|. Expected a decimal number.`);
            }
        }
        else if (typeof value === "number") {
            this.value = ""+value;
        }
        else {
            throw new Error(`Invalid type for GrimDec: ${typeof value}. Expected number or string.`);
        }
    }

    toString(): string {
        return this.value.toString();
    }

    toCanonicalString(): string {
        // canonical form only has strings, tags, parentheses, commas, not even numbers
        return `Dec("${this.toString()}")`;
    }

    equals(other: GrimVal): boolean {
        if (this === other) {
            return true; // Same reference
        }
        let a = this.value;
        if (this.value.endsWith('.') || this.value.endsWith('.0')) {
            a = this.value.slice(0, -1); // Remove trailing . or .0 for comparison
        }

        // Check if the other value is a GrimDec and compare values
        if (other instanceof GrimDec && a === other.value) {
            return true;
        }
        // Check if the other value is a GrimInt and compare values
        if (other instanceof GrimInt && a === other.value) {
            return true;
        }
        // Check if the other value is a GrimNat and compare values
        if (other instanceof GrimNat && a === other.value) {
            return true;
        }
        // TODO deal with GrimRat, which is a fraction, in a sensible manner
        //
        if (other instanceof GrimDec && GrimDec.gmpLib) {
            // try for a little more leeway, e.g. 1 == 1.0   and 1. == 1
            const roundingMode = gmp.FloatRoundingMode.ROUND_DOWN;
            const options = { precisionBits: 333, roundingMode };
            const ctx = GrimDec.gmpLib.getContext(options);
            //console.error(`Comparing Decs: ${this.value} and ${other.value}`);
            let x: any = ctx.Float(this.value);
            let y: any = ctx.Float(other.value);
            //console.error(`Comparing Decs: ${x.toString()} and ${y.toString()}`);
            let ret = x.isEqual(y);
            setTimeout(() => ctx.destroy(), 50);
            if (ret) {
                return true; // Same type and value
            }
        }

        return false;
    }

    isAtom(): boolean {
        return true;
    }

    head(): string {
        return "Dec";
    }

    static fromBinaryFunction(gmpLib: GMPLib, left: GrimVal, right: GrimVal,
        fn: (a: any, b: any) => string): GrimVal {
        if (left instanceof GrimDec && right instanceof GrimDec) {
            let ret: string = "";
            const roundingMode = gmp.FloatRoundingMode.ROUND_DOWN;
            const options = { precisionBits: 333, roundingMode };
            const ctx = gmpLib.getContext(options);
            let x: any = ctx.Float(left.value);
            let y: any = ctx.Float(right.value);
            ret = fn(x, y).toString();
            setTimeout(() => ctx.destroy(), 50);
            return new GrimDec(ret);
        }
        return new GrimError(["NOPE_CanDec"]);
    }

    static wrapBinaryOp(builder: Builder, fn: (a: any, b: any) => any): FuncType {
        return (args: Array<GrimVal>) => {
            if (args.length !== 2) {
                console.warn("GrimTag.addCallableTag called with invalid args for Op.Type.Type");
                return new GrimError(["Op.Type.Type requires exactly 2 arguments"]);
            }
            // Deal with upcasting from GrimRat, GrimInt, GrimNat
            let args0 = args[0];
            let args1 = args[1];
            if (!(args0 instanceof GrimDec)) {
                args0 = GrimDec.maker([args0], builder);
            }
            if (!(args1 instanceof GrimDec)) {
                args1 = GrimDec.maker([args1], builder);
            }
            if (args0 instanceof GrimDec && args1 instanceof GrimDec) {
                return GrimDec.fromBinaryFunction(builder.gmpLib, args0, args1, (a: any, b: any) => {
                    return fn(a, b); // Use GMP's operation on two FloatTypes
                });
            }
            console.error(`GrimDec.wrapBinaryOp called with args: ${args.map(a => a.toCanonicalString()).join(", ")}`);
            return new GrimError(["Op.Type.Type requires Type arguments"]);
        };
    }

    static gmpLib: GMPLib | null = null;

    static maker(ast: CanAst | Array<GrimVal>, builder: Builder): GrimVal {
        if (builder.gmpLib && !GrimDec.gmpLib) {
            //console.error("setting gmpLib in GrimDec.maker");
            GrimDec.gmpLib = builder.gmpLib;
        }
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
            // turn a rational into a GrimDec
            if (ast[0] instanceof GrimRat) {
                // must divide the numerator by the denominator
                let rat = ast[0] as GrimRat;
                let num = rat.numerator.value;
                let denom = rat.denominator.value;
                let func = GrimDec.wrapBinaryOp(builder, (a, b) => { return a.div(b); });
                return func([new GrimDec(num),
                             new GrimDec(denom)]);
            }
            if (ast[0] instanceof GrimNat || ast[0] instanceof GrimInt) {
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

export { GrimNat, GrimInt, GrimRat, GrimDec };
