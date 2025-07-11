  function AstNode(location, tag, children) {
    if(location === null || location === undefined) {
      throw "expected location to be non-null, non-undefined";
    }
    if(typeof(tag) !== typeof("")) {
      console.error(':-( tag:', tag);
      throw "expected tag to be a string, but found: " + tag;
    }
    this.location = location;
    this.tag = tag;
    if(!children) {
      console.error('location:', location);
      console.error('tag:', tag);
      throw new "expected children to be non-null, non-undefined, but found:" + children;
    }
    this.children = children;
  }
  function strEscape(x) {
    return x.replace(/\\/g, '\\\\').replace(/"/g, '\\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r');
  }
  function arrayToString(arr) {
    var that = this;
    return arr.map(function(x) {
        if (x === null || x === undefined) {
          throw ["expected non-null children in list of children for AstNode", that.tag, that.location];
        }
        // strings should be quoted!
        if (typeof(x) === typeof("")) {
          return '"' + strEscape(x) + '"';
        } else if (typeof(x) === typeof(1.0)) { // numbers
          return '' + x;
        } else if (typeof(x) === typeof(1)) { // numbers again ...
          return '' + x;
        }
        if (!(x instanceof AstNode)) {
          console.error('ERROR --> should find AstNode, but found x:', x); // bug in the Parser, not in user's code
          process.exit(1);
        }
        // if (Array.isArray(x)) {
        //   console.error('array:', x);
        //   process.exit(1);
        //   //return arrayToString(x);
        // }
        return x.toString(); // convert AstNode to string recursively
      }).join(', ');
  }
  AstNode.prototype.toString = function() {
    var kidStr = '';
    var that = this;
    if (this.tag === "@" && this.children.length >= 1) {
      kidStr = arrayToString(this.children.slice(1)); // remove the first element, which is the 'head' of the function application
      return this.children[0].toString() + '(' + kidStr + ')';
    }
    if (this.tag === "Str" && this.children.length >= 1) {
      return '"' + strEscape(this.children[0]) + '"'; // just return the string printed as a string literal
    }
    if ((this.tag === "Id" || this.tag === "Tag" || this.tag === "Num")
      && this.children.length >= 1) {
      return this.children[0]; // just return the identifier string
    }
    if (this.children && this.children.length > 0) {
      //console.error('tag:', this.tag);
      kidStr = arrayToString(this.children);
    }
    return this.tag + '(' + kidStr + ')';
  };
  function Ast(location, tag, children) {
    //console.log('Ast:', location, tag, children);
    return new AstNode(location, tag, children);
  }
  function cons(x,xs) {
    return [x].concat(xs);
  }
  // function leftBinaryAst(location, head, tail) {
  //   return tail.reduce(function(result, element) {
  //     return Ast(location, "Bin", [Ast(location, "Op", [element[1]]), result, element[3]]);
  //   }, head);
  // }
  // function optionalPairAst(location, head, tail) {
  //   if(!tail) {
  //     return head;
  //   }
  //   return Ast(location, "Bin", [Ast(location, "Op", [tail[1]]), head, tail[3]]);
  // }
  let opMap = {
      "+": "Add",
      "-": "Sub",
      "*": "Mul",
      "/": "Div",
      "%": "Mod",
      "**": "Pow",
      "^": "Pow",
      "=": "Equals",
      "==": "Eq",
      "!=": "NotEq",
      "<": "Lt",
      "<=": "Lte",
      ">": "Gt",
      ">=": "Gte",
      "&&": "And",
      "||": "Or",
      "++": "Concat",
      "?": "If2",
      "@": "LApply",
      "$": "RApply"
    };
  function leftBinaryAst(location, head, tail) {
    return tail.reduce(function(result, element) {
      return Ast(location, opMap[element[1]], [result, element[3]]);
    }, head);
  }
  function optionalPairAst(location, head, tail) {
    if(!tail) {
      return head;
    }
    //console.log('********\nHEAD:', head, "TAIL:\n", tail);
    return Ast(location, opMap[tail[1]], [head, tail[3]]);
  }
  module.exports = { Ast: Ast, leftBinaryAst: leftBinaryAst, optionalPairAst: optionalPairAst, cons: cons, opMap: opMap };
