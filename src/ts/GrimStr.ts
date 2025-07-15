import { GrimVal, strOf } from "./GrimVal.js";

class GrimStr extends GrimVal {
    // TODO use strOf from ast.js
    constructor(private value: string) {
        super();
    }

    toString(): string {
        return strOf(this.value);
    }
    isAtom(): boolean {
        return true;
    }
    head(): string {
        return "Str";
    }
}

export { GrimStr };
