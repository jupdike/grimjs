import parser from '../parser/parser-canon.js';
import { Location } from '../parser/CanAst.js';
//import fs from 'fs';
//import { Ast } from './ast.js';

function locToStr(loc: Location): string {
  if(!loc) {
    return "unknown location";
  }
  return `line ${loc.start.line} col ${loc.start.column} to line ${loc.end.line} col ${loc.end.column}`;
}

function check(str: string, start: string | null = null, onlyErrors: boolean = false): any {
  start = start || "Start";
  try {
    var ret = parser.parse(str, {startRule: start});
    if (!onlyErrors) {
      console.log('---');
      console.log(str, '\n  ~~ parses as ~~>\n', ret.toString() );
    }
  } catch (e) {
    console.log('---');
    //console.log("Error", [e.message]);
    console.log(str, '  ~~ EXCEPTION THROWN as ~~>\n  ', `Error('${e.message}', '${locToStr(e.location)}')` );
  }
}

check("True");
check("False");
check('"Hello, world!"');
check('Bool("True")');
check('Bool("False")');
check("Anything");
check('Tag("Anything")');
check("Equals(Var('x'), Var('y'))");
check("(Equals)(Var('x'), Var('y'))");
