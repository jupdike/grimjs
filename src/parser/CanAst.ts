interface Location {
    source: string; // file name or other source identifier
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

// CanAst = CanStr | CanTag | CanApp | CanTaggedApp

class CanStr extends CanAst {
    public str: string;
    constructor(str: string, location: Location) {
        super(location);
        this.str = str;
    }
}

class CanTag extends CanAst {
    public tag: string;
    constructor(tag: string, location: Location) {
        super(location);
        this.tag = tag;
    }
}

class CanApp extends CanAst {
    public fun: CanAst;
    public args: Array<CanAst>;
    constructor(fun: CanAst, args: Array<CanAst>, location: Location) {
        super(location);
        this.fun = fun;
        this.args = args;
    }
}

class CanTaggedApp extends CanAst {
    public tag: CanTag;
    public args: Array<CanAst>;
    constructor(tag: CanTag, args: Array<CanAst>, location: Location) {
        super(location);
        this.tag = tag;
        this.args = args;
    }
    static from(tagStr: string, args: Array<CanAst>, location: Location): CanTaggedApp {
        const tag = new CanTag(tagStr, location);
        return new CanTaggedApp(tag, args, location);
    }
}

export { Location, CanAst, CanStr, CanTag, CanApp, CanTaggedApp };
