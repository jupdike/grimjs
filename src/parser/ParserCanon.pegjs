//
// Grim Grammar
//
// command-line args to peggy adds CanAst.js as dependency
{{
  const aTag = canast.aTag;
  const aStr = canast.aStr;
  const aApp = canast.aApp;
  const aTagApp = canast.aTagApp;
}}

Start = Expr

Expr "an expression"
    = tag:Tag _ "(" _ args:ArgList _ ")" {
        return aTagApp(location(), tag, args);
      }
   / Tag
   / Str
    / "(" _ expr:Expr _ ")" _ "(" _ args:ArgList _ ")" {
        return aApp(location(), expr, args);
      }
    / "(" _ expr:Expr _ ")" { return expr; }

ArgList "a comma-separated list of zero or more expressions, with an optional trailing comma"
    = first:Expr rest:(_ "," _ Expr)* {
        return [first].concat(rest.map(pair => pair[3]));
      }
    / first:Expr _ "," _ rest:(_ Expr _ ",")* {
        return [first].concat(rest.map(pair => pair[3]));
      }
    / _ { return []; } // empty list

Tag "a tag"
  = [A-Z][a-zA-Z0-9_]* { return aTag(location(), text()); }

Str "a string"
  = '"' chars:([^\\"\n\r] / EscapeChar)* '"' {
    return aStr(location(), chars.join(''));
  }
  / "'" chars:([^\\'\n\r] / EscapeChar)* "'" {
    return aStr(location(), chars.join(''));
  }

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

_ "optional whitespace"
  = [ \t\n\r]* { return null; } // ignore whitespace
