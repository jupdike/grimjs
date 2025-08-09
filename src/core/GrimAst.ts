import { Map, List, Set } from "immutable";

import { GrimVal, strOf } from "./GrimVal.js";
import { CanAst, CanTag, CanTaggedApp, CanStr } from "../parser/CanAst.js";
import { GrimBool } from "./GrimBool.js";
import { GrimOpt, GrimError } from "./GrimOpt.js";
import { GrimModule } from "./GrimModule.js";
import { GrimStr } from "./GrimStr.js";

class GrimTag extends GrimVal {
    readonly value: string;
    constructor(value: string) {
        super();
        this.value = value;
    }

    toString(): string {
        //return `Tag(${strOf(this.value)})`; // infinite regression
        // so just return the value itself
        return `${this.value}`;
    }

    isAtom(): boolean {
        return true;
    }

    head(): string {
        return "Tag";
    }

    equals(other: GrimVal): boolean {
        if (other instanceof GrimTag) {
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

    static maker(ast: CanAst | Array<GrimVal>, module: GrimModule): GrimVal {
        if (Array.isArray(ast)) {
            let arr = ast as Array<GrimVal>;
            if (!arr || arr.length !== 1 || !(arr[0] instanceof GrimTag || arr[0] instanceof GrimStr)) {
                console.warn(`GrimTag.maker received unexpected array length, or item is not a tag: ${arr.length}`);
                return new GrimError(["NOPE_CanTag"]);
            }
            // already a GrimTag, just return it
            if (arr[0] instanceof GrimTag) {
                return arr[0];
            }
            if (arr[0] instanceof GrimStr) {
                return new GrimTag(arr[0].value);
            }
        }
        if (ast instanceof CanTag) {
            // Special built-in tags
            if (ast.tag === "True") return GrimBool.True;
            if (ast.tag === "False") return GrimBool.False;
            if (ast.tag === "None") return GrimOpt.None;
            return new GrimTag(ast.tag);
        }
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Tag" && ast.args.length === 1) {
            const arg = ast.args[0];
            if (arg instanceof CanStr) {
                // Special built-in tags
                if (arg.str === "True") return GrimBool.True;
                if (arg.str === "False") return GrimBool.False;
                if (arg.str === "None") return GrimOpt.None;
                return new GrimTag(arg.str);
            }
        }
        console.warn(`GrimTag.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimTag("[TODO CanTag maker broken somehow]");
    }
}

// Var(x) --> prints as itself, so x := Var("x") would print as 'Var(x)' or 'x' without the quotes
//   so for use in a CAS, define all single-letter variables:
//      a := Var("a") and b:= Var("b") ... z := Var("z")
//      and alpha := Var("alpha") and beta := Var("beta") ... omega := Var("omega")
//      and Unicode: ⍺ := Var("⍺") and β := Var("β") ... ⍵ := Var("⍵")
//      ? even cooler(?) is that you could do z := CC("z") which is an unbound complex number variable
class GrimVar extends GrimVal {
    readonly value: string;
    constructor(value: string) {
        super();
        this.value = value;
    }

    // var has to evaluate with Var tag in place, so it does not turn into a symbol
    // after multiple evaluations
    // but the future .toMathString() will show the name of the variable
    // also for the purposes of a CAS, all lowercase letters will be bound to Var("a") ... Var("z")
    toString(): string {
        return `Var(${strOf(this.value)})`;
    }

    equals(other: GrimVal): boolean {
        if (other instanceof GrimVar) {
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

    isAtom(): boolean {
        return true;
    }

    head(): string {
        return "Var";
    }

    static maker(ast: CanAst | Array<GrimVal>): GrimVal {
        if (Array.isArray(ast)) {
            if (ast.length !== 1 || !(ast[0] instanceof GrimVar || ast[0] instanceof GrimStr)) {
                console.warn(`GrimVar.maker received unexpected array length, or item is not a variable: ${ast.length}`);
                return new GrimError(["NOPE_CanVar"]);
            }
            // already a GrimVar, just return it
            if (ast[0] instanceof GrimVar) {
                return ast[0];
            }
            if (ast[0] instanceof GrimStr) {
                return new GrimVar(ast[0].value);
            }
        }
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Var" && ast.args.length === 1) {
            const arg = ast.args[0];
            if (arg instanceof CanStr) {
                return new GrimVar(arg.str);
            }
        }
        console.warn(`GrimVar.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimError(["NOPE_CanVar"]);
    }
}

class GrimSym extends GrimVal {
    readonly value: string;
    constructor(value: string) {
        super();
        this.value = value;
    }

    toString(): string {
        return `Sym(${strOf(this.value)})`;
    }

    equals(other: GrimVal): boolean {
        if (other instanceof GrimSym) {
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

    isAtom(): boolean {
        return false; // it does not evaluate to itself, it is a symbol looked up in the environment
    }

    head(): string {
        return "Sym";
    }

    static maker(ast: CanAst | Array<GrimVal>): GrimVal {
        if (Array.isArray(ast)) {
            if (ast.length !== 1) {
                console.warn(`GrimSym.maker expects a single symbol or string: ${ast.length}`);
                return new GrimError(["NOPE_CanSym"]);
            }
            if (ast[0] instanceof GrimSym) {
                return ast[0];
            }
            if (ast[0] instanceof GrimStr) {
                return new GrimSym(ast[0].value);
            }
            console.warn(`GrimSym.maker expects a GrimSym or GrimStr, got: ${ast[0].constructor.name}`);
            return new GrimError(["NOPE_CanSym"]);
        }
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Sym" && ast.args.length === 1) {
            const arg = ast.args[0];
            if (arg instanceof CanStr) {
                return new GrimSym(arg.str);
            }
        }
        console.warn(`GrimSym.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimError(["NOPE_CanSym"]);
    }
}

export { GrimTag, GrimVar, GrimSym };
