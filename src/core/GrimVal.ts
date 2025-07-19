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

type AstToVal = (ast: CanAst) => GrimVal;

class GrimVal {
    static makerMap: Map<string, AstToVal> = new Map();

    static maker(ast: CanAst): GrimVal {
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

    static fromAst(ast: CanAst): GrimVal {
        if (ast instanceof CanStr) {
            // String literal
            const maker = GrimVal.makerMap.get("Str");
            return maker ? maker(ast) : new GrimVal();
        }
        if (ast instanceof CanTag) {
            // Tag literal 
            const maker = GrimVal.makerMap.get("Tag");
            return maker ? maker(ast) : new GrimVal();
        }
        if (ast instanceof CanApp) {
            // Function application
            const maker = GrimVal.makerMap.get("@");
            return maker ? maker(ast) : new GrimVal();
        }
        if (ast instanceof CanTaggedApp) {
            // Tagged application - use the tag to determine the maker
            const tagName = ast.tag.tag;
            const maker = GrimVal.makerMap.get(tagName);
            if (!maker) {
                const appMaker = GrimVal.makerMap.get("@");
                const tagMaker = GrimVal.makerMap.get("Tag");
                if (appMaker && tagMaker) {
                    return appMaker(
                        new CanApp(ast.location, new CanTag(ast.location, tagName), ast.args)
                    );
                }
            }
            return maker ? maker(ast) : new GrimVal();
        }
        
        if(!ast) {
            console.warn("GrimVal.fromAst received undefined or null AST");
            return new GrimVal();
        }
        console.warn(`No CanAst maker found for AST type: ${ast.constructor.name}`);
        return new GrimVal();
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
