import gmp from 'gmp-wasm';

import { GrimVal, AstJson, locToStr } from "./GrimVal.js";
import type { Location } from "./GrimVal.js";
import { GrimBool } from "./GrimBool.js";
import { GrimApp, GrimFun, GrimLet } from "./GrimFun.js";
import { GrimTag, GrimVar, GrimSym } from "./GrimAst.js";
import { GrimNat, GrimDec } from "./GrimNum.js";
import { GrimStr } from "./GrimStr.js";
import { GrimError, GrimOpt } from "./GrimOpt.js";
import { GrimList, GrimTuple, GrimMap, GrimSet } from "./GrimCollect.js";

let didInit = false;
function addMakers() {
    if(didInit) {
        return;
    }
    didInit = true;

    // CanAst makers - register the same makers for type-safe CanAst processing
    GrimVal.makerMap.set("Str", GrimStr.maker);
    GrimVal.makerMap.set("Nat", GrimNat.maker);
    GrimVal.makerMap.set("Dec", GrimDec.maker);

    // includes a few builtin atoms like True, False, None
    GrimVal.makerMap.set("Tag", GrimTag.maker);
    // Sym("x") --> can only evaluate if bound lexically in code, otherwise it is an error / Build error (not just an Eval error)
    GrimVal.makerMap.set("Sym", GrimSym.maker);
    // Var("x") always evaluates to itself, but could be used to bind a variable with some extra operator or function
    GrimVal.makerMap.set("Var", GrimVar.maker);
    GrimVal.makerMap.set("Bool", GrimBool.maker);
    GrimVal.makerMap.set("Some", GrimOpt.maker);
    GrimVal.makerMap.set("Error", GrimError.maker);

    // Collection types
    GrimVal.makerMap.set("List", GrimList.maker);
    // version of List with fixed length, very different later in the type system
    // can only by pair or wider
    GrimVal.makerMap.set("Tuple", GrimTuple.maker);
    GrimVal.makerMap.set("Map", GrimMap.maker);
    GrimVal.makerMap.set("Set", GrimSet.maker);
    
    // Function application and definitions
    GrimVal.makerMap.set("App", GrimApp.maker);
    GrimVal.makerMap.set("@", GrimApp.maker);
    GrimVal.makerMap.set("Fun", GrimFun.maker);
    GrimVal.makerMap.set("Let", GrimLet.maker);
}

export { addMakers }
