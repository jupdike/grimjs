import { GrimVal } from "./GrimVal.js";
import { AstJson } from "./GrimVal.js";
import { CanTaggedApp, CanStr, CanAst } from "../parser/CanAst.js";
import { GrimError } from "./GrimOpt.js";

class GrimBool extends GrimVal {
    static True = new GrimBool();
    static False = new GrimBool(false);

    private value: boolean;

    isAtom(): boolean {
        return true; // GrimBool is an atom
    }

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

    static maker(ast: CanAst): GrimVal {
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Bool" && ast.args.length === 1) {
            const arg = ast.args[0];
            if (arg instanceof CanStr) {
                return new GrimBool(arg.str === "True");
            }
        }
        console.warn(`GrimBool.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimError(["NOPE_CanBool"]);
    }
}

export { GrimBool };
