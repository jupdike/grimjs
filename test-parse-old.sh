#!/bin/bash
(cd src && peggy --dependency ast:../parser/OldAst.js --allowed-start-rules Atom,Ex,Expr,Start,Def parser/ParserOld.pegjs -o parser/_parser-old.js && bun test/test-parse-old.js)
