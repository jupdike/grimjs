import { GrimVal } from "./GrimVal.js";

class GrimNat extends GrimVal {
    constructor(private value: number | string) {
        super();
        if (typeof value === "string") {
            this.value = parseInt(value, 10);
            if (isNaN(this.value)) {
                throw new Error(`Invalid number string: ${value}`);
            }
        }
        else if (typeof value === "number") {
            this.value = value;
        }
        else if (typeof value !== "number") {
            throw new Error(`Invalid type for GrimNum: ${typeof value}. Expected number or string.`);
        }
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

export { GrimNat };
