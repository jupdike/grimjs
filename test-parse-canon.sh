#!/bin/bash
(cd src && tsc parser/CanAst.ts && peggy -c parser/ParserCanon-config.json && bun test/test-canon.ts)
