import gmp from 'gmp-wasm';

import parser from  "../parser/_parser-old.js"
import { Ast } from "../parser/OldAst.js"
import { GrimVal, AstJson, locToStr } from "./GrimVal.js";
import type { Location } from "./GrimVal.js";
import { GrimBool } from "./GrimBool.js";
import { GrimApp, GrimFun, GrimLet } from "./GrimFun.js";
import { GrimTag, GrimVar, GrimSym } from "./GrimAst.js";
import { GrimNat, GrimDec } from "./GrimNum.js";
import { GrimStr } from "./GrimStr.js";
import { GrimError, GrimOpt } from "./GrimOpt.js";
import { GrimList, GrimTuple, GrimMap, GrimSet } from "./GrimCollect.js";

function addMakers() {
    // CanAst makers - register the same makers for type-safe CanAst processing
    GrimVal.makerMap.set("Str", GrimStr.canAstMaker);
    GrimVal.makerMap.set("Nat", GrimNat.canAstMaker);
    GrimVal.makerMap.set("Dec", GrimDec.canAstMaker);

    // includes a few builtin atoms like True, False, None
    GrimVal.makerMap.set("Tag", GrimTag.canAstMaker);
    // Sym("x") --> can only evaluate if bound lexically in code, otherwise it is an error / Build error (not just an Eval error)
    GrimVal.makerMap.set("Sym", GrimSym.canAstMaker);
    // Var("x") always evaluates to itself, but could be used to bind a variable with some extra operator or function
    GrimVal.makerMap.set("Var", GrimVar.canAstMaker);
    GrimVal.makerMap.set("Bool", GrimBool.canAstMaker);
    GrimVal.makerMap.set("Some", GrimOpt.canAstMaker);
    GrimVal.makerMap.set("Error", GrimError.canAstMaker);

    // Collection types
    GrimVal.makerMap.set("List", GrimList.canAstMaker);
    // version of List with fixed length, very different later in the type system
    // can only by pair or wider
    GrimVal.makerMap.set("Tuple", GrimTuple.canAstMaker);
    GrimVal.makerMap.set("Map", GrimMap.canAstMaker);
    GrimVal.makerMap.set("Set", GrimSet.canAstMaker);
    
    // Function application and definitions
    GrimVal.makerMap.set("App", GrimApp.canAstMaker);
    GrimVal.makerMap.set("@", GrimApp.canAstMaker);
    GrimVal.makerMap.set("Fun", GrimFun.canAstMaker);
    GrimVal.makerMap.set("Let", GrimLet.canAstMaker);
}
addMakers();
