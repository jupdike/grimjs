import { Map, List, Set } from "immutable";

import { GrimVal, AstJson, locToStr, strOf } from "./GrimVal.js";
import { CanAst, CanTag, CanTaggedApp, CanStr } from "../parser/CanAst.js";
import type { Location } from "../parser/CanAst.js";
import { GrimBool } from "./GrimBool.js";
import { GrimOpt, GrimError } from "./GrimOpt.js";

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

    // this needs to get moved to Builder
    // isCallable(): boolean {
    //     // some tags are callable
    //     if (GrimVal.makerMap.has(this.value) || GrimTag.callableTagMethodIsAvailable.has(this.value)) {
    //         return true;
    //     }
    //     return false;
    // }
    isCallable(): boolean {
        return true;  // for now, GrimTag is callable, until we implement a better system
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

    static maker(ast: CanAst): GrimVal {
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

    // canonical
    // toString(): string {
    //     return `Var(${strOf(this.name)})`;
    // }

    toString(): string {
        return this.value;
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

    static maker(ast: CanAst): GrimVal {
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

    static maker(ast: CanAst): GrimVal {
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
