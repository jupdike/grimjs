import { List, Map } from 'immutable';

import { GrimVal } from './GrimVal';
import { GrimApp, GrimFun } from './GrimFun';
import { GrimSym, GrimTag } from './GrimAst';
import { Builder } from './Builder';

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
        else if (expr instanceof GrimApp) {
            // Multiple-dispatch method application or MDMA
            let app = expr as GrimApp;
            if (app.lhs instanceof GrimTag) {
                let tag = app.lhs as GrimTag;
                let tuple: List<string> = List([tag.value]);
                let argsEvaluated: Array<GrimVal> = app.rhs.map(arg => Eval.evaluate(new EvalState(arg, env, builder)).expr);
                argsEvaluated.forEach(arg => {
                    let type = arg.head();
                    tuple = tuple.push(type);
                });
                // Check if we have a callable tag method for this tuple
                if (builder.callableTagMethodTupleToFuncMap.has(tuple)) {
                    // If we have a callable tag method for this tuple, use it
                    e2 = builder.callableTagMethodTupleToFuncMap.get(tuple)!(argsEvaluated);
                    return new EvalState(e2, env2, builder);
                }
                // Otherwise, check if we have a tag maker like Bool("True"), Var("x"), etc.
                // const maker = builder.getMaker(tag.value);
                // if (maker) {
                //     // TODO deal with this discrepancy (CanAst vs GrimVal)
                //     e2 = maker(argsEvaluated, builder);
                // }
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
            fargs.forEach((arg, index) => {
                const a = arg as GrimSym;
                const argName = a.value;
                if (!argName || typeof argName !== 'string') {
                    throw new Error(`GrimSym ${a} has no name`);
                }
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
