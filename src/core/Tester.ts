import * as parserCanon from '../parser/_parser-canon.js';
import { GrimModule } from "./GrimModule.js";
import { Location, CanApp, CanAst, CanStr, CanTag, CanTaggedApp } from "../parser/CanAst.js";
import { GrimVal } from "./GrimVal.js";
import { Eval, EvalState } from "./Eval.js";

interface TestEntry {
    sugar: string;
    desugared: string;
    built: string;
    canonical: string;
    evaluated: string;
}

interface TestSuite {
    section: string;
    entries: Array<TestEntry>;
}

class Tester {
    constructor(private module: GrimModule) {}

    static parseTestLines(yaml: string): Array<TestSuite> {
        // Parse the YAML string into a JavaScript object
        // Real YAML messes with my quotation marks, so we use a custom parser that preserves explicit quotes
        let ret: Array<TestSuite> = [];
        let currentSuite: TestSuite = { section: "", entries: [] };
        let currentEntry: TestEntry = {
            sugar: "",
            desugared: "",
            built: "",
            canonical: "",
            evaluated: "",
        };
        yaml.split("\n").forEach((line) => {
            line = line.trim();
            if (line.length === 0) {
                // Skip empty lines
                return;
            }
            if (line.startsWith("#-")) {
                let section = line.substring(1).trim(); // Remove comment marker
                if (section.replace(/[-]+/g, '') === "") { // just an ascii horizontal rule or line
                    // do nothing
                    return;
                }
            }
            if (line.startsWith("#")) {
                let section = line.substring(1).trim(); // Remove comment marker
                if (section !== "") {
                    if (currentSuite.entries.length > 0) {
                        ret.push(currentSuite); // Save the previous suite (but not an empty one)
                    }
                    currentSuite = { section: section, entries: [] }; // Start a new suite
                } else {
                    if (currentEntry.sugar !== "") {
                        currentSuite.entries.push(currentEntry); // Save the current entry
                    }
                    // start over for blank comments
                    currentEntry = {
                        sugar: "",
                        desugared: "",
                        built: "",
                        canonical: "",
                        evaluated: "",
                    };
                }
                return;
            } else {
                if (line.indexOf(":") > 0) {
                    // This is a key-value pair
                    let parts = line.split(":");
                    let key = parts[0].trim();
                    let value = parts.slice(1).join(":").trim();
                    currentEntry[key as keyof TestEntry] = value;
                }
            }
        });
        ret.push(currentSuite);
        console.log(`Parsed ${ret.length} test suites from YAML`);
        return ret;
    }

    runTests(testSuites: Array<TestSuite>) {
        //console.error(`Found ${this.castPairs.size} cast pairs`);
        let n = 0;
        if (!testSuites || testSuites.length === 0) {
            console.warn("No test suites provided to GrimModule.runTests");
            return;
        }
        for (const suite of testSuites) {
            console.log('#-------------------------------------------------------------------------');
            console.log(`# ${suite.section}`);
            suite.entries.forEach((entry: TestEntry) => {
                this.testOneEntry(entry);
                n++;
            });
        }
        console.log(`All ${n} tests completed.`);
    }

    testParseDefs(definitions: Array<string>) {
        console.log(`Testing ${definitions.length} definitions...`);
        for (const def of definitions) {
            this.analyzeOne(def, false, "Definition"); // Analyze each definition
        }
        console.log(`${definitions.length} definitions parsed successfully.`);
    }

    // TESTING CODE
    locToStr(loc: Location | undefined): string {
        if(!loc) {
            return "unknown location";
        }
        return `line ${loc.start.line} col ${loc.start.column} to line ${loc.end.line} col ${loc.end.column}`;
    }

    check(str: string, start: string | null = null, onlyErrors = false): CanAst {
        start = start || "Start";
        try {
            var ret = this.module.parser.parse(str, {startRule: start});
            // if (!onlyErrors) {
            //     console.log('---');
            //     console.log(str, '\n  ~~ parses as ~~>\n', ret.toString() );
            // }
            return ret;
        } catch (e) {
            console.log('---');
            //console.log("Error", [e.message]);
            console.log(str, '  ~~ EXCEPTION THROWN as ~~>\n  ', `Error('${e.message}', '${this.locToStr(e.location)}')` );
            //return Ast( e.location || 'unknown', "Error", [e.message] );
            return new CanTaggedApp(e.location,
                new CanTag(e.location, "Error"),
                [e.message, e.location].map(x => new CanStr(e.location, x))
            );
        }
    }

    analyzeOne(str: string, onlyErrors = false, startRule: string | null = null) {
        let ast: CanAst = this.check(str, startRule, onlyErrors);
        //console.log('Parsed AST JSON    :', JSON.stringify(ast, null, 2));
        //console.log('Parsed AST toString:', ast.toString());
        let val = this.module.fromAst(ast);
        //console.log('GrimVal from AST   :', val.toString());
        let canon = val.toCanonicalString();
        //console.log('Canonical string   :', canon);
        if (!onlyErrors) {
            console.log(canon);
        }
        //let state = new EvalState(val, Map(), this);
        // let result: GrimVal | null = null;
        // try {
        //     result = Eval.evaluate(state).expr;
        // } catch (e) {
        //     console.error('Eval error          :', e);
        // }
        // if (result) {
        //     console.log('Eval result        :', result.toString());
    }

    private evalOne(val: GrimVal): string {
        let state = new EvalState(val, this.module.evaluatedModuleEnv(), this.module);
        let result: GrimVal | null = null;
        try {
            result = Eval.evaluate(state).expr;
        } catch (e) {
            console.error('Eval error:', e);
            return `Error('${e.message}')`;
        }
        if (result) {
            return result.toString();
        }
        return "<ERROR_SO_NO_RESULT>";
    }

    private parseCanon(input: string): CanAst | null {
        try {
            return parserCanon.parse(input, { startRule: "Start" });
        } catch (e) {
            console.error('Error parsing canonical:', e);
            return null;
        }
    }

    readonly reportMismatches: boolean = true; // <-- Set to true to report mismatches in test output
    // ^^^ Set to false to copy-paste large chunks of output back into test-table.yaml
    private testOneEntry(entry: TestEntry) {
        if (!entry.sugar) {
            console.warn("Test entry has no sugar:", entry);
            return;
        }
        console.log(`sugar:       ${entry.sugar}`);
        let ast: CanAst | null = this.module.sugarToAst(entry.sugar, { startRule: "Expression" });
        if (!ast) {
            console.error("Failed to parse sugar:", entry.sugar);
            return;
        }
        let oneAstStr = ast.toString();
        console.log(`desugared:   ${oneAstStr}`);
        if (this.reportMismatches && oneAstStr !== entry.desugared) {
            console.error(`Desugared AST does not match expected: ${oneAstStr} !== ${entry.desugared}`);
        }
        let built: GrimVal = this.module.fromAst(ast);
        console.log(`built:       ${built.toString()}`);
        if (this.reportMismatches && built.toString() !== entry.built) {
            console.error(`Built GrimVal does not match expected: ${built.toString()} !== ${entry.built}`);
        }
        let canonical: string = built.toCanonicalString();
        console.log(`canonical:   ${canonical}`);
        if (this.reportMismatches) {
            // parse using ParserCanon and compare that too
            let parsedCanon: CanAst | null = this.parseCanon(canonical);
            if (!parsedCanon) {
                throw new Error(`Failed to parse canonical string: ${canonical}`);
            }
            // Check if the parsed canonical string matches the expected canonical string
            let canonStr = parsedCanon.toCanonicalString();
            //console.log(`parsedCanon: ${canonStr}`);
            if (canonStr !== entry.canonical) {
                console.error(`Parsed canonical string does not match expected: ${canonStr} !== ${entry.canonical}`);
            }
        }
        if (this.reportMismatches && canonical !== entry.canonical) {
            console.error(`Canonical string does not match expected: ${canonical} !== ${entry.canonical}`);
        }
        if (entry.evaluated !== "noeval") {
            let evaluated: string = this.evalOne(built);
            console.log(`evaluated:   ${evaluated}`);
            if (this.reportMismatches && evaluated !== entry.evaluated) {
                console.error(`Evaluated result does not match expected: ${evaluated} !== ${entry.evaluated}`);
            }
        }
        console.log("#");
    }
}

export { Tester };
export type { TestEntry, TestSuite };
