var parser = require('./parser.js');
var fs = require('fs');
//var Ast = require('./ast.js');

function locToStr(loc) {
  if(!loc) {
    return "unknown location";
  }
  return `line ${loc.start.line} col ${loc.start.column} to line ${loc.end.line} col ${loc.end.column}`;
}

function check(str, start) {
  start = start || "Expr";
  try {
    var ret = parser.parse(str, {startRule: start});
    console.log('---');
    console.log(str, '\n  ~~ parses as ~~>\n', ret.toString() );
  } catch (e) {
    console.log('---');
    //console.log("Error", [e.message]);
    console.log(str, '  ~~ parses as ~~>\n  ', `Error('${e.message}', '${locToStr(e.location)}')` );
  }
}
function checkDef(str) {
  check(str, "Def");
}
function checkMatch(str) {
  check(str, "MatchMolecule");
}
function checkFile(file) {
  var str = fs.readFileSync(file);
  str = str + '';
  //console.log(str);
  check(str);  
}

/*
                infixR   9 ["compose"]
              X infixL   9 ["."]
              X infixR   8 ["^", "^-"]
              X infixL   7 ["*", "/", "quot", "rem", "div", "mod", "divides"]   -- ["*", "/", "%", "quot", "rem", "div", "mod"]
              , postfixx 7 ["%", "!", "..."]
              X infixL   6 ["+", "-"]
              X infixR   5 ["++", ":"]
              , infixx   5 ["::"]
              X infixx   4 ["==", "!=", "<", "<=", ">=", ">", "elem", "notElem"]
              X infixR   3 ["&&"]
              X infixR   2 ["||"]
              , infixx   1 ["|>", ".."]
              X infixL   1 ["?"]
--              , infixL   1 [">>", ">>="] -- TODO: test this!
--              , infixR   1 ["=<<"]       -- TODO: test this!
              X infixR   0 ["$"]
              X infixL   0 ["@"]
*/

//check('[a b]');
//check('[a b c]');
//check("{q:r s:t}");
// check('[Tagged a 2 b ]');
// check('[Tagged,b,3,c]');
// check('[Tagged [a b] 2 b ]');
//check('[List [Tag "Tagged"] [Id "a"] [Num 2] [Id "b"]]')

// check("<xml-tag/>");
// check("<xml-tag data-abc='xyz' ns:tag='2020' />");

// check("<xml-tag></xml-tag>");
// check("<xml-tag>TEXT</xml-tag>");
// check("<a>Test <b>bold</b> text</a>");
// check("<c>Test <d/> text</c>");

// check('<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="90px" height="90px" viewBox="5 5 90 90" enable-background="new 0 0 70 70" xml:space="preserve"><circle cx="50.00" cy="50.00" r="42.00" stroke="black" stroke-width="3" fill="white" /><path stroke-width="3" stroke="black" d="M 50.00 8.00 L 50 92.00"/></svg>');

// check("<c>Test <!-- comment - here --> text</c>");

// check('<?xml version="1.0" encoding="UTF-8" standalone="no"?><tag/>');

// check('<?xml version="1.0" encoding="UTF-8" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><tag/>');

//Entry(ID("627c9c"), Formula(Equal(Sqrt(z), Exp(Div(1,2)*Log(z)))), Variables(z), Assumptions(Element(z, SetMinus(CC, Set(0)))))

check('a');
check('(b)');
check('2');
check('2+3');
check('-2');
check('-2-2');
check('True');
check("False");
check('Undefined');
check('Null');
check('[]');
check('[a]');
check('[a,b]');
check("True");
check('"str"');
check("'str'");
//check("a:b"); // TODO shouldFail   -- could use a :: b as in Lean, for cons. Or a:b as in Haskell, for cons
check("{}");
check("{a:b}");
check("{u:v, w:x}");
check("{x:y, z:[1, 2, 3]}");
check("{X:y Y:[1, 2, 3]}");
check("{a: 4, b: [4, 5, 6], c: {d: 7, e: 8}}");

// this math stuff is a mess because of code in AST which should be smarter

check('2 * 3');
check('2 * 3 / 6');
check('2+4*5-3');
check('(2+4)*(5-3)');

check("a * b");
check("a * b * c");
check("1 * 2 / (3 / 4)");

check("a + b");
check("a - b");
check("a - b + c");
check("(a - b) + c");
check("a - (b + c)");

check("3 * 4 + 6 / 2");

check('1 * 2 * 3');

check('a && b && c');
check('a || b || c');

check('a && b || c && d');

check(`Entry(ID("627c9c"), Formula(Equal(Sqrt(z), Exp(Div(1,2)*Log(z)))), Variables(z), Assumptions(Element(z, SetMinus(CC, Set(0)))))`);

check("X^2 + 2*X + 1");
check("a * X ^ 2 + b*X + 1");

check("a^b^c");

check("a ** b");
check("a ** b ** c");

//check("a < b < c");  // fails, but could be parsed as (a < b) < c ==> Less(a, b, c)

check("a ++ b ++ c");

check("X ^ (0-b) + 2*X + 1");
check("X ^ (-b) + 2*X + 1");
check("X ^ -b + 2*X + 1");
check("X ^-b + 2*X + 1");

check("a + 5 > b - 6");
check("a == b");

check("a + b < 4 && c > d && e == f");

check("a && b || c && d || e && f");

check("a ? b ? c");  // ? should fail ?
check("a ? b $ c");
check("a $ b $ c");

check('sin(x) != cos(x)');

check('sqrt(x + y)');
check('sqrt(x+y)');

check('sqrt $ x+y');

check("(x+y)");

check("a(i)");
check("a_(i)");

check("(@)");
check("f @ x");
check("f @ x @ y");

check("(+)");

check("2 * x^2 + f(x, y)");

check("f(g)");
check("f(g,h)");

check("f(x, y, z)");
check("f(0, 1, 2)");

check("f(add, 0, x)");

check("a = b");

check("f");
check("f()");

// check("a != b == c"); // TODO shouldFail

check("f @ 2 + 3");
check("f @ g @ h");

// TODO decide on swizzle operator
// check("a.b().c()");  //   --> c(b(a)) ... ?
// check("a b . c d");
// check("a(b).c(d)");

// positive and negative unary operators
check("-a");
check("+a");

check("-x + 2");
check("f(-x + 2)");
check("f(+x + 2)");
check("-x^2 * 4");

check("-x^2 + 4");

check("-2**3");  // should be -8

process.exit(1);


// these are const/let statements
checkDef("x := y");
checkDef("x := y + z");
checkDef("add := (+)");
checkDef("f() := g"); // how to define a function with no arguments
checkDef("f(x) := x + 1");
checkDef("f(x,y) := x + y");
checkDef("f x y := x + y");

check("x => x");
check("(x) => x");
check("(x,y) => x + y");

check("(x = 4, z = 5, y) => x + y + z");

checkDef("f := (x,y) => x + y");

checkDef("f := (x, y, z) => g * x + f(y)");
checkDef("f := (x, y, f(g) = g^x + y) => f(4 * x)");

checkDef("sum := f(x, y, z)");
checkDef("sum x := f(x, y, z)");

checkDef("sum x := f((+), zero, x)");
checkDef("sum x := f((+), 0, x)");

//checkDef("sum x := foldr (+) 0 x"); // should fail, but should also have better error message ...
// :-(

checkDef("f(g) = g^x + y");

check("a -> expr");
check("[a] -> expr");
check("[Tag a] -> expr");

checkMatch("a");
checkMatch("[a b]");
checkMatch("[Tag a b]");
checkMatch("{k1: v1, k2: v2}");

//--------------------------------
checkDef("sum := f(x, y, z)");
checkDef("sum x := f(x, y, z)");

checkDef("sum x := f((+), zero, x)");
checkDef("sum x := f((+), 0, x)");

checkDef("f(g) := g^x + y");

checkDef("a + b := prim_add a b");

checkDef("a || b := prim_or a b");
