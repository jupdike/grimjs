import { List, Set, Map } from "immutable";
import { GrimVal, AstJson } from "./GrimVal.js";
import { CanTaggedApp, CanStr, CanAst } from "../parser/CanAst.js";
import { GrimStr } from "./GrimStr.js";
import { GrimBool } from "./GrimBool.js";
import { GrimTag, GrimVar } from "./GrimAst.js";
import { GrimDec, GrimNat } from "./GrimNum.js";
import { GrimError } from "./GrimOpt.js";
import { Builder } from "./Builder.js";

class GrimList extends GrimVal {
    private list: List<GrimVal>;

    static Empty: GrimList = new GrimList();

    constructor(collection?: Iterable<GrimVal> | ArrayLike<GrimVal>) {
        super();
        this.list = List(collection);
    }

    asArray(): GrimVal[] {
        return this.list.toArray();
    }

    toString(): string {
        return `[${this.list.map(item => item.toString()).join(", ")}]`;
    }

    isAtom(): boolean {
        return false; // Lists are not considered atoms
    }

    head(): string {
        return "List";
    }

    static maker(ast: CanAst, builder: Builder): GrimVal {
        if (ast instanceof CanTaggedApp && ast.tag.tag === "List") {
            const elements = ast.args.map(arg => builder.fromAst(arg));
            return new GrimList(elements);
        }
        console.warn(`GrimList.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimList(); // Return empty list as fallback
    }
}

class GrimTuple extends GrimVal {
    private tuple: List<GrimVal>;

    // no Empty tuple

    constructor(collection: Iterable<GrimVal> | ArrayLike<GrimVal>) {
        super();
        if (Array.isArray(collection) && collection.length === 0) {
            throw new Error("Empty tuples are not allowed");
        }
        this.tuple = List(collection);
    }

    toString(): string {
        return `(${this.tuple.map(item => item.toString()).join(", ")}${this.tuple.size > 1 ? "" : ","})`;
    }

    isAtom(): boolean {
        return false; // Tuples are not considered atoms
    }

    head(): string {
        return "Tuple";
    }

    static maker(ast: CanAst, builder: Builder): GrimVal {
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Tuple") {
            if (ast.args.length === 0) {
                throw new Error("Empty tuples are not allowed in Grim");
            }
            const elements = ast.args.map(arg => builder.fromAst(arg));
            return new GrimTuple(elements);
        }
        console.warn(`GrimTuple.maker received unexpected AST type: ${ast.constructor.name}`);
        throw new Error("Invalid tuple AST");
    }
}

class GrimMap extends GrimVal {
    private map: Map<GrimVal, GrimVal>;

    constructor(entries?: [GrimVal, GrimVal][]) {
        super();
        this.map = Map(entries);
    }

    toString(): string {
        return `{${Array.from(this.map.entries()).map(([key, value]) => `${key.toString()}: ${value.toString()}`).join(", ")}}`;
    }

    isAtom(): boolean {
        return false; // Maps are not considered atoms
    }

    head(): string {
        return "Map";
    }

    private static keyToString(key: CanAst, builder: Builder): GrimVal {
        if (key instanceof CanStr) {
            return new GrimStr(key.str);
        }
        // special case for CanTaggedApp where the tag is a Sym
        if (key instanceof CanTaggedApp) {
            // like JavaScript, not Python, so keys turn from Sym("key") to Str("key")
            // instead of being looked up as a variable in the environment before being used as a key
            if (key.tag.tag === "Sym" && key.args.length === 1 && key.args[0] instanceof CanStr) {
                return new GrimStr((key.args[0] as CanStr).str); // Convert to string representation
            }
        }
        return builder.fromAst(key);
    }

    static maker(ast: CanAst, builder: Builder): GrimVal {
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Map") {
            const entries: [GrimVal, GrimVal][] = [];
            
            for (const arg of ast.args) {
                if (arg instanceof CanTaggedApp && arg.tag.tag === "Tuple" && arg.args.length === 2) {
                    const key = GrimMap.keyToString(arg.args[0], builder);
                    const value = builder.fromAst(arg.args[1]);
                    entries.push([key, value]);
                } else {
                    return new GrimError(["Invalid Map entry, expected Pair but got: ", arg.toString()]);
                }
            }
            
            return new GrimMap(entries);
        }
        console.warn(`GrimMap.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimError(["Invalid Map AST"]);
    }
}

class GrimSet extends GrimVal {
    private set: Set<GrimVal>;

    constructor(collection?: Iterable<GrimVal> | ArrayLike<GrimVal>) {
        super();
        this.set = Set(collection);
    }

    toString(): string {
        return `Set(${Array.from(this.set).map(item => item.toString()).join(", ")})`;
    }

    isAtom(): boolean {
        return false; // Sets are not considered atoms
    }

    head(): string {
        return "Set";
    }

    static maker(ast: CanAst, builder: Builder): GrimVal {
        if (ast instanceof CanTaggedApp && ast.tag.tag === "Set") {
            const elements = ast.args.map(arg => builder.fromAst(arg));
            return new GrimSet(elements);
        }
        console.warn(`GrimSet.maker received unexpected AST type: ${ast.constructor.name}`);
        return new GrimSet(); // Return empty set as fallback
    }
}

export { GrimList, GrimTuple, GrimMap, GrimSet };
