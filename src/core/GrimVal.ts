// Import CanAst types from parser module
import { CanAst, CanStr, CanTag, CanApp, CanTaggedApp } from '../parser/CanAst.js';

// Legacy interface for backward compatibility during transition
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
    if (x == null || x === undefined) {
        return '<UNDEFINED/or/NULL>'; // empty string if null or undefined
    }
    // use single quotes sometimes and don't escape double quotes in that case
    if(x.indexOf('"') >= 0) {
        return "'" + strEscape(x).replace(/[\\]"/g, '"') + "'";
    }
    // just use double quotes by default normally
    return '"' + strEscape(x) + '"'; // use double quotes
}

class GrimVal {

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

    toString(): string {
        return '';
    }

    toCanonicalString(): string {
        // Default canonical string representation, can be overridden by specific GrimVal subclasses
        return this.toString();
    }

    isAtom(): boolean {
        return true; // Default implementation, can be overridden
    }

    head(): string {
        return "<INVALID>"; // Default implementation, must be overridden
    }
}

export { AstJson, GrimVal, strOf };
