import { GrimVal, AstJson } from "./GrimVal.js";

class GrimOpt extends GrimVal {
    private value: GrimVal | null;

    static None: GrimOpt = new GrimOpt(null);

    constructor(value: GrimVal | null) {
        super();
        this.value = value;
    }

    toString(): string {
        return this.value ? `Some(${this.value.toString()})` : "None";
    }

    isAtom(): boolean {
        return false; // Options are not considered atoms
    }

    head(): string {
        return "Option";
    }
}

export { GrimOpt };
