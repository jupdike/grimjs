interface Location {
    source: string | null; // file name or other source identifier
    start: {
        line: number;
        column: number;
    };
    end: {
        line: number;
        column: number;
    };
}

// Canonical AST classes for GrimJS
// This form is super easy to write a parser for because it is just
//   Tags   (which are strings, but not quoted and start with a capital letter)
//   Strings   (which are single or double quoted)
//   and   Applications (which are is an AST on the left, and a comma-separated list/array/vector of zero-or more AST arguments for the RHS)
//         (the second application form is just a shorthand for a tagged application)
// Numbers are represented as strings in the AST, so they can be parsed later

// These classes are used to represent the AST in a more canonical form,
// which is useful for various transformations and analyses.
// They are not used for evaluation directly, but rather as a way to represent
// the structure of the code in a more abstract and typesafe way.
class CanAst {
    location: Location;
    toString(): string {
        return "CanAst--BUG--subclass should override toString()";
    }
    constructor(location: Location) {
        this.location = location
    }
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
    if(typeof x !== 'string') {
        console.warn(`strOf called with non-string value: ${x}`);
        return '<INVALID_STRING>'; // handle non-string cases gracefully
    }
    // use single quotes sometimes and don't escape double quotes in that case
    if(x.indexOf('"') >= 0) {
        return "'" + strEscape(x).replace(/[\\]"/g, '"') + "'";
    }
    // just use double quotes by default normally
    return '"' + strEscape(x) + '"'; // use double quotes
}

// CanAst = CanStr | CanTag | CanApp | CanTaggedApp

class CanStr extends CanAst {
    public str: string;
    constructor(location: Location, str: string) {
        super(location);
        this.str = str;
    }
    toString(): string {
        return strOf(this.str);
    }
}

class CanTag extends CanAst {
    public tag: string;
    constructor(location: Location, tag: string) {
        super(location);
        if (typeof tag !== "string") {
            throw new Error(`CanTag -- Invalid tag: ${tag}`);
        }
        this.tag = tag;
    }
    toString(): string {
        return this.tag; // just the tag name, no quotes
    }
}

class CanApp extends CanAst {
    public fun: CanAst;
    public args: Array<CanAst>;
    constructor(location: Location, fun: CanAst, args: Array<CanAst>) {
        super(location);
        this.fun = fun;
        this.args = args;
    }
    toString(): string {
        return `${this.fun.toString()}@(${this.args.map(arg => arg.toString()).join(", ")})`;
    }
}

class CanTaggedApp extends CanAst {
    public tag: CanTag;
    public args: Array<CanAst>;
    constructor(location: Location, tag: CanTag, args: Array<CanAst>) {
        super(location);
        this.tag = tag;
        this.args = args;
    }
    static from(location: Location, tagStr: string, args: Array<CanAst>): CanTaggedApp | CanTag {
        if (tagStr === "Tag" && args.length === 1 && args[0] instanceof CanStr) {
            return new CanTag(location, args[0].str);
        }
        const tag = new CanTag(location, tagStr);
        return new CanTaggedApp(location, tag, args);
    }
    toString(): string {
        return `${this.tag.toString()}(${this.args.map(arg => arg.toString()).join(", ")})`;
    }
}

function aTag(location: Location, tagStr: string): CanTag {
    if (typeof tagStr !== "string") {
        throw new Error(`aTag -- Invalid tag: ${tagStr}`);
    }
    return new CanTag(location, tagStr);
}
function aStr(location: Location, str: string): CanStr {
    return new CanStr(location, str);
}
function aApp(location: Location, fun: CanAst, args: Array<CanAst>): CanApp {
    return new CanApp(location, fun, args);
}
function aTagApp(location: Location, tagStr: string, args: Array<CanAst>): CanTaggedApp | CanTag {
    if (typeof tagStr !== "string") {
        throw new Error(`aTagApp -- Invalid tag: ${tagStr}`);
    }
    return CanTaggedApp.from(location, tagStr, args);
}

export { CanAst, CanStr, CanTag, CanApp, CanTaggedApp, aTag, aStr, aApp, aTagApp };
export type { Location };
