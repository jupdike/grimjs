//
// Tessera Grammar
//
// command-line args to peggy adds ast.js as dependency
{{
  const Ast = ast.Ast;
  const cons = ast.cons;
  const optionalPairAst = ast.optionalPairAst;
  const leftBinaryAst = ast.leftBinaryAst;
  const opMap = ast.opMap;
}}


////////////////////////////////////////
// The places to start a parse

Start = Def
// Defs = def:Def+ { return Ast(location(), "Defs", def); } // will use whitespace / newlines to separate defs

IdList
  = head:Id tail:(_ "," _ Id)* { return cons(head, tail.map(function(x) { return x[3]; })); }

AssignOp = (":=" / ":=>")

Def "a let definition or a macro definition"
  = id:Id _ op:AssignOp _ body:Expression {
    return Ast(location(), op === "=" ? "Let" : "Macro",
      [id]
      .concat([body])
      );
    }
  / id1:Id _ op:Op _ id2:Id _ assignOp:AssignOp _ body:Expression {
    // assign code to an infix operator
    return Ast(location(), assignOp === "=" ? "Let" : "Macro",
      [op]
      .concat([ Ast(location(), "List", [id1, id2]) ])
      .concat([body])
      );
    }
  / id:Id _ ids:(Id _)+ _ op:AssignOp _ body:Expression {
    return Ast(location(), op === "=" ? "Let" : "Macro",
      [id]
      .concat([Ast(location(), "List", ids.map(function(x) { return x[0]; }))])
      .concat([body])
      );
    }
  / id:Id _ "(" _ ")" _ op:AssignOp _ body:Expression {
    return Ast(location(), op === "=" ? "Let" : "Macro",
      [id]
      .concat([Ast(location(), "List", [])])
      .concat([body])
    );
  }
  / id:Id _ "(" _ args:IdList _ ")" _ op:AssignOp _ body:Expression {
    return Ast(location(), op === "=" ? "Let" : "Macro",
      [id]
      .concat([Ast(location(), "List", args)])
      .concat([body])
    );
  }

Expr = uno:ExprLowest _ { return uno; }

Expressions = head:Expression tail:(_ Expression)* {
  return [head].concat(tail.map(function(x) { return x[1]; }));
}

////////////////////////////////////////
// The small pieces

Expression = uno:ExprLowest _ { return uno; }

DefOrId "an identifier or a definition"
  = Def
  / Id

DefOrIdList
  = head:DefOrId tail:(_ "," _ DefOrId)* { return cons(head, tail.map(function(x) { return x[3]; })); }

Lambda "a lambda expression (anonymous function)"
  = "(" _ ")" _ "=>" _ body:Expression { return Ast(location(), "Fun", [Ast(location(), "List", []), body]); }
  / id:Id _ "=>" _ body:Expression { return Ast(location(), "Fun", [Ast(location(), "List", [id]), body]); }
  / "(" _ args:DefOrIdList _ ")" _ "=>" _ body:Expression { return Ast(location(), "Fun", [Ast(location(), "List", args), body]); }

// TODO keep this up to date when new operators are added below (plus keep _ and @)
Op "an infix operator"
  = o:("_" / "@" /
       "$" / "?" / "||" / "&&" / "==" / "=" / "!=" / "<" / "<=" / ">=" / ">" / "++" / "+" / "-" / "*" / "/" / "^" / ".")
  { return Ast(location(), "Tag", [opMap[o]]); }

OpL0 "an infix operator" = ("@")
OpR0 "an infix operator" = ("$")
OpL1 "an infix operator" = ("?")
OpR2 "an infix operator" = ("||")
OpR3 "an infix operator" = ("&&")
OpN4 "an infix operator" = ("==" / "=" / "!=" / "<" / "<=" / ">=" / ">")
OpR5 "an infix operator" = ("++")
OpL6 "an infix operator" = ("+" / "-")
OpL7 "an infix operator" = ("*" / "/" / ".")
OpU8 "a unary - or + operator" = ("-" / "+") // unary operators
OpR9 "an infix operator" = ("^" / "**")

ExprLowest = ExprL0
// NOPE ExprUn = _ head:OpU _ tail:ExprL0 { return Ast(location(), head === "-" ? "Neg" : "Pos", [tail]); } // unary operators: +x -x
ExprL0 = head:ExprR0 tail:(_ OpL0 _ ExprR0)* { return leftBinaryAst(location(), head, tail); }
ExprR0 = head:ExprL1 tail:(_ OpR0 _ ExprR0)? { return optionalPairAst(location(), head, tail); } // right-associative
ExprL1 = head:ExprR2 tail:(_ OpL1 _ ExprR2)* { return leftBinaryAst(location(), head, tail); }
ExprR2 = head:ExprR3 tail:(_ OpR2 _ ExprR2)? { return optionalPairAst(location(), head, tail); } // right-associative
ExprR3 = head:ExprN4 tail:(_ OpR3 _ ExprR3)? { return optionalPairAst(location(), head, tail); } // right-associative
ExprN4 = head:ExprR5 tail:(_ OpN4 _ ExprR5)? { return optionalPairAst(location(), head, tail); } // non-associative (cannot chain)
ExprR5 = head:ExprL6 tail:(_ OpR5 _ ExprR5)? { return optionalPairAst(location(), head, tail); } // right-associative
ExprL6 = head:ExprL7 tail:(_ OpL6 _ ExprL7)* { return leftBinaryAst(location(), head, tail); }
ExprL7 = head:ExprU8 tail:(_ OpL7 _ ExprU8)* { return leftBinaryAst(location(), head, tail); }
ExprU8 = _ head:OpU8 tail:ExprR9 { return Ast(location(), head === "-" ? "Neg" : "Pos", [tail]); } // unary operators: +x -x
  / ExprR9
ExprR9 = head:Factor tail:(_ OpR9 _ ExprU8)? { return optionalPairAst(location(), head, tail); } // right-associative

// is this the right precedence for method application v. whitespace?
//ExprL9 = head:Factor tail:(_ "." _ Factor)* { return leftBinaryAst(head, tail); }

ArgList
  = head:Expression tail:(_ "," _ Expression)* { return cons(head, tail.map(function(x) { return x[3]; })); }

FuncApply
  = head:Molecule _ "(" _ ")" { return Ast(location(), "@", [head]); }
  // to prevent a scenario like    print f(g)    <-- is this print(f(g)) or (print(f)) (g) ?
  / head:Molecule _ "(" _ items:ArgList _ ")" { return Ast(location(), "@", cons(head, items));}
  // allow trailing comma
  / head:Molecule _ "(" _ items:ArgList _ "," _ ")" { return Ast(location(), "@", cons(head, items));}
  // / head:Molecule _ items:(ExprR8 _)+
  //    { return Ast(location(), "Bin", [head].concat([Ast(location(), "Op", ["_"])]).concat(items.map(function(x) { return x[0]; }))); }
  // also, make whitespace function app or multiply have lower precedence than exponentiation

Factor "a function application, a parenthesized expression, a lambda, or a list, map or atom"
  = FuncApply
  / "(" _ o:Op _ ")" { return o; }
  // / Lambda
  / "(" _ e:Expression _ ")" { return e; }
  / Molecule

Molecule "a list, map, atom"
  = //"[" items:(_ Molecule _)* "]" { return Ast(location(), 'List', items.map(function(x) { return x[1]; })) }
    "[" items:(_ ExprLowest _ ","? _)* "]" { return Ast(location(), 'List', items.map(function(x) { return x[1]; })) }
  / "(" items:(_ ExprLowest _ ","? _)* ")" { return Ast(location(), 'Tuple', items.map(function(x) { return x[1]; })) }
    /// "{" pairs:(_ ObjPair _)* "}" { return Ast(location(), 'Map', pairs.map(function(x) { return x[1]; })) }
  / "{" pairs:(_ ObjPair _ ","? _)* "}" { return Ast(location(), 'Map', pairs.map(function(x) { return x[1]; })) }
  / Atom

ObjPair "a colon-separated key-value pair"
  = atom:Atom _ ":" _ mol:Molecule { return Ast(location(), "Pair", [atom, mol]); }

// here just so we can do check() on this in test.js
Ex "an expression"
 = Atom

Atom "atom"
  = Natural
  / String
  / Id
  / Tag

EscapeChar "an escaped character"
  = "\\" ([nrt\\"'] / [0-7]{1,3} / [xX][0-9a-fA-F]+) {
    if (text() === '\\n') return '\n';
    if (text() === '\\r') return '\r';
    if (text() === '\\t') return '\t';
    // TODO handle unicode escapes
    // TODO handle octal escapes
    // TODO handle hex escapes
    // TODO handle unicode escapes
    // TODO handle other escape sequences
    return text().substring(1); // remove the leading backslash
  }

String "a string"
  = '"' chars:([^\\"\n\r] / EscapeChar)* '"' {
    return Ast(location(), 'Str', [chars.join('')]);
  }
  / "'" chars:([^\\'\n\r] / EscapeChar)* "'" {
    return Ast(location(), 'Str', [chars.join('')]);
  }

Id "an identifier"
  = [a-z][a-zA-Z0-9_]* { return Ast(location(), 'Id', [text()]); }
  // TODO remove leading underscore from Ids
  / [_][A-Za-z][a-zA-Z0-9_]* { return Ast(location(), 'Id', [text()]); }

Tag "a tag"
  = [A-Z][a-zA-Z0-9_]* { return Ast(location(), 'Tag', [text()]); }

Natural "a natural number"
  //= [0-9]+ { return Ast(location(), 'Num', [parseInt(text(), 10)]); }
  = [0-9]+ { return Ast(location(), 'Natural', [text()]); }
  // TODO support floats in various formats
  // TODO support scientific notation
  // TODO support different bases

_ "optional whitespace"
  = [ \t\n\r]*
