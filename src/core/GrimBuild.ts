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
    GrimVal.canAstMakerMap.set("Str", GrimStr.canAstMaker);
    GrimVal.canAstMakerMap.set("Nat", GrimNat.canAstMaker);
    GrimVal.canAstMakerMap.set("Dec", GrimDec.canAstMaker);

    // includes a few builtin atoms like True, False, None
    GrimVal.canAstMakerMap.set("Tag", GrimTag.canAstMaker);
    // Sym("x") --> can only evaluate if bound lexically in code, otherwise it is an error / Build error (not just an Eval error)
    GrimVal.canAstMakerMap.set("Sym", GrimSym.canAstMaker);
    // Var("x") always evaluates to itself, but could be used to bind a variable with some extra operator or function
    GrimVal.canAstMakerMap.set("Var", GrimVar.canAstMaker);
    GrimVal.canAstMakerMap.set("Bool", GrimBool.canAstMaker);
    GrimVal.canAstMakerMap.set("Some", GrimOpt.canAstMaker);
    GrimVal.canAstMakerMap.set("Error", GrimError.canAstMaker);

    // Collection types
    GrimVal.canAstMakerMap.set("List", GrimList.canAstMaker);
    // version of List with fixed length, very different later in the type system
    // can only by pair or wider
    GrimVal.canAstMakerMap.set("Tuple", GrimTuple.canAstMaker);
    GrimVal.canAstMakerMap.set("Map", GrimMap.canAstMaker);
    GrimVal.canAstMakerMap.set("Set", GrimSet.canAstMaker);
    
    // Function application and definitions
    GrimVal.canAstMakerMap.set("App", GrimApp.canAstMaker);
    GrimVal.canAstMakerMap.set("@", GrimApp.canAstMaker);
    GrimVal.canAstMakerMap.set("Fun", GrimFun.canAstMaker);
    GrimVal.canAstMakerMap.set("Let", GrimLet.canAstMaker);
}
addMakers();
