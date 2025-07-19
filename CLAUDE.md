# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GrimJS is an experimental parser and compiler for the functional language Grim. The project implements a portable JavaScript-based parser using PegJS that can run anywhere JavaScript runs. It's inspired by Fredrik Johansson's Grim/PyGrim and FunGrim mathematical functions grimoire.

## Architecture

The codebase follows a modular architecture with clear separation between parsing and core value representation:

### Core Value System (`src/core/`)
- **GrimVal.ts**: Base abstract value class with factory pattern for AST-to-value conversion
- **GrimBool.ts, GrimNum.ts, GrimStr.ts, etc.**: Concrete value types inheriting from GrimVal
- Values use a maker pattern where each type registers itself in `GrimVal.makerMap`
- All values implement `hashCode()`, `equals()`, and `toString()` methods

### Parser System (`src/parser/`)
- **Two parser implementations**: Legacy parser (`parser.pegjs`) and new simple canonical parser (`CanParser.pegjs`)
- **CanAst.ts**: Canonical AST classes (`CanStr`, `CanTag`, `CanApp`, `CanTaggedApp`) for the new parser
- **canast-config.json**: PegJS configuration for canonical parser generation, options for `peggy` command-line tool
- **ast.js**: Legacy AST utilities (no real TypeScript equivalents)

### Test System (`src/test/`)
- **test-canon.ts**: Tests for new canonical parser system
- **test.js**: Legacy parser tests

## Common Development Commands

### Build and Test (Legacy Parser)
```bash
./test.sh
```

### Build and Test (Canonical Parser) 
```bash
./test-canon.sh
```

## Key Development Notes

- The project uses **two different parser systems** - legacy and canonical. The canonical system (CanAst) is small prototype for the newer, preferred approach, but too simple.
- **TypeScript compilation is required** before running PegJS generation for the canonical parser
- **Bun runtime** is used for running canonical parser tests, not Node.js
- When working with CanAst.ts, remember to compile to JavaScript before generating parsers, so parsers can import that code as JS and export it as `parser-whatever.js`
- Keep AST utility functions in sync between TypeScript and JavaScript versions
- The project uses a factory pattern for value creation from AST nodes via `GrimVal.makerMap`. This all uses the old fragile AstJson / mostly untyped JSON approach (called `Ast()` in parser.pegjs code itself)

## Dependencies

- **PegJS**: Parser generator
- **TypeScript**: For canonical AST types and GrimVal builder classes and subtypes
- **Bun**: Runtime for running parsers tests and build tests (GrimTest.ts)
- **Immutable.js**: Functional, persistent (immutable) data structures, used as the basis for collection types in GrimJs runtime (GrimVal and subtypes in GrimCollect such as GrimList, GrimSet, GrimMap, GrimTuple)
- **gmp-wasm**: For arbitrary precision arithmetic (future use)
