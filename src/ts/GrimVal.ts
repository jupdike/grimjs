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

function locToStr(loc) {
  if(!loc) {
    return "unknown location";
  }
  return `line ${loc.start.line} col ${loc.start.column} to line ${loc.end.line} col ${loc.end.column}`;
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

export { Location, AstJson, GrimVal, locToStr, strOf };
