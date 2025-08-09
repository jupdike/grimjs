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
- **Two parser implementations**: "Syntax-sugared" parser (`ParserSugar.pegjs`) and simple canonical ("desugared") parser (`CanParser.pegjs`)
- **CanAst.ts**: Canonical AST classes (`CanStr`, `CanTag`, `CanApp`, `CanTaggedApp`) for both parsers
- **canast-config.json**: PegJS configuration for canonical parser generation, options for `peggy` command-line tool

### Test System (`src/test/`)
- **test-canon.ts**: Tests for parsers and module (sending parsed `CanAst` output into `module.fromAst()`)

## Key Development Notes

- The project uses **two different parser systems** - canonical (desugared) and advanced (syntax-sugared).
- **TypeScript compilation is required** before running PegJS generation for both parsers
- **Bun runtime** is used for running parser tests, not Node.js
- When working with CanAst.ts, remember to compile to JavaScript before generating parsers, so parsers can import that code as JS and export it as `parser/_parser-whatever.js`
- The project uses a factory pattern for building GrimVal runtime values from AST nodes via `GrimVal.makerMap`.

## Dependencies

- **PegJS**: Parser generator
- **TypeScript**: For canonical AST types and GrimVal classes (makers) and subtypes
- **Bun**: Runtime for running parsers tests and build tests (GrimTest.ts)
- **Immutable.js**: Functional, persistent (immutable) data structures, used as the basis for collection types in GrimJs runtime (GrimVal and subtypes in GrimCollect such as GrimList, GrimSet, GrimMap, GrimTuple)
- **gmp-wasm**: For arbitrary precision arithmetic (future use)
