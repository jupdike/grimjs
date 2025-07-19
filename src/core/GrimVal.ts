// Import CanAst types from parser module
import { CanAst, CanStr, CanTag, CanApp, CanTaggedApp } from '../parser/CanAst.js';
import type { Location } from '../parser/CanAst.js';

// Legacy interface for backward compatibility during transition
interface AstJson {
    tag: string;
    location: Location;
    children: Array<AstJson | string>;
}

function locToStr(loc: Location | undefined): string {
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
type CanAstToVal = (ast: CanAst) => GrimVal;

class GrimVal {
    static makerMap: Map<string, AstToVal> = new Map();
    static canAstMakerMap: Map<string, CanAstToVal> = new Map();

    static maker(children: Array<AstJson | string>): GrimVal {
        // Default maker, can be overridden by specific GrimVal subclasses
        return new GrimVal();
    }

    static canAstMaker(ast: CanAst): GrimVal {
        // Default CanAst maker, can be overridden by specific GrimVal subclasses
        return new GrimVal();
    }

    hashCode(): number {
        // useful to see if equals() testing can help us avoid calls to hashCode() when possible
        //console.log(`CALLED Hash code for ${this.toString()}: ${hash}`);
        //
        // Default hash code, can be overridden by specific GrimVal subclasses
        let str = this.toString();
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0; // Convert to 32-bit integer
        }
        return hash;
    }

    equals(other: GrimVal): boolean {
        if (this === other) {
            return true; // Same reference
        }
        // Default equality check, can be overridden by specific GrimVal subclasses
        //console.log(`CALLED equals for ${this.toString()} and ${other.toString()}`);
        return this.hashCode() === other.hashCode();
    }

    static fromCanAst(ast: CanAst): GrimVal {
        // Type-safe CanAst processing
        if (ast instanceof CanStr) {
            // String literal
            const maker = GrimVal.canAstMakerMap.get("Str");
            return maker ? maker(ast) : new GrimVal();
        }
        
        if (ast instanceof CanTag) {
            // Tag literal 
            const maker = GrimVal.canAstMakerMap.get("Tag");
            return maker ? maker(ast) : new GrimVal();
        }
        
        if (ast instanceof CanApp) {
            // Function application
            const maker = GrimVal.canAstMakerMap.get("@");
            return maker ? maker(ast) : new GrimVal();
        }
        
        if (ast instanceof CanTaggedApp) {
            // Tagged application - use the tag to determine the maker
            const tagName = ast.tag.tag;
            const maker = GrimVal.canAstMakerMap.get(tagName);
            return maker ? maker(ast) : new GrimVal();
        }
        
        console.warn(`No CanAst maker found for AST type: ${ast.constructor.name}`);
        return new GrimVal();
    }

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
        if (!maker || ast.tag === "@") {
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
                    //@ts-ignore <-- constructor to GrimApp expects a string or AstJson, will handle this for us
                    //children = [head].concat(ast.children.slice(1)); // Use the rest of the children
                    //console.log("33:", head.tag, "children:", children);
                    // If the first child is an object, this is a true apply, not Tag(x,y,z), probably
                    //console.log('2 Using first child object tag for maker lookup:', head.tag);
                    maker = GrimVal.makerMap.get("@");
                    if (maker) {
                        return maker(ast.children);
                    }
                }
                else if (head && typeof head === "object" && head.tag && head.tag === "Tag" && head.children && head.children.length > 0) {
                    let h2 = head.children[0];
                    if (h2 && typeof h2 === "string") {
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
        // code to try to handle the case where the first child is a tag but it's not built-in
        function myStr(s: string): AstJson {
            return { tag: "Str", location: ast.location, children: [s] };
        }
        if (!maker) {
            if (ast.children.length > 0) {
                let head = { children: [ast.tag], location: ast.location, tag: "Tag" } as AstJson;
                // cannot call GrimApp from here, because it is cannot be imported without circular dependency issues
                let makeApp = GrimVal.makerMap.get("App");
                //let makeTag = GrimVal.makerMap.get("Tag");
                if (makeApp) {
                    return makeApp([head].concat(
                        ast.children.map(child => typeof child === 'string' ? myStr(child) : child
                    )));
                } else {
                    console.warn(`No maker found for App, this should never happen, returning default GrimVal`);
                    return new GrimVal();
                }
            }
        }
        // we found a built-in maker, so use it
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

export { AstJson, GrimVal, locToStr, strOf };
export type { Location };
