import { GrimVal } from "./GrimVal.js";

class GrimNum extends GrimVal {
    constructor(private value: number) {
        super();
    }

    toString(): string {
        return this.value.toString();
    }

    isAtom(): boolean {
        return true;
    }

    head(): string {
        return "Natural";
    }
}

export { GrimNum };
