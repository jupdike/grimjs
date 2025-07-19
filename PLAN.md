# PLAN: Port to Type-Safe CanAst Architecture

## Overview
Port the existing parser and core value system from the fragile AstJson approach to the new type-safe CanAst architecture used in CanParser.pegjs.

## Phase 1: Create Robust Parser (src/parser/Robust.pegjs)

### 1.1 Examine CanAst.ts Structure
- Read the existing CanAst.ts to understand the type-safe AST classes
- Document the available CanAst types: CanStr, CanTag, CanApp, CanTaggedApp

### 1.2 Port Grammar Rules
- Start with the basic structure from CanParser.pegjs
- Port all grammar rules from parser.pegjs to use CanAst constructors instead of Ast()
- Key areas to port:
  - Expression precedence and operators (ExprL0-ExprR9)
  - Function definitions and bindings
  - Data structures (lists, tuples, maps)
  - Atoms (strings, numbers, symbols, tags)

### 1.3 Replace AstJson Construction
- Replace all `Ast(location(), tag, children)` calls with appropriate CanAst constructors
- Map old AST tags to new CanAst types:
  - String literals → CanStr
  - Tags → CanTag  
  - Function applications → CanApp
  - Tagged applications → CanTaggedApp

## Phase 2: Update Core Value System

### 2.1 Modify GrimVal.ts Base Class
- Remove AstJson dependencies and interfaces
- Update `fromAst()` method to work with CanAst types instead of AstJson
- Simplify the complex maker lookup logic that handles AstJson fragility
- Update type signatures to use CanAst union types

### 2.2 Port GrimVal Subclasses
Update each subclass in src/core/ to use CanAst:
- **GrimStr.ts** - handle CanStr nodes
- **GrimBool.ts** - handle boolean CanTag nodes  
- **GrimNum.ts** - handle numeric CanStr nodes
- **GrimFun.ts** - handle function CanApp nodes
- **GrimOpt.ts** - handle option type CanTaggedApp nodes
- **GrimCollect.ts** - handle collection CanTaggedApp nodes
- **GrimAst.ts** - update AST handling utilities

### 2.3 Update Maker Pattern
- Simplify the maker registration system
- Remove complex AstJson tag resolution logic in GrimVal.fromAst
- Use direct CanAst type checking instead of string-based tag matching

## Phase 3: Integration and Testing

### 3.1 Build Configuration
- Update build scripts to compile CanAst.ts to JavaScript before parser generation
- Ensure Robust.pegjs can import the compiled CanAst.js

### 3.2 Create Test Infrastructure
- Create test-robust.ts similar to test-canon.ts
- Port existing tests to use the new Robust parser
- Verify all GrimVal operations work with CanAst input

### 3.3 Validation
- Compare outputs between old parser.pegjs and new Robust.pegjs
- Ensure all existing functionality is preserved
- Verify type safety improvements did not break anything

## Key Benefits Expected
1. **Type Safety**: Compile-time checking of AST structure
2. **Maintainability**: Cleaner, more predictable AST handling  
3. **Performance**: Reduced runtime type checking and string comparisons
4. **Robustness**: Elimination of fragile AstJson tag-based dispatching, easier to write new code, easier to reason about semantics of CanAst than an open-ended AstJson approach

## Dependencies
- Existing CanAst.ts classes
- PegJS/Peggy parser generator
- TypeScript compiler
- Bun runtime for testing
