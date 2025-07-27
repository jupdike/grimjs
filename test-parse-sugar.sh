#!/bin/bash
(cd src && peggy parser/ParserSugar.pegjs --dependency canast:./CanAst.js --allowed-start-rules Start,Expression,Definition -o parser/_parser-sugar.js && bun test/test-parse-sugar.js)
