//
// Robust Grim Grammar using CanAst types
//
// command-line args to peggy adds CanAst.js as dependency
{{
  const aTag = canast.aTag;
  const aStr = canast.aStr;
  const aApp = canast.aApp;
  const aTagApp = canast.aTagApp;
  
  function cons(x, xs) {
    return [x].concat(xs);
  }
  
  // added on each call to the parser, by per-parse initializer
  let opMap = null;
  //
  let unaryOpMap = {
      "+": "Pos",
      "-": "Neg",
      "~": "Quote"
    };

  function leftBinaryAst(location, head, tail) {
    return tail.reduce(function(result, element) {
      return aTagApp(location, opMap[element[1]], [result, element[3]]);
    }, head);
  }
  
  function optionalPairAst(location, head, tail) {
    if(!tail) {
      return head;
    }
    return aTagApp(location, opMap[tail[1]], [head, tail[3]]);
  }
}}

{
  //console.log("Per-parse initializer called here!", options.test);
  if (options.opMap) {
    opMap = options.opMap;
  } else {
    throw new Error("opMap is not defined in options");
  }
}

////////////////////////////////////////
// The places to start a parse

Start = Expression

Definition = Def / DefCast

AssignOp = ":="
CastOp = ":>"

DefCast "a cast from one Tag to another Tag"
  = bigTag:Tag _ CastOp _ smallTag:Tag {
    return aTagApp(location(), "DefCast", [bigTag, smallTag]);
  }

Def "a symbol definition"
  = sym:Sym _ op:AssignOp _ body:Expression {
    return aTagApp(location(), "Def",
      [sym, body]
      );
    }
  / sym1:Sym _ op:Op _ sym2:Sym _ assignOp:AssignOp _ body:Expression {
    // assign code to an infix operator
    return aTagApp(location(), "Def",
      [opMap[op], aTagApp(location(), "List", [sym1, sym2]), body]
      );
    }
  / sym:Sym _ syms:(Sym _)+ _ op:AssignOp _ body:Expression {
    return aTagApp(location(), "Def",
      [sym, aTagApp(location(), "List", syms.map(function(x) { return x[0]; })), body]
      );
    }
  / sym:Sym _ "(" _ ")" _ op:AssignOp _ body:Expression {
    return aTagApp(location(), "Def",
      [sym, aTagApp(location(), "List", []), body]
    );
  }
  / sym:Sym _ "(" _ args:SymList _ ")" _ op:AssignOp _ body:Expression {
    return aTagApp(location(), "Def",
      [sym, aTagApp(location(), "List", args), body]
    );
  }

Expr = uno:ExprLowest _ { return uno; }

Expressions = head:Expression tail:(_ Expression)* {
  return [head].concat(tail.map(function(x) { return x[1]; }));
}

////////////////////////////////////////
// The small pieces

Expression = uno:ExprLowest _ { return uno; }

SymList
  = head:Sym tail:(_ "," _ Sym)* { return cons(head, tail.map(function(x) { return x[3]; })); }

DefList
  = head:Def tail:(_ "," _ Def)* {
    let ret = cons(head, tail.map(function(x) { return x[3]; }));
    ret = ret.map(function(x) {
      // These errors should never happen, but if they do, we want to know about them
      //console.error("DefList item:", x.toString());
      if (x.tag.tag !== "Def") {
        console.error("x.tag: " + '|'+x.tag+'|');
        console.error("x.tag.tag: " + '|'+x.tag.tag+'|');
        console.error("DefList item is not a Def: " + x.toString());
      }
      if (x.args.length !== 2) {
        console.error("DefList item Def does not have exactly two args: " + x.toString());
      }
      return aTagApp(x.location, "Tuple", [x.args[0], x.args[1]]);
    });
    //console.error("DefList:", ret.toString());
    return ret;
  }

Bind "a Fun expression (anonymous function) or Let expression"
  = "(" _ ")" _ "=>" _ body:Expression { return aTagApp(location(), "Fun", [aTagApp(location(), "List", []), body]); }
  / sym:Sym _ "=>" _ body:Expression { return aTagApp(location(), "Fun", [aTagApp(location(), "List", [sym]), body]); }
  / "(" _ args:DefList _ ")" _ "=>" _ body:Expression { return aTagApp(location(), "Let", [aTagApp(location(), "List", args), body]); }
  / "(" _ args:SymList _ ")" _ "=>" _ body:Expression { return aTagApp(location(), "Fun", [aTagApp(location(), "List", args), body]); }


Graphical "one or more graphical characters as an infix operator"
// U+002D is hyphen, U+005C is backslash
  = [=+!#$%&*.|/<>?@^~_\u002d\u005c]+ { return text(); }

/*
see https://github.com/haskell/alex/blob/master/examples/haskell.x
$ascsymbol = [\!\#\$\%\&\*\+\.\/\<\=\>\?\@\\\^\|\-\~]
$unisymbol = [] -- TODO
$symbol    = [$ascsymbol $unisymbol] # [$special \_\:\"\']
$large     = [A-Z \xc0-\xd6 \xd8-\xde]
$small     = [a-z \xdf-\xf6 \xf8-\xff \_]
$alpha     = [$small $large]
*/

If "if keyword"
  = "if"
Then "then keyword"
  = "then"
Else "else keyword"
  = "else"

If3 "a ternary if expression" = If _ t:Expression _ Then _ a:Expression _ Else _ b:Expression {
  return aTagApp(location(), "If3", [t, a, b]);
}

Op "an infix operator"
  = o:Graphical {
    if (o in opMap) {
      return aTag(location(), opMap[o]);
    }
    throw new Error(`Unknown operator: ${o}`);
  }

// hmmm
// TODO x ?         means   None ?? f(x)  ==> None     and Error(e) ?? f(x)  ==> Error(e)   else   f(x)
// TODO x ?? y      means   None ?? y     ==> y        and Error(e) ?? y     ==> Error(e)   else   x
// left-associative, except for @ which is a special case
OpL0 "an infix operator" = op:Graphical &{ return options.isValidOp('l', 0, op); } { return op; }
OpR0 "an infix operator" = op:Graphical &{ return options.isValidOp('r', 0, op); } { return op; }
OpL1 "an infix operator" = op:Graphical &{ return options.isValidOp('l', 1, op); } { return op; }
OpR2 "an infix operator" = op:Graphical &{ return options.isValidOp('r', 2, op); } { return op; }
OpR3 "an infix operator" = op:Graphical &{ return options.isValidOp('r', 3, op); } { return op; }
OpN4 "an infix operator" = op:Graphical &{ return options.isValidOp('n', 4, op); } { return op; }
OpR4 "an infix operator" = op:Graphical &{ return options.isValidOp('r', 4, op); } { return op; }
OpR5 "an infix operator" = op:Graphical &{ return options.isValidOp('r', 5, op); } { return op; }
OpL6 "an infix operator" = op:Graphical &{ return options.isValidOp('l', 6, op); } { return op; }
OpL7 "an infix operator" = op:Graphical &{ return options.isValidOp('l', 7, op); } { return op; }
OpR9 "an infix operator" = op:Graphical &{ return options.isValidOp('r', 9, op); } { return op; }
OpU8 "a unary - or + operator" = ("-" / "+" / "~") // unary operators, and Quote

// BIG TODO BIG TODO BIG TODO BIG TODO BIG TODO BIG TODO BIG TODO BIG TODO BIG TODO BIG TODO BIG
// TODO allow other parts of the operator table (as in Haskell) to be defined in boot.grim
//      especially other directions, left and right and non-associative at each precedence level
// BIG TODO BIG TODO BIG TODO BIG TODO BIG TODO BIG TODO BIG TODO BIG TODO BIG TODO BIG TODO BIG 

ExprLowest = ExprL0
// NOPE ExprUn = _ head:OpU _ tail:ExprL0 { return aTagApp(location(), head === "-" ? "Neg" : "Pos", [tail]); } // unary operators: +x -x
ExprL0 = head:ExprR0 tail:(_ OpL0 _ ExprR0)* { return leftBinaryAst(location(), head, tail); }
ExprR0 = head:ExprL1 tail:(_ OpR0 _ ExprR0)? { return optionalPairAst(location(), head, tail); } // right-associative
ExprL1 = head:ExprR2 tail:(_ OpL1 _ ExprR2)* { return leftBinaryAst(location(), head, tail); }
ExprR2 = head:ExprR3 tail:(_ OpR2 _ ExprR2)? { return optionalPairAst(location(), head, tail); } // right-associative
ExprR3 = head:ExprN4 tail:(_ OpR3 _ ExprR3)? { return optionalPairAst(location(), head, tail); } // right-associative
//Expr4  = ExprN4 / ExprR4
ExprN4 = head:ExprR5 tail:(_ OpN4 _ ExprR5)? { return optionalPairAst(location(), head, tail); } // non-associative (cannot chain)
ExprR5 = head:ExprL6 tail:(_ OpR5 _ ExprR5)? { return optionalPairAst(location(), head, tail); } // right-associative
ExprL6 = head:ExprL7 tail:(_ OpL6 _ ExprL7)* { return leftBinaryAst(location(), head, tail); }
ExprL7 = head:ExprU8 tail:(_ OpL7 _ ExprU8)* { return leftBinaryAst(location(), head, tail); }
ExprU8 = _ head:OpU8 _ tail:ExprR9 { return aTagApp(location(), unaryOpMap[head], [tail]); } // unary operators: +x -x
  / ExprR9
ExprR9 = head:Factor tail:(_ OpR9 _ ExprU8)? { return optionalPairAst(location(), head, tail); } // right-associative

// is this the right precedence for method application v. whitespace?
//ExprL9 = head:Factor tail:(_ "." _ Factor)* { return leftBinaryAst(head, tail); }

ArgList
  = head:Expression tail:(_ "," _ Expression)* { return cons(head, tail.map(function(x) { return x[3]; })); }

FuncApply
  = "(" _ head:Factor _ ")" _ "(" _ ")" { return aApp(location(), head, []); }
  / head:Molecule _ "(" _ ")" { return aApp(location(), head, []); }
  / "(" _ head:Factor _ ")" _ "(" _ items:ArgList _ ")" { return aApp(location(), head, items);}
  / head:Molecule _ "(" _ items:ArgList _ ")" { return aApp(location(), head, items);}
  // allow trailing comma
  / head:Molecule _ "(" _ items:ArgList _ "," _ ")" { return aApp(location(), head, items);}
  // / head:Molecule _ items:(ExprR8 _)+
  //    { return aTagApp(location(), "Bin", [head].concat([aTag(location(), "_")]).concat(items.map(function(x) { return x[0]; }))); }

Factor "a function application, a parenthesized expression, a function, or a list, tuple, map or atom"
  = FuncApply
  / "(" _ o:Op _ ")" { return o; }
  / Bind
  / "(" _ e:Expression _ ")" { return e; }
  / Molecule

Items "a comma-separated list of two or more items"
  = head:ExprLowest tail:(_ "," _ ExprLowest)+ { return cons(head, tail.map(function(x) { return x[3]; })); }

Tuple "a tuple"
  = "(" items:Items ")" { return aTagApp(location(), 'Tuple', items); }

Map "a map"
  = "{" pairs:(_ ObjPair _ ","? _)* "}" { return aTagApp(location(), 'Map', pairs.map(function(x) { return x[1]; })) }

// list items can be empty or include trailing comma
List "a list"
  = "[" items:(_ ExprLowest _ ","? _)* "]" { return aTagApp(location(), 'List', items.map(function(x) { return x[1]; })) };

Molecule "a list, map, atom"
  = List
  / Tuple
  / Map
  / If3
  / Atom

ObjKey "an object key"
  = Tuple
  / Atom

ObjPair "a colon-separated key-value pair"
  = key:ObjKey _ ":" _ mol:Molecule { return aTagApp(location(), "Tuple", [key, mol]); }

// here just so we can do check() on this in test.js
Ex "an expression"
  = Atom

Atom "atom"
  = Dec
  / Nat
  / Str
  / Tag
  / Sym

EscapeChar "an escaped character"
  = "\\" ([nrt\\"'] / [u][0-9a-fA-F]{2,4}) {
    if (text() === '\\n') return '\n';
    if (text() === '\\r') return '\r';
    if (text() === '\\t') return '\t';
    if (text().startsWith('\\u')) {
      return String.fromCharCode(parseInt(text().substring(2), 16));
    }
    return text().substring(1); // remove the leading backslash
  }

Str "a string"
  = '"' chars:([^\\"\n\r] / EscapeChar)* '"' {
    return aStr(location(), chars.join(''));
  }
  / "'" chars:([^\\'\n\r] / EscapeChar)* "'" {
    return aStr(location(), chars.join(''));
  }

Sym "a symbol"
  = [a-z][a-zA-Z0-9_]* { return aTagApp(location(), 'Sym', [aStr(location(), text())]); }
  // TODO remove leading underscore from Syms
  / [_][A-Za-z][a-zA-Z0-9_]* { return aTagApp(location(), 'Sym', [aStr(location(), text())]); }

Tag "a tag"
  = [A-Z][a-zA-Z0-9_]* { return aTagApp(location(), 'Tag', [aStr(location(), text())]); }

Dec "a decimal number"
  = [0-9]+ "." [0-9]* [eE] [+-]? [0-9]+ { return aTagApp(location(), 'Dec', [aStr(location(), text())]); }
  / [0-9]* "." [0-9]+ [eE] [+-]? [0-9]+ { return aTagApp(location(), 'Dec', [aStr(location(), text())]); }
  / [0-9]+ "." [0-9]* { return aTagApp(location(), 'Dec', [aStr(location(), text())]); }
  / [0-9]* "." [0-9]+ { return aTagApp(location(), 'Dec', [aStr(location(), text())]); }
  // TODO support different bases

Nat "a natural number"
  //= [0-9]+ { return aTagApp(location(), 'Num', [parseInt(text(), 10)]); }
  = [0-9]+ { return aTagApp(location(), 'Nat', [aStr(location(), text())]); }
  // TODO support different bases

_ "optional whitespace"
  = [ \t\n\r]*
