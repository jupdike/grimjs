(cd src && peggy --dependency ast:../parser/ast.js --allowed-start-rules Atom,Ex,Expr,Start,Def parser/parser.pegjs && node test/test.js)
