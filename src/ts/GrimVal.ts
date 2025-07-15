import parser from  "../parser.js"
import "../ast.js"

interface Ast {
    type: string;
    location: string;
    args: Ast[];
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

class GrimVal {
    static atomMap: Map<string, typeof GrimVal> = new Map();

    static fromAst(ast: Ast): GrimVal {
        // if (ast.type === 'Str') {
        //     return new GrimVal(ast.args[0]);
        // } else if (ast.type === 'Id') {
        //     return new GrimVal(ast.args[0]);
        // } else {
        //     throw new Error(`Unsupported AST type: ${ast.type}`);
        // }
        // TODO this is a placeholder implementation
        return new GrimVal();
    }

    // subtypes need to implement this
    public constructor() {
        // Initialize any properties if needed
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
    constructor(private ast: Ast) {
        super();
    }
    type: string;
    location: string;
    args: Ast[];

    // TODO think about this
    isAtom(): boolean {
        throw new Error("isAtom() not implemented for GrimAst");
    }

    // TODO test this
    toString(): string {
        return `Ast(${this.ast.type}, ${this.ast.location}, [${this.ast.args.map(arg => arg.type).join(', ')}])`;
    }

    head(): string { return this.type; }
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

class GrimBool extends GrimVal {
    //static True = new GrimBool();
    //static False = new GrimBool(false);

    private value: boolean;

    // private constructor(private value: boolean) {
    //     super();
    // }

    public constructor() {
        super();
    }

    toString(): string {
        return this.value ? 'True' : 'False';
    }

    isTrue(): boolean {
        return this.value;
    }

    isFalse(): boolean {
        return !this.value;
    }

    static Eq(a: GrimBool, b: GrimBool): GrimBool {
        let ret = new GrimBool();
        ret.value = (a.isTrue() === b.isTrue());
        return ret;
    }

    // TODO
}

console.log('GrimVal module loaded');

function check(str: string, start: string | null = null, onlyErrors = false): Ast {
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
        return new GrimAst({
            type: 'Error',
            location: e.location || 'unknown',
            args: [ { type: 'Str', location: e.location || 'unknown', args: [e.message] } ]
        });
    }
}

function addAtomTypes() {
    GrimVal.atomMap.set("Bool", GrimBool);
}
addAtomTypes();

let ast = check("True");
console.log('Parsed AST JSON    :', JSON.stringify(ast, null, 2));
console.log('Parsed AST toString:', ast.toString());

// TODO work on this
let val = GrimVal.fromAst(ast);
console.log('GrimVal from AST   :', val.toString());

export { GrimVal, GrimBool };
