import { GrimVal, AstJson, Location, locToStr } from "./GrimVal.js";

class GrimAst extends GrimVal {
    constructor(private ast: AstJson | string) {
        super();
        if (typeof ast === "string") {
            this.tag = "Str";
            this.location = { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } };
            this.children = [ast]; // assuming ast is a string
            return;
        }
        this.tag = ast.tag;
        this.location = ast.location;
        // console.log("GrimAst constructor called with ast:", JSON.stringify(ast, null, 2));
        // console.log("GrimAst constructor called with ast.children:", ast.children);
        this.children = ast.children.map((child) => {
            if (typeof(child) === typeof("")) {
                //@ts-ignore
                return ""+child; // checked that a child is a string
            }
            return new GrimAst(child);
        });
    }
    tag: string;
    location: Location;
    children: Array<GrimVal | string>;

    // TODO think about this
    isAtom(): boolean {
        throw new Error("isAtom() not implemented for GrimAst");
    }
    // TODO test this
    toString(): string {
        return `GrimAst(${this.tag}, ${locToStr(this.location)}, [${this.children.map(arg => arg.toString()).join(', ')}])`;
    }

    head(): string { return this.tag; }
}

export { GrimAst };
