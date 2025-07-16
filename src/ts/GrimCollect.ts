import { List } from "immutable";
import { GrimVal, AstJson } from "./GrimVal.js";

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

    // Additional methods can be added as needed
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

    // Additional methods can be added as needed
}

class GrimMap extends GrimVal {
    private map: Map<GrimVal, GrimVal>;

    constructor(entries?: [GrimVal, GrimVal][]) {
        super();
        this.map = new Map(entries);
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

    // Additional methods can be added as needed
}

export { GrimList, GrimTuple, GrimMap };
