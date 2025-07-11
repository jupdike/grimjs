(cd src && peggy --dependency ast:./ast.js --allowed-start-rules Atom,Ex,Expr,Start,Def parser.pegjs && node test.js)
