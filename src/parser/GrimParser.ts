import * as peggy from "peggy";
import { readFileSync } from "fs";
import { CanAst } from "./CanAst";

class GrimParser {
    private parser: peggy.Parser;
    private opMap: Record<string, string> = {};
    private tripletSet: Set<string> = new Set();
    /**
     * Initializes the GrimParser with a pre-parsed boot file.
     * @param bootFilePath - The path to the boot file containing operator definitions.
     */
    constructor(preParseBootFilePath: string) {
        this.loadPreParse(preParseBootFilePath)
    }
    private loadPreParse(bootFilePath: string) {
        const bootFileContent = readFileSync(bootFilePath, "utf8");
        let preParse = bootFileContent.split("\n").filter(line => line.startsWith("#"))
            .map(line => {
                let ps = line.substring(1).trim().split(/\s+/g);
                return { cmd: ps[0], prec: ps[1], op: ps[2], tag: ps[3] };
            });
        if (preParse.length > 0) {
            console.log(`${preParse.length} pre-parse commands found in .grim file.`);
        }
        this.opMap = {};
        this.tripletSet = new Set();
        for (let p of preParse) {
            if (p.cmd.startsWith("infix")) {
                let op = p.op;
                let tag = p.tag;
                this.opMap[op] = tag;
                let triplet = `${p.cmd.slice(-1)}${p.prec}${op}`;
                //console.log(`Adding ${triplet} to tripleSet`);
                this.tripletSet.add(triplet);
            }
        }
        let allStr = readFileSync("src/parser/ParserSugar.pegjs", "utf8")
        this.parser = peggy.generate(
            [ { source: "ParserSugar.pegjs", text: allStr } ],
            {   allowedStartRules: ["Start","Definition","Expression"],
                format: "commonjs",
                dependencies: {
                    "canast": "../../../../src/parser/CanAst.js",
                }
             }
        );
    }
    isValidOp(direction: string, assocLevel: number, opText: string): boolean {
        let key = `${direction}${assocLevel}${opText}`;
        let ret = this.tripletSet.has(key);
        //console.log(`Checking for existence of operator: ${key}, result: ${ret}`);
        return ret;
    }
    parse(input: string, options: any): CanAst {
        let that = this;
        options = options || {};
        options.startRule = options.startRule || "Start";
        options.opMap = this.opMap;
        options.isValidOp = function(direction: string, assocLevel: number, opText: string): boolean {
            return that.isValidOp(direction, assocLevel, opText);
        };
        //@ts-ignore
        return this.parser.parse(input, options);
    }
    static groupDefinitions(lines: Array<string>): Array<string> {
        // Group the lines into a list of definitions based on balanced delimiters and simple leading whitespace
        //
        // Should follow most programmer's intuition about how a chunk of code is indented by most text editors
        // and how it is grouped by balanced delimiters, e.g. (), [], {}, etc.
        // This allows users to write a lot of blocks of code without needing to use semicolons, or
        // forcing programmers to use double newlines to separate definitions.
        //
        // Group lines based on these intuitive rules:
        // 1. New definitions start on a new line with no leading whitespace
        // 2. Definitions can be continued on the next line with leading whitespace
        // 3. If a line has no leading whitespace, it completes the definition, if it has balanced delimiters
        // 4. Definitions must be balanced by delimiters by the time they end
        // 5. Comments starting with // are ignored, and empty lines (or lines with only whitespace) are ignored
        // 6. Lines with tabs are not allowed, as they are not consistent across editors
        let ret: Array<string> = [];
        let delimiterStack: Array<number> = [];
        let oneDefinition: Array<string> = [];
        lines.forEach((line) => {
            if (line.startsWith("#") || line.startsWith("//") || line.length < 1) {
                // Skip #xyz pre-parse commands, and comments
                return;
            }
            if (line.indexOf("\t") >= 0) {
                throw new Error("Tab characters are not allowed in Grim. Deal with it.");
            }
            line = line.trimEnd();
            let startedOutBalanced = delimiterStack.length === 0;
            let leadingWhitespaceCount = (line.match(/^\s*/)?.[0] || "").length;
            //console.log(`Processing line: '${line}' with leading whitespace count: ${leadingWhitespaceCount} and ended with delimiter stack: [${delimiterStack.join(", ")}]`);
            // Check for opening and closing delimiters
            for (var i = 0; i < line.length; i++) {
                var char = line[i];
                // track where opening delimiters are found
                if (char === "(" || char === "{" || char === "[") {
                    delimiterStack.push(leadingWhitespaceCount);
                } else if (char === ")" || char === "}" || char === "]") {
                    if (delimiterStack.length === 0) {
                        throw new Error(`Unmatched closing delimiter: ${char}`);
                    }
                    delimiterStack.pop();
                }
            }
            // If we have balanced delimiters, and no leading whitespace, add the line to the list
            if (startedOutBalanced && delimiterStack.length === 0 && leadingWhitespaceCount === 0) {
                //console.error(`Self-contained definition found: '${line}'`);
                // make sure not to nix accumulated lines
                if (oneDefinition.length > 0) {
                    ret.push(oneDefinition.join("\n"));
                    oneDefinition = []; // Reset for the next definition
                }
                ret.push(line); // Add the line as a complete definition
            }
            else if (delimiterStack.length > 0 && leadingWhitespaceCount > 0) {
                //console.error(`Continuing definition with leading whitespace: '${line}'`);
                // If we are still inside a definition, accumulate the line
                oneDefinition.push(line);
                //console.error(`Accumulated definition: '${oneDefinition.join("\n")}'`);
            }
            else if (delimiterStack.length === 0) {
                //console.error(`Got to the end of a definition: '${line}', oneDefinition.length: ${oneDefinition.length}`);
                if (oneDefinition.length > 0) {
                    oneDefinition.push(line);
                    ret.push(oneDefinition.join("\n"));
                    oneDefinition = []; // Reset for the next definition
                } else {
                    //console.error(`Extra unexpected ending delimiters: '${line}'`);
                }
            }
            else {
                //console.error(`Unmatched delimiters or unexpected leading whitespace in line: '${line}'`);
                // Otherwise, continue building the current definition
                oneDefinition.push(line);
            }
        });
        if (oneDefinition.length > 0) {
            // If there's any remaining definition, add it
            ret.push(oneDefinition.join("\n"));
        }
        return ret;
    }
}
export { GrimParser };
