#!/bin/bash
(cd src && peggy parser/ParserSugar.pegjs --dependency canast:./CanAst.js -o parser/_parser-sugar.js && bun test/test-parse-sugar.js)
