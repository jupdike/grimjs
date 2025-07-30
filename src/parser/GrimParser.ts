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
}
export { GrimParser };
