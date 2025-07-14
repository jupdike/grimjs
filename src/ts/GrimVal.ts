interface Ast {
    location: string;
    type: string;
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

export { GrimVal, GrimBool };

class GrimVal {
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

    toString(): string {
        return '';
    }

    isAtom(): boolean {
        return true; // Default implementation, can be overridden
    }
}

// TODO
class GrimAst extends GrimVal {
    constructor(private ast: Ast) {
        super();
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
    static True = new GrimBool(true);
    static False = new GrimBool(false);

    private constructor(private value: boolean) {
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
        return new GrimBool(a.value == b.value);
    }

    // TODO
}

console.log('GrimVal module loaded');

