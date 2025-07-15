import { GrimVal } from "./GrimVal.js";

class GrimBool extends GrimVal {
    static True = new GrimBool();
    static False = new GrimBool(false);

    private value: boolean;

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
}

export { GrimBool };
