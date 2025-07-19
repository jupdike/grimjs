(cd src && tsc parser/CanAst.ts && peggy -c parser/canast-config.json && bun test/test-canon.ts)
