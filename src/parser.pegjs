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

AssignOp = ("=" / ":=")

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

Expr = uno:ExprL0 _ { return uno; }


////////////////////////////////////////
// The small pieces

Expression = uno:ExprL0 _ { return uno; }

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
       "$" / "?" / "||" / "&&" / "==" / "!=" / "<" / "<=" / ">=" / ">" / "++" / "+" / "-" / "*" / "/" / "^" / ".")
  { return Ast(location(), "Tag", [opMap[o]]); }

OpL0 "an infix operator" = ("@")
OpR0 "an infix operator" = ("$")
OpL1 "an infix operator" = ("?")
OpR2 "an infix operator" = ("||")
OpR3 "an infix operator" = ("&&")
OpN4 "an infix operator" = ("==" / "!=" / "<" / "<=" / ">=" / ">")
OpR5 "an infix operator" = ("++")
OpL6 "an infix operator" = ("+" / "-")
OpL7 "an infix operator" = ("*" / "/" / ".")
OpR8 "an infix operator" = ("^")

ExprL0 = head:ExprR0 tail:(_ OpL0 _ ExprR0)* { return leftBinaryAst(location(), head, tail); }
ExprR0 = head:ExprL1 tail:(_ OpR0 _ ExprR0)? { return optionalPairAst(location(), head, tail); } // right-associative
ExprL1 = head:ExprR2 tail:(_ OpL1 _ ExprR2)* { return leftBinaryAst(location(), head, tail); }
ExprR2 = head:ExprR3 tail:(_ OpR2 _ ExprR2)? { return optionalPairAst(location(), head, tail); } // right-associative
ExprR3 = head:ExprN4 tail:(_ OpR3 _ ExprR3)? { return optionalPairAst(location(), head, tail); } // right-associative
ExprN4 = head:ExprR5 tail:(_ OpN4 _ ExprR5)? { return optionalPairAst(location(), head, tail); } // non-associative (cannot chain)
ExprR5 = head:ExprL6 tail:(_ OpR5 _ ExprR5)? { return optionalPairAst(location(), head, tail); } // right-associative
ExprL6 = head:ExprL7 tail:(_ OpL6 _ ExprL7)* { return leftBinaryAst(location(), head, tail); }
ExprL7 = head:ExprR8 tail:(_ OpL7 _ ExprR8)* { return leftBinaryAst(location(), head, tail); }
ExprR8 = head:Factor tail:(_ OpR8 _ ExprR8)? { return optionalPairAst(location(), head, tail); } // right-associative

// is this the right precedence for method application v. whitespace?
//ExprL9 = head:Factor tail:(_ "." _ Factor)* { return leftBinaryAst(head, tail); }

ArgList
  = head:Expression tail:(_ "," _ Expression)* { return cons(head, tail.map(function(x) { return x[3]; })); }

FuncApply
  = head:Molecule _ "(" _ ")" { return Ast(location(), head, []); }
  // / head:Molecule _ "(" _ arg:Expression _ ")" { return Ast(location(), "Bin", [Ast(location(), "Op", ["@"]), head, arg]); }
  // to prevent a scenario like    print f(g)    <-- is this print(f(g)) or (print(f)) (g) ?
  / head:Molecule _ "(" _ items:ArgList _ ")" {
    //console.log('FuncApply:', head, items);
    //var lst = [Ast(location(), "@", []), cons(head, items);
    //console.log('lst:', lst);
    return Ast(location(), "@", cons(head, items));
    //return Ast(location(), head, []);
  }
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
    "[" items:(_ Molecule _ ","? _)* "]" { return Ast(location(), 'List', items.map(function(x) { return x[1]; })) }
    /// "{" pairs:(_ ObjPair _)* "}" { return Ast(location(), 'Map', pairs.map(function(x) { return x[1]; })) }
  / "{" pairs:(_ ObjPair _ ","? _)* "}" { return Ast(location(), 'Map', pairs.map(function(x) { return x[1]; })) } // this will be different once Colloids exist
  / Atom

ObjPair "a colon-separated key-value pair"
  = atom:Atom _ ":" _ mol:Molecule { return Ast(location(), "Pair", [atom, mol]); }

Ex "an expression"
  = Atom

Atom "atom"
  = Num // TODO change this to Double
  / String
  / Id
  / Tag

String "a string"
  = '"' chars:[^\"]* '"' { return Ast(location(), 'Str', [chars.join('')]); } // TODO allow escaping with backslashes
  / "'" chars:[^\']* "'" { return Ast(location(), 'Str', [chars.join('')]); } // TODO allow escaping with backslashes

Id "an identifier"
  = [a-z][a-zA-Z0-9_]* { return Ast(location(), 'Id', [text()]); }

Tag "a tag"
  = [A-Z][a-zA-Z0-9_]* { return Ast(location(), 'Tag', [text()]); }

Num "a number"
  //= [0-9]+ { return Ast(location(), 'Num', [text()]); } // parseInt(text(), 10)
  = [0-9]+ { return Ast(location(), 'Num', [parseInt(text(), 10)]); }
  // TODO support floats in various formats
  // TODO support scientific notation
  // TODO support different bases

_ "optional whitespace"
  = [ \t\n\r]*
