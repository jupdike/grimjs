#!/bin/bash
(cd src && peggy parser/ParserRobust.pegjs --dependency canast:./CanAst.js -o parser/_parser-robust.js && bun test/test-parse-sugar.js)
