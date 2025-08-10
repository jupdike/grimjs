import { List, Map, Set } from 'immutable';

import { GrimVal } from './GrimVal';
import { GrimBool } from './GrimBool';
import { GrimApp, GrimFun, GrimLet } from './GrimFun';
import { GrimSym, GrimTag } from './GrimAst';
import { GrimModule } from './GrimModule';
import { GrimTuple } from './GrimCollect';
import { GrimStr } from './GrimStr';
import type { MacroMatchRule } from './GrimModule';

class EvalState {
    expr: GrimVal;
    env: Map<string, GrimVal>;
    module: GrimModule;
    constructor(
        expr: GrimVal,
        env: Map<string, GrimVal>,
        module: GrimModule
    ) {
        this.expr = expr;
        this.env = env;
        this.module = module;
    }
}

class Eval {
    static matchMacroRule(
        rule: MacroMatchRule,
        args: Array<GrimVal>,
        argsEvald: Array<GrimVal | null>,
        env: Map<string, GrimVal>,
        module: GrimModule
    ): {
        match: boolean, bindings: Map<string, GrimVal>
    } {
        let match = true;
        let bindings: Map<string, GrimVal> = Map(); // unevaluated bindings
        for (let i = 0; i < rule.args.length; i++) {
            console.error(`Testing argument ${i}`);
            const pattern: GrimVal = rule.args[i];
            let actual = args[i];
            let evaluated: GrimVal | null = argsEvald[i];
            if (pattern instanceof GrimTag && pattern.value === "Dummy") {
                // Dummy variable name means do not evaluate and do not bind and always match
                // nothing to do but go to next i value
                console.error(`Pattern is Dummy, always matches`);
            } else if (pattern instanceof GrimSym) {
                // bind the symbol to the unevaluated actual value
                bindings = bindings.set(pattern.value, actual);
            } else if (pattern.isAtom()) {
                if (!evaluated) {
                    evaluated = Eval.evaluate(new EvalState(actual, env, module)).expr;
                    console.error(`Evaluated actual argument ${i} for pattern ${pattern.toCanonicalString()}:`, evaluated.toString());
                    argsEvald[i] = evaluated;
                }
                console.error(`Argument ${i} for pattern ${pattern.toCanonicalString()}:`, evaluated.toString());
                if (evaluated.equals(pattern)) {
                    console.error(`Great, we got an argument match`);
                }
                else if (!(evaluated instanceof GrimTag)) {
                    match = false;
                    console.error("Broke");
                    break;
                }
            }
            // TODO a complicated case, which could require careful recursion to evaluate just the right amount
            // else if (pattern instanceof GrimApp) {
            //     if (!(actual instanceof GrimApp)) {
            //         match = false;
            //         break;
            //     }
            // }
        }
        return { match, bindings };
    }

    static genSymSet: Set<string> = Set();

    static genSym(key: string): string {
        // get a random 6 digit hexidecimal code
        let newKey: string;
        do {
            let r: number = Math.floor(Math.random() * 16777215);
            newKey = `__sym_${key}_${r.toString(16)}__`;
            console.error(`Generated new symbol: ${newKey}`);
        } while (this.genSymSet.has(newKey)); // probably not going to happen, but just in case
        this.genSymSet.add(newKey);
        return newKey;
    }

    static substituteSym(body: GrimVal, oldKey: string, key: string): GrimVal {
        // Substitute all instances of oldKey with key in the body
        return body.exprMap((node) => {
            if (node instanceof GrimSym && node.value === oldKey) {
                return new GrimSym(key);
            }
            return node;
        });
    }

    static evaluate(state: EvalState): EvalState {
        const { expr, env, module } = state;
        //
        let e2: GrimVal = expr; // for now
        let env2 = env; // for now
        if (expr.isAtom()) {
            return new EvalState(e2, env2, module);
        }
        else if (expr instanceof GrimSym) {
            // Look up the symbol in the environment
            const sym = expr as GrimSym;
            const value = env.get(sym.value);
            if (value) {
                e2 = value;
            } else {
                throw new Error(`Symbol '${sym.value}' not found in environment: ${env.toString()}`);
            }
        }
        else if (expr instanceof GrimLet) {
            let letExpr = expr as GrimLet;
            let body = letExpr.body;
            let bindings: Array<GrimVal> = letExpr.bindings;
            // add the bindings to the environment env2
            bindings.forEach((binding, index) => {
                //console.log(`Binding ${index}: ${binding}`);
                if (!(binding instanceof GrimTuple) || binding.tuple.size !== 2) {
                    throw new Error(`Expected GrimTuple in bindings, got ${binding}`);
                }
                const [sym, value] = binding.tuple.toArray();
                let sym2 = sym as GrimSym;
                if (sym2 instanceof GrimApp) {
                    // try to see if it's Sym@(rhs), treat it the same
                    const oneApp = sym2 as GrimApp;
                    if (oneApp.lhs instanceof GrimTag && oneApp.lhs.value == "Sym" &&
                        oneApp.rhs.length === 1 && oneApp.rhs[0] instanceof GrimStr) {
                        sym2 = new GrimSym(oneApp.rhs[0].value); // use the Sym part of the App, as if evaluated
                        //console.log(`Converted Sym App to Sym: ${sym2.value}`);
                    }
                }
                if (!sym2 || !(sym2 instanceof GrimSym)) {
                    throw new Error(`Expected GrimSym as first element of binding, got ${sym}`);
                }
                let theEnv = env2; // allow earlier bindings in this same Let to be used in later bindings
                // or this could be 'env' to not allow that
                let value2 = Eval.evaluate(new EvalState(value, theEnv, module)).expr;
                env2 = env2.set(sym2.value, value2);
            });
            // Evaluate the body in the new environment
            return Eval.evaluate(new EvalState(body, env2, module))
        }
        else if (expr instanceof GrimApp) {
            let app = expr as GrimApp;
            if (app.lhs instanceof GrimTag) {
                let tag = app.lhs as GrimTag;
                if (tag.value === "Unquote") {
                    if (app.rhs.length !== 1) {
                        throw new Error(`Unquote expected 1 argument, got ${app.rhs.length}`);
                    }
                    e2 = app.rhs[0];
                    if (e2 instanceof GrimApp) {
                        if (e2.lhs instanceof GrimTag && e2.lhs.value === "Quote") {
                            e2 = e2.rhs[0];
                            e2 = Eval.evaluate(new EvalState(e2, env, module)).expr;
                        }
                    } else {
                        throw new Error("Unquote expected Quoted argument, or expected Unquote to be used somewhere within a Quote() expression");
                    }
                    return new EvalState(e2, env, module);
                }
                if (tag.value === "Quote") {
                    // TODO remove this when we can use Macros
                    // Special case for Quote, just return the first argument
                    if (app.rhs.length !== 1) {
                        throw new Error(`Quote expected 1 argument, got ${app.rhs.length}`);
                    }
                    e2 = app.rhs[0]; // return the first argument as is, unless it includes unquote somewhere
                    // TODO make this more recursive structurally, so unquotes anywhere inside a Quote get reversed out as expected
                    if (e2 instanceof GrimApp) {
                        if (e2.lhs instanceof GrimTag && e2.lhs.value === "Unquote") {
                            e2 = e2.rhs[0];
                            e2 = Eval.evaluate(new EvalState(e2, env, module)).expr;
                        }
                    }
                    // test if this ignores the arguments inside the list, by passing Crash() to it
                    return new EvalState(e2, env2, module);
                }
                if (tag.value === "If3") {
                    // TODO remove this when we can use Macros
                    // Special case for If3, evaluate the condition and then return the appropriate branch
                    if (app.rhs.length !== 3) {
                        throw new Error(`If3 expected 3 arguments, got ${app.rhs.length}`);
                    }
                    const condition = Eval.evaluate(new EvalState(app.rhs[0], env, module)).expr;
                    if (condition instanceof GrimBool && condition.isTrue()) {
                        e2 = Eval.evaluate(new EvalState(app.rhs[1], env, module)).expr; // return the second argument as is
                    } else if (condition instanceof GrimBool && condition.isFalse()) {
                        e2 = Eval.evaluate(new EvalState(app.rhs[2], env, module)).expr; // return the third argument as is
                    } else {
                        throw new Error(`If3 expected a GrimBool as the first argument, got ${condition}`);
                    }
                    return new EvalState(e2, env2, module);
                }
                if (tag.value === "Ignore") {
                    // TODO remove this when we can use Macros
                    // Special case for Ignore, just return a constant value
                    // test if this ignores the arguments inside the list, by passing Crash() to it
                    e2 = new GrimTag("Ignore");
                    return new EvalState(e2, env2, module);
                }
                if (tag.value === "Crash") {
                    // Special case for Crash, to test whether certain code is left unevaluated
                    throw new Error(`Crash called with args: ${app.rhs.map(arg => arg.toString()).join(", ")}`);
                }
                if (tag.value === "App" || tag.value === "@" || tag.value === "Fun" || tag.value === "Let") {
                    // Special case for App, Fun, Let, do not evaluate the args
                    const maker = module.getMaker(tag.value);
                    if (!maker) {
                        throw new Error(`PROGRAMMER ERROR (should not happen): No maker found for special built-in tag: ${tag.value}`);
                    }
                    e2 = maker(app.rhs, module);
                    return Eval.evaluate(new EvalState(e2, env2, module));
                }

                // Check if we have a list of macro rules for this tag
                let args = app.rhs; // unevaluated arguments
                if (module.hasMacroMatchRule(tag.value)) {
                    console.error("Found rule for ", tag.value);
                    const rules: List<MacroMatchRule> = module.getMacroMatchRules(tag.value);
                    // a space to put evaluated arguments, but only when needed
                    let argsEvald: Array<GrimVal | null> = [];
                    for (let i = 0; i < args.length; i++) {
                        argsEvald.push(null);
                    }
                    for (let rule of rules) {
                        if (rule.args.length !== args.length) {
                            throw new Error(`MacroMatchRule for tag ${tag.value} expected ${rule.args.length} arguments, got ${args.length}`);
                        }
                    }
                    for (let rule of rules) {
                        console.error("Testing ", args.map(arg => arg.toString()).join(", "), " against macro match rule:", rule.args.map(a => a.toCanonicalString()).join(", "));
                        let {match, bindings} = Eval.matchMacroRule(rule, args, argsEvald, env2, module);
                        console.error("Macro match result:", match, "with bindings:", bindings.toString(), "\n");
                        if (match) {
                            // We have a match, so we can evaluate the body with the bindings
                            let body = rule.body;
                            // Create a new environment with the bindings
                            let newEnv = env2;
                            // TODO is this right? this should be unevaluated, substituted, then evaluated ???
                            bindings.forEach((value, key) => {
                                // Evaluate the value in the original environment
                                // let evaluatedValue = Eval.evaluate(new EvalState(value, env, module)).expr;
                                newEnv = newEnv.set(key, value);
                            });
                            console.error(`Macro matched for tag ${tag.value}, evaluating body with bindings:`, bindings.toString());
                            e2 = Eval.evaluate(new EvalState(body, newEnv, module)).expr;
                            return new EvalState(e2, env2, module);
                        }
                    }
                }

                // --------------------------------------------------------------
                // Multiple-dispatch method application or MDMA
                // test for callable tuple after Macro, to avoid extra evaluation
                let tuple: List<string> = List([tag.value]);
                let argsEvaluated: Array<GrimVal> = app.rhs.map(
                    arg => Eval.evaluate(new EvalState(arg, env, module)).expr
                );
                //console.log("Evaluated args:", argsEvaluated.map(arg => arg.toString()).join(", "));
                argsEvaluated.forEach(arg => {
                    let type = arg.head();
                    if (type === "Error") {
                        // If any argument is an error, propagate it
                        console.error("Error in argument:", arg.toString());
                    }
                    tuple = tuple.push(type);
                });
                // Check if we have a callable tag method for this tuple
                //console.error("looking for callable tag method for tuple:", tuple.toString());
                if (module.callableTagMethodTupleToFuncMap.has(tuple)) {
                    // If we have a callable tag method for this tuple, use it
                    e2 = module.callableTagMethodTupleToFuncMap.get(tuple)!(argsEvaluated);
                    return new EvalState(e2, env2, module);
                }
                // if not, try casting argumnets from smaller tags to bigger tags
                // e.g. Nat to Int, Int to Rat, etc.
                // This is a way to handle cases like Nat(123) + Int(456)
                if (tuple.size >= 3) {
                    //console.error("No callable tag method found for tuple:", tuple.toString());
                    // Try to find a cast for this pair of tags, in either direction, then
                    // use SmallerTag to BiggerTag, e.g. Nat to Int, Int to Rat, etc.
                    let smallTag: string = "";
                    let bigTag: string = "";
                    tuple.slice(1).forEach((tagA, index) => {
                        tuple.slice(1).forEach((tagB, index) => {
                            if (tagA === tagB || bigTag !== "" && smallTag !== "") {
                                return; // skip if it's the same tag or we found a pair already
                            }
                            // console.log("Checking cast for tagA, tagB:", tagA, tagB);
                            if (module.hasCast(tagB, tagA)) {
                                // console.log("Found cast from", tagB, ":>", tagA);
                                bigTag = tagB; // tagB is the bigger tag
                                smallTag = tagA; // tagA is the smaller tag
                            }
                            else if (module.hasCast(tagA, tagB)) {
                                // console.log("Found cast from", tagA, ":>", tagB);
                                bigTag = tagA; // tagB is the smaller tag
                                smallTag = tagB; // tagA is the bigger tag
                            }
                        });
                    });
                    //console.error("hasCast?", bigTag, ":>", smallTag);
                    let newTuple: List<string> | null = null;
                    newTuple = tuple.map((x, index) => {
                        if (index === 0) {
                            return x; // keep the tag name as is
                        }
                        if (x !== bigTag) {
                            return bigTag; // replace smaller tag with bigger tag
                        }
                        return x;
                    });
                    //console.error("newTuple:", newTuple.toString());
                    if (newTuple) {
                        if (module.callableTagMethodTupleToFuncMap.has(newTuple)) {
                            // If we have a callable tag method for this tuple, use it
                            e2 = module.callableTagMethodTupleToFuncMap.get(newTuple)!(argsEvaluated);
                            return new EvalState(e2, env2, module);
                        }
                    }
                }

                // -------------------------------------------------------------------------
                // Otherwise, check if we have a tag maker like Bool("True"), Var("x"), etc.
                //console.warn("@ looking for tag maker for", tag.value);
                const maker = module.getMaker(tag.value);
                if (maker) {
                    // console.warn("@ found tag maker for", tag.value);
                    // TODO deal with this discrepancy (CanAst vs GrimVal)
                    let a = argsEvaluated;
                    e2 = maker(a, module);
                    return new EvalState(e2, env2, module);
                }
            }
            // Evaluate the function and arguments
            let fun: GrimFun | null = null;
            if (!module.isCallable(app.lhs)) {
                let reduced: GrimVal = Eval.evaluate(new EvalState(app.lhs, env, module)).expr;
                if (reduced instanceof GrimFun) {
                    fun = reduced;
                }
            } else if (app.lhs instanceof GrimFun) {
                fun = app.lhs as GrimFun;
            }
            if (!fun || !module.isCallable(fun)) {
                throw new Error(`Expected a callable GrimVal for first argument to App(), got ${app.lhs}`);
            }
            const fargs = fun.args;
            if (fargs.length !== app.rhs.length) {
                throw new Error(`Function ${fun} expected ${fargs.length} arguments, got ${app.rhs.length}`);
            }
            if (fargs.some(arg => !(arg instanceof GrimSym))) {
                throw new Error(`Function ${fun} has non-symbol arguments: ${fargs}`);
            }
            let newEnv = env;
            let set = Set<string>();
            fargs.forEach((arg, index) => {
                const a = arg as GrimSym;
                const argName = a.value;
                if (!argName || typeof argName !== 'string') {
                    throw new Error(`GrimSym ${a} has no name`);
                }
                if (set.has(argName)) {
                    throw new Error(`Duplicate argument name '${argName}' in function ${fun}`);
                }
                set = set.add(argName);
                // Create a new environment with the argument name bound to the evaluated value
                const argValueUnEvaluated = app.rhs[index];
                const argValue = Eval.evaluate(new EvalState(argValueUnEvaluated, env, module)).expr;
                // override lexically (making a new copy of the environment, but it's not a copy because Immutable.Map is amazing)
                newEnv = newEnv.set(argName, argValue);
            });
            // Evaluate the body of the function in the new environment
            e2 = Eval.evaluate(new EvalState(fun.body, newEnv, module)).expr;
        }
        return new EvalState(e2, env2, module);
    }
}

export { Eval, EvalState };
