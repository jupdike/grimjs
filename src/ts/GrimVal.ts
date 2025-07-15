import parser from  "../parser.js"
import { Ast } from "../ast.js"

interface Location {
    start: {
        line: number;
        column: number;
    };
    end: {
        line: number;
        column: number;
    };
}

interface AstJson {
    tag: string;
    location: Location;
    children: Array<AstJson | string>;
}

function strEscape(str: string): string {
    // Escapes backslashes and double quotes
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
// copied from ast.js, so keep those in sync manually
function strOf(x: string): string {
    // use single quotes sometimes and don't escape double quotes in that case
    if(x.indexOf('"') >= 0) {
        return "'" + strEscape(x).replace(/[\\]"/g, '"') + "'";
    }
    // just use double quotes by default normally
    return '"' + strEscape(x) + '"'; // use double quotes
}

type AstToVal = (ast: Array<AstJson | string>) => GrimVal;

class GrimVal {
    static makerMap: Map<string, AstToVal> = new Map();

    static fromAst(ast: AstJson): GrimVal {
        if (!ast || !ast.tag) {
            console.log("=== AST:");
            console.log(ast);
            console.log("===");
            throw new Error("Invalid AST provided to GrimVal.fromAst");
        }
        //console.log('GrimVal.fromAst called with AST:', JSON.stringify(ast, null, 2));

        let children: Array<AstJson | string> = ast.children || [];
        // Check if there's a specific maker for this type
        let maker = GrimVal.makerMap.get(ast.tag);
        if (!maker) {
            //console.warn(`No maker found for AST tag: ${ast.tag}`);
            if (ast.tag === "@" && ast.children && ast.children.length > 0) {
                let head = ast.children[0];
                if (head && typeof head === "string" && head !== "Tag") {
                    // If the first child is a string, use it as a tag
                    //console.log('1 Using first child string for maker lookup:', head);
                    maker = GrimVal.makerMap.get(head);
                    children = ast.children.slice(1); // Use the rest of the children
                }
                else if (head && typeof head === "object" && head.tag && head.tag !== "Tag") {
                    // If the first child is an object, use the tag itself
                    //console.log('2 Using first child object tag for maker lookup:', head.tag);
                    maker = GrimVal.makerMap.get(head.tag);
                    children = ast.children.slice(1); // Use the rest of the children
                }
                else if (head && typeof head === "object" && head.tag && head.tag === "Tag" && head.children && head.children.length > 0) {
                    let h2 = head.children[0];
                    if (h2 && typeof h2 === "string") {
                        //console.log('3 Using second child string for maker lookup:', h2);
                        maker = GrimVal.makerMap.get(h2);
                        children = ast.children.slice(1); // Use the rest of the children
                    }
                    else if (h2 && typeof h2 === "object" && h2.tag && h2.tag !== "Tag") {
                        // If the first child is an object, use the tag itself
                        //console.log('4 Using second child object tag for maker lookup:', h2.tag);
                        maker = GrimVal.makerMap.get(h2.tag);
                        children = ast.children.slice(1); // Use the rest of the children
                    }
                }
            }
        }
        if (maker) {
            return maker(children);
        } else {
            console.warn(`No maker found for AST tag: ${ast.toString()}, returning default GrimVal`);
            return new GrimVal();
        }
    }

    toString(): string {
        return '';
    }

    static isAtom(): boolean {
        return true; // Default implementation, can be overridden
    }

    head(): string {
        return "<INVALID>"; // Default implementation, must be overridden
    }
}

// TODO
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

class GrimInt extends GrimVal {
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
        return "Integer";
    }
}

class GrimStr extends GrimVal {
    // TODO use strOf from ast.js
    constructor(private value: string) {
        super();
    }

    toString(): string {
        return strOf(this.value);
    }
}

// class GrimTag extends GrimVal {
//     constructor(private value: string) {
//         super();
//     }

//     toString(): string {
//         return `Tag(${strOf(this.value)})`;
//     }

//     isAtom(): boolean {
//         return true;
//     }

//     head(): string {
//         return "Tag";
//     }
// }

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

console.log('GrimVal module loaded');

function locToStr(loc) {
  if(!loc) {
    return "unknown location";
  }
  return `line ${loc.start.line} col ${loc.start.column} to line ${loc.end.line} col ${loc.end.column}`;
}
function check(str: string, start: string | null = null, onlyErrors = false): AstJson {
    start = start || "Expr";
    try {
        var ret = parser.parse(str, {startRule: start});
        if (!onlyErrors) {
        console.log('---');
        console.log(str, '\n  ~~ parses as ~~>\n', ret.toString() );
        }
        return ret;
    } catch (e) {
        console.log('---');
        //console.log("Error", [e.message]);
        console.log(str, '  ~~ EXCEPTION THROWN as ~~>\n  ', `Error('${e.message}', '${locToStr(e.location)}')` );
        return Ast( e.location || 'unknown', "Error", [e.message] );
    }
}

function addMakers() {
    GrimVal.makerMap.set("Tag", (children: Array<AstJson | string>) => {
        //console.log('Parsed AST JSON ***:', JSON.stringify(ast, null, 2));
        if(children && children.length == 1 && children[0] === "True") {
            return GrimBool.True;
        }
        if(children && children.length == 1 && children[0] === "False") {
            return GrimBool.False;
        }
        // if(ast.args && ast.args.length == 1) {
        //     return new GrimTag(ast.args[0]); // assuming args[0] is a string
        // }
        return new GrimAst("NADA");
    });
    GrimVal.makerMap.set("Bool", (children: Array<AstJson | string>) => {
        // console.log('Parsed AST JSON 765 ***:', JSON.stringify(children, null, 2));
        if (children[0] === "True") {
            return GrimBool.True;
        }
        if (children[0] === "False") {
            return GrimBool.False;
        }
        if (children.length === 1 && typeof children[0] === "string") {
            // console.log('Parsed AST JSON <> <> *** <> <>:', JSON.stringify(children, null, 2));
            // If it's a string, we can assume it's a boolean value
            return new GrimBool(children[0] === "True");
        }
        if (children.length === 1 && typeof children[0] === "object"
            && children[0].tag === "Str" && children[0].children
            && children[0].children.length === 1 && typeof children[0].children[0] === "string") {
            // console.log('Parsed AST JSON <> <> *** <> <>:', JSON.stringify(children, null, 2));
            // If it's a string, we can assume it's a boolean value
            return new GrimBool(children[0].children[0] === "True");
        }
        return new GrimAst("NOPE");
    });
}
addMakers();

function analyzeOne(str: string) {
    let ast = check(str);
    //console.log('Parsed AST JSON    :', JSON.stringify(ast, null, 2));
    console.log('Parsed AST toString:', ast.toString());
    // TODO work on this
    let val = GrimVal.fromAst(ast);
    console.log('GrimVal from AST   :', val.toString());
}

analyzeOne("True");
analyzeOne("False");
analyzeOne('Bool("True")');
analyzeOne('Bool("False")');

export { GrimVal, GrimAst, GrimInt, GrimStr, GrimBool };
