import { List, Set, Map } from "immutable";
import { GrimVal, AstJson } from "./GrimVal.js";
import { GrimStr } from "./GrimStr.js";
import { GrimBool } from "./GrimBool.js";
import { GrimTag, GrimVar } from "./GrimAst.js";
import { GrimDec, GrimNat } from "./GrimNum.js";
import { GrimError } from "./GrimOpt.js";

class GrimList extends GrimVal {
    private list: List<GrimVal>;

    static Empty: GrimList = new GrimList();

    constructor(collection?: Iterable<GrimVal> | ArrayLike<GrimVal>) {
        super();
        this.list = List(collection);
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

    static maker(children: Array<AstJson | string>): GrimVal {
        //console.log('LIST: Parsed AST JSON >>>***:', JSON.stringify(children, null, 2));
        return new GrimList(children.map(child => {
            if (typeof child === "string") {
                return new GrimStr(child);
            }
            // is this even necessary?
            if (typeof child === "object" && child.tag === "Str" && child.children &&
                child.children.length === 1 && typeof child.children[0] === "string") {
                return new GrimStr(child.children[0]);
            }
            // handle other types
            return GrimVal.fromAst(child);
        }));
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

    static maker(children: Array<AstJson | string>): GrimVal {
        //console.log('TUPLE: Parsed AST JSON >>>***:', JSON.stringify(children, null, 2));
        if (children.length === 0) {
            throw new Error("Empty tuples are not allowed in Grim");
        }
        return new GrimTuple(children.map(child => {
            if (typeof child === "string") {
                return new GrimStr(child);
            }
            // is this even necessary?
            if (typeof child === "object" && child.tag === "Str" && child.children &&
                child.children.length === 1 && typeof child.children[0] === "string") {
                return new GrimStr(child.children[0]);
            }
            // handle other types
            return GrimVal.fromAst(child);
        }));
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

    static maker(children: Array<AstJson | string>): GrimVal {
        // console.log('MAP: Parsed AST JSON >>>***:', JSON.stringify(children, null, 2));
        function keyToString(key: AstJson | string): GrimVal {
            if (typeof key === "string") {
                return new GrimStr(key);
            }
            let keyVal = GrimVal.fromAst(key);
            if (keyVal instanceof GrimVar) {
                return new GrimStr(keyVal.toString()); // Convert to string representation
            }
            if (keyVal instanceof GrimStr || keyVal instanceof GrimNat || keyVal instanceof GrimDec ||
                keyVal instanceof GrimBool || keyVal instanceof GrimTag) {
                return keyVal;
            }
            if (keyVal instanceof GrimTuple) {
                return keyVal;
            }
            return new GrimStr("[Invalid Key: " + keyVal.toString() + "]");
        }
        let entries: [GrimVal, GrimVal][] = [];
        for (let child of children) {
            if (typeof child === "object" &&
                (child.tag === "Pair" || child.tag === "List" || child.tag === "Tuple")
                && child.children
                && child.children.length === 2
            ) {
                let key = keyToString(child.children[0]);
                let value =
                    typeof child.children[1] == "string"
                    ? new GrimStr(child.children[1])
                    : GrimVal.fromAst(child.children[1]);
                entries.push([key, value]);
            }
        }
        if (entries.length !== children.length) {
            return new GrimError(["Invalid Map, expected pairs of key-value, but got: ", JSON.stringify(children)]);
        }
        return new GrimMap(entries);
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

    static maker(children: Array<AstJson | string>): GrimVal {
        let elements: GrimVal[] = [];
        for (let child of children) {
            if (typeof child === "string") {
                elements.push(new GrimStr(child));
            } else {
                elements.push(GrimVal.fromAst(child));
            }
        }
        return new GrimSet(List(elements));
    }
}

export { GrimList, GrimTuple, GrimMap, GrimSet };
