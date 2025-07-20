import { Map } from 'immutable';

import { GrimVal } from './GrimVal';
import { addMakers } from './GrimBuild';
import { GrimApp, GrimFun } from './GrimFun';
import { GrimSym } from './GrimAst';

class EvalState {
    expr: GrimVal;
    env: Map<string, GrimVal> = Map();
    constructor(
        expr: GrimVal,
        env: Map<string, GrimVal> = Map()
    ) {
        this.expr = expr;
        this.env = env;
    }
}

class Eval {
    static evaluate(state: EvalState): EvalState {
        addMakers(); // Ensure all makers are registered
        const { expr, env } = state;
        //
        let e2: GrimVal = expr; // for now
        let env2 = env; // for now
        if (expr.isAtom()) {
            return new EvalState(e2, env2);
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
            // Evaluate the function and arguments
            let app = expr as GrimApp;
            let fun: GrimFun | null = null;
            if (!app.lhs.isCallable()) {
                let reduced: GrimVal = Eval.evaluate(new EvalState(app.lhs, env)).expr;
                if (reduced instanceof GrimFun) {
                    fun = reduced;
                }
            }
            else if (app.lhs instanceof GrimFun) {
                fun = app.lhs as GrimFun;
            }
            if (!fun || !fun.isCallable()) {
                throw new Error(`Expected a callable GrimVal for first argument to App(), got ${app.lhs}`);
            }
            //
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
                const argValue = Eval.evaluate(new EvalState(argValueUnEvaluated, env)).expr;
                // override lexically (making a new copy of the environment, but it's not a copy because Immutable.Map is amazing)
                newEnv = newEnv.set(argName, argValue);
            });
            // Evaluate the body of the function in the new environment
            e2 = Eval.evaluate(new EvalState(fun.body, newEnv)).expr;
        }
        return new EvalState(e2, env2);
    }
}

export { Eval, EvalState };
