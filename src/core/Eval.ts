import { List, Map, Set } from 'immutable';

import { GrimVal } from './GrimVal';
import { GrimApp, GrimFun, GrimLet } from './GrimFun';
import { GrimSym, GrimTag } from './GrimAst';
import { Builder } from './Builder';
import { GrimTuple } from './GrimCollect';
import { GrimStr } from './GrimStr';

class EvalState {
    expr: GrimVal;
    env: Map<string, GrimVal>;
    builder: Builder;
    constructor(
        expr: GrimVal,
        env: Map<string, GrimVal>,
        builder: Builder
    ) {
        this.expr = expr;
        this.env = env;
        this.builder = builder;
    }
}

class Eval {
    static evaluate(state: EvalState): EvalState {
        const { expr, env, builder } = state;
        //
        let e2: GrimVal = expr; // for now
        let env2 = env; // for now
        if (expr.isAtom()) {
            return new EvalState(e2, env2, builder);
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
                let value2 = Eval.evaluate(new EvalState(value, theEnv, builder)).expr;
                env2 = env2.set(sym2.value, value2);
            });
            // Evaluate the body in the new environment
            return Eval.evaluate(new EvalState(body, env2, builder))
        }
        else if (expr instanceof GrimApp) {
            // Multiple-dispatch method application or MDMA
            let app = expr as GrimApp;
            if (app.lhs instanceof GrimTag) {
                let tag = app.lhs as GrimTag;
                if (tag.value === "Ignore") {
                    // Special case for Ignore, just return a constant value
                    // test if this ignores the arguments inside the list, by passing Crash() to it
                    e2 = new GrimTag("Ignore");
                    return new EvalState(e2, env2, builder);
                }
                if (tag.value === "Crash") {
                    // Special case for Crash, to test whether certain code is left unevaluated
                    throw new Error(`Crash called with args: ${app.rhs.map(arg => arg.toString()).join(", ")}`);
                }
                if (tag.value === "App" || tag.value === "@" || tag.value === "Fun" || tag.value === "Let") {
                    // Special case for App, Fun, Let, do not evaluate the args
                    const maker = builder.getMaker(tag.value);
                    if (!maker) {
                        throw new Error(`PROGRAMMER ERROR (should not happen): No maker found for special built-in tag: ${tag.value}`);
                    }
                    e2 = maker(app.rhs, builder);
                    return Eval.evaluate(new EvalState(e2, env2, builder));
                }
                let tuple: List<string> = List([tag.value]);
                let argsEvaluated: Array<GrimVal> = app.rhs.map(
                    arg => Eval.evaluate(new EvalState(arg, env, builder)).expr
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
                //console.log("looking for callable tag method for tuple:", tuple.toString());
                if (builder.callableTagMethodTupleToFuncMap.has(tuple)) {
                    // If we have a callable tag method for this tuple, use it
                    e2 = builder.callableTagMethodTupleToFuncMap.get(tuple)!(argsEvaluated);
                    return new EvalState(e2, env2, builder);
                }
                // if not, try casting argumnets from smaller tags to bigger tags
                // e.g. Nat to Int, Int to Rat, etc.
                // This is a way to handle cases like Nat(123) + Int(456)
                if (tuple.size >= 3) {
                    //console.log("No callable tag method found for tuple:", tuple.toString());
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
                            if (builder.hasCast(tagB, tagA)) {
                                // console.log("Found cast from", tagB, ":>", tagA);
                                bigTag = tagB; // tagB is the bigger tag
                                smallTag = tagA; // tagA is the smaller tag
                            }
                            else if (builder.hasCast(tagA, tagB)) {
                                // console.log("Found cast from", tagA, ":>", tagB);
                                bigTag = tagA; // tagB is the smaller tag
                                smallTag = tagB; // tagA is the bigger tag
                            }
                        });
                    });
                    // console.log("hasCast?", bigTag, ":>", smallTag);
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
                    // console.log("newTuple:", newTuple.toString());
                    if (newTuple) {
                        if (builder.callableTagMethodTupleToFuncMap.has(newTuple)) {
                            // If we have a callable tag method for this tuple, use it
                            e2 = builder.callableTagMethodTupleToFuncMap.get(newTuple)!(argsEvaluated);
                            return new EvalState(e2, env2, builder);
                        }
                    }
                }

                // Otherwise, check if we have a tag maker like Bool("True"), Var("x"), etc.
                //console.warn("@ looking for tag maker for", tag.value);
                const maker = builder.getMaker(tag.value);
                if (maker) {
                    // console.warn("@ found tag maker for", tag.value);
                    // TODO deal with this discrepancy (CanAst vs GrimVal)
                    let a = argsEvaluated;
                    e2 = maker(a, builder);
                    return new EvalState(e2, env2, builder);
                }
            }
            // Evaluate the function and arguments
            let fun: GrimFun | null = null;
            if (!builder.isCallable(app.lhs)) {
                let reduced: GrimVal = Eval.evaluate(new EvalState(app.lhs, env, builder)).expr;
                if (reduced instanceof GrimFun) {
                    fun = reduced;
                }
            } else if (app.lhs instanceof GrimFun) {
                fun = app.lhs as GrimFun;
            }
            if (!fun || !builder.isCallable(fun)) {
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
                const argValue = Eval.evaluate(new EvalState(argValueUnEvaluated, env, builder)).expr;
                // override lexically (making a new copy of the environment, but it's not a copy because Immutable.Map is amazing)
                newEnv = newEnv.set(argName, argValue);
            });
            // Evaluate the body of the function in the new environment
            e2 = Eval.evaluate(new EvalState(fun.body, newEnv, builder)).expr;
        }
        return new EvalState(e2, env2, builder);
    }
}

export { Eval, EvalState };
