#!/bin/bash

(cd src && tsc parser/CanAst.ts && peggy parser/ParserSugar.pegjs --dependency canast:./CanAst.js -o parser/_parser-sugar.js && bun test/test-compare.ts)
