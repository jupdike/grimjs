import { GrimVal } from "./GrimVal.js";

class GrimNat extends GrimVal {
    constructor(private value: number | string) {
        super();
        if (typeof value === "string") {
            this.value = value.trim();
        }
        else if (typeof value === "number") {
            this.value = value;
        }
        else {
            throw new Error(`Invalid type for GrimNat: ${typeof value}. Expected number or string.`);
        }
    }

    toString(): string {
        return this.value.toString();
    }

    isAtom(): boolean {
        return true;
    }

    head(): string {
        return "Nat";
    }
}

class GrimDec extends GrimVal {
    constructor(private value: number | string) {
        super();
        if (typeof value === "string") {
            this.value = value.trim();
        }
        else if (typeof value === "number") {
            this.value = value;
        }
        else {
            throw new Error(`Invalid type for GrimDec: ${typeof value}. Expected number or string.`);
        }
    }

    toString(): string {
        return this.value.toString();
    }

    isAtom(): boolean {
        return true;
    }

    head(): string {
        return "Dec";
    }
}

export { GrimNat, GrimDec };
