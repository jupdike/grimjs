import { GrimVal } from "./GrimVal.js";
import { AstJson } from "./GrimVal.js";
import { GrimAst } from "./GrimAst.js";

class GrimBool extends GrimVal {
    static True = new GrimBool();
    static False = new GrimBool(false);

    private value: boolean;

    public constructor(value: boolean = true) {
        super();
        this.value = value;
    }

    toString(): string {
        return this.value ? 'True' : 'False';
    }

    isTrue() : boolean { return this.value;  }
    isFalse(): boolean { return !this.value; }

    static Eq(a: GrimBool, b: GrimBool): GrimBool {
        return new GrimBool(a.isTrue() === b.isTrue());
    }

    static maker(children: Array<AstJson | string>): GrimVal {
        if (children[0] === "True") {
            return GrimBool.True;
        }
        if (children[0] === "False") {
            return GrimBool.False;
        }
        if (children.length === 1 && typeof children[0] === "string") {
            // console.log('Parsed AST JSON <> <> *** <> <>:', JSON.stringify(children, null, 2));
            // If it's a string, we can assume it's a boolean value
            return new GrimBool(children[0] === "True");
        }
        if (children.length === 1 && typeof children[0] === "object"
            && children[0].tag === "Str" && children[0].children
            && children[0].children.length === 1 && typeof children[0].children[0] === "string") {
            // console.log('Parsed AST JSON <> <> *** <> <>:', JSON.stringify(children, null, 2));
            // If it's a string, we can assume it's a boolean value
            return new GrimBool(children[0].children[0] === "True");
        }
        return new GrimAst("NOPE");
    }
}

export { GrimBool };
