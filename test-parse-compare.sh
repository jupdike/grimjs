#!/bin/bash

# Compile CanAst.ts to JavaScript so Robust.pegjs can import it
# Generate the Robust parser from Robust.pegjs 
# Run the Robust parser tests

(cd src && tsc parser/CanAst.ts && peggy parser/ParserRobust.pegjs --dependency canast:./CanAst.js -o parser/_parser-robust.js && bun test/test-compare.ts)
