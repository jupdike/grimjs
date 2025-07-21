import "../core/Builder.js"; // This loads all the makers

import gmp from "gmp-wasm"; // Import the GMP library
import type { GMPLib } from "gmp-wasm";

// Import both parsers for comparison
import canParser from "../parser/_parser-canon.js";
import robustParser from "../parser/_parser-sugar.js";
import { Builder } from "../core/Builder.js";

function testCanAst(builder: Builder) {
    console.log("=== Testing CanAst to GrimVal conversion ===");
    
    try {
        // Test simple string parsing
        const strResult = canParser.parse('"hello"');
        console.log("Parsed string AST:", strResult.toString());
        
        const grimVal = builder.fromAst(strResult);
        console.log("Converted to GrimVal:", grimVal.toString());
        
        // Test simple tag parsing  
        const tagResult = canParser.parse('MyTag');
        console.log("Parsed tag AST:", tagResult.toString());

        const tagGrimVal = builder.fromAst(tagResult);
        console.log("Converted to GrimVal:", tagGrimVal.toString());
        
        // Test tagged application parsing
        const appResult = canParser.parse('Str("test")');
        console.log("Parsed tagged app AST:", appResult.toString());

        const appGrimVal = builder.fromAst(appResult);
        console.log("Converted to GrimVal:", appGrimVal.toString());
        
    } catch (error) {
        console.error("Test failed:", error);
    }
}

function testBasicExpressions(builder: Builder) {
    console.log("\n=== Testing Basic Expressions ===");
    
    const testCases = [
        '"hello world"',
        'SomeTag',
        'Str("test")',
        'Nat("42")',
        'Dec("3.14")'
    ];
    
    for (const testCase of testCases) {
        try {
            console.log(`\nTesting: ${testCase}`);
            const ast = canParser.parse(testCase);
            console.log(`  AST: ${ast.toString()}`);
            
            // Convert to GrimVal using CanAst
            const grimVal = builder.fromAst(ast);
            console.log(`  GrimVal: ${grimVal.toString()}`);
            console.log(`  Type: ${grimVal.constructor.name}`);
            
        } catch (error) {
            console.error(`  Error parsing "${testCase}":`, error.message);
        }
    }
}

function compareWithLegacy(builder: Builder) {
    console.log("\n=== Comparing Simple CanParser vs Robust Parser ===");
    
    const testCases = [
        '"hello"',
        'MyTag',
        'Str("test")'
    ];
    
    for (const testCase of testCases) {
        try {
            console.log(`\nComparing: ${testCase}`);
            
            // Simple CanParser approach
            const canAst = canParser.parse(testCase);
            const canGrimVal = builder.fromAst(canAst);
            console.log(`  Simple CanParser result: ${canGrimVal.toString()}`);
            console.log(`  Simple CanParser type: ${canGrimVal.constructor.name}`);
            
            // Robust parser approach (also produces CanAst)
            const robustAst = robustParser.parse(testCase);
            const robustGrimVal = builder.fromAst(robustAst);
            console.log(`  Robust parser result: ${robustGrimVal.toString()}`);
            console.log(`  Robust parser type: ${robustGrimVal.constructor.name}`);
            
            // Compare results
            const match = canGrimVal.toString() === robustGrimVal.toString();
            console.log(`  Results match: ${match}`);
            
        } catch (error) {
            console.error(`  Error parsing "${testCase}":`, error.message);
        }
    }
}

// Run all tests
console.log("\n============================")
console.log("Starting Robust Parser Tests\n");

let lib: GMPLib = await gmp.init();
const builder = new Builder(lib);

testCanAst(builder);
testBasicExpressions(builder);
compareWithLegacy(builder);

console.log("\n=== Robust Parser Tests Complete ===");
