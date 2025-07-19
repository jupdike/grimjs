import { GrimVal, AstJson, Location, locToStr, strOf } from "./GrimVal.js";
import { GrimBool } from "./GrimBool.js";
import { GrimOpt } from "./GrimOpt.js";

class GrimAst extends GrimVal {
    constructor(private ast: AstJson | string) {
        super();
        if (typeof ast === "string") {
            this.tag = "Str";
            this.location = { source: null, start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };
            this.children = [ast]; // assuming ast is a string
            return;
        }
        this.tag = ast.tag;
        this.location = ast.location;
        // console.log("GrimAst constructor called with ast:", JSON.stringify(ast, null, 2));
        // console.log("GrimAst constructor called with ast.children:", ast.children);
        this.children = ast.children.map((child) => {
            if (typeof(child) === typeof("")) {
                //@ts-ignore
                return ""+child; // checked that a child is a string
            }
            return new GrimAst(child);
        });
    }
    tag: string;
    location: Location;
    children: Array<GrimVal | string>;

    // TODO think about this
    isAtom(): boolean {
        throw new Error("isAtom() not implemented for GrimAst");
    }
    // TODO test this
    toString(): string {
        return `GrimAst(${this.tag}, ${locToStr(this.location)}, [${this.children.map(arg => arg.toString()).join(', ')}])`;
    }

    head(): string { return this.tag; }
}

class GrimTag extends GrimVal {
    constructor(private value: string) {
        super();
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

    static maker(children: Array<AstJson | string>): GrimVal {
        //console.log('Parsed AST JSON ***:', JSON.stringify(ast, null, 2));
        // a few special built-in tags that are self-evaluating
        if(children && children.length == 1 && children[0] === "True") {
            return GrimBool.True;
        }
        if(children && children.length == 1 && children[0] === "False") {
            return GrimBool.False;
        }
        if(children && children.length == 1 && children[0] === "None") {
            return GrimOpt.None;
        }
        if(children && children.length == 1 && typeof children[0] === "string") {
            return new GrimTag(children[0]);
        }
        if(children && children.length == 1 && typeof children[0] === "object" &&
            children[0].tag === "Str" && children[0].children && children[0].children.length === 1 &&
            typeof children[0].children[0] === "string") {
            return new GrimTag(children[0].children[0]);
        }
        console.warn(`No maker found for Tag with children: ${JSON.stringify(children, null, 2)}`);
        return new GrimTag("[TODO Tag maker broken somehow]");
    }
}

// Var(x) --> prints as itself, so x := Var("x") would print as 'Var(x)' or 'x' without the quotes
//   so for use in a CAS, define all single-letter variables:
//      a := Var("a") and b:= Var("b") ... z := Var("z")
//      and alpha := Var("alpha") and beta := Var("beta") ... omega := Var("omega")
//      and Unicode: ⍺ := Var("⍺") and β := Var("β") ... ⍵ := Var("⍵")
//      ? even cooler(?) is that you could do z := CC("z") which is an unbound complex number variable
class GrimVar extends GrimVal {
    constructor(private value: string) {
        super();
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

    static maker(children: Array<AstJson | string>): GrimVal {
        if (children.length === 1 && typeof children[0] === "string") {
            return new GrimVar(children[0]);
        }
        if (children.length === 1 && typeof children[0] === "object"
            && children[0].tag === "Str" && children[0].children
            && children[0].children.length === 1 && typeof children[0].children[0] === "string") {
            return new GrimVar(children[0].children[0]);
        }
        return new GrimAst("NOPE_GrimVar");
    }
}

class GrimSym extends GrimVal {
    constructor(private value: string) {
        super();
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
        return true;
    }

    head(): string {
        return "Sym";
    }

    static maker(children: Array<AstJson | string>): GrimVal {
        if (children.length === 1 && typeof children[0] === "string") {
            return new GrimVar(children[0]);
        }
        if (children.length === 1 && typeof children[0] === "object"
            && children[0].tag === "Str" && children[0].children
            && children[0].children.length === 1 && typeof children[0].children[0] === "string") {
            return new GrimVar(children[0].children[0]);
        }
        return new GrimAst("NOPE_GrimSym");
    }
}

export { GrimAst, GrimTag, GrimVar, GrimSym };
