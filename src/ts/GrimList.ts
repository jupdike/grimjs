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

    head(): string {
        return "List";
    }

    // Additional methods can be added as needed
}

export { GrimList };
