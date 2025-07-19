import gmp from 'gmp-wasm';

import parser from  "../parser/_parser-old.js"
import { Ast } from "../parser/OldAst.js"
import { GrimVal, AstJson, locToStr } from "./GrimVal.js";
import type { Location } from "./GrimVal.js";
import { GrimBool } from "./GrimBool.js";
import { GrimApp, GrimFun, GrimLet } from "./GrimFun.js";
import { GrimAst, GrimTag, GrimVar, GrimSym } from "./GrimAst.js";
import { GrimNat, GrimDec } from "./GrimNum.js";
import { GrimStr } from "./GrimStr.js";
import { GrimError, GrimOpt } from "./GrimOpt.js";
import { GrimList, GrimTuple, GrimMap, GrimSet } from "./GrimCollect.js";

function addMakers() {
    // includes a few builtin atoms like True, False, None
    GrimVal.makerMap.set("Tag",  GrimTag.maker);

    // Var("x") always evaluates to itself, but could be used to bind a variable with some extra operator or function
    GrimVal.makerMap.set("Var", GrimVar.maker);
    // Sym("x") --> can only evaluate if bound lexically in code, otherwise it is an error / Build error (not just an Eval error)
    GrimVal.makerMap.set("Sym", GrimSym.maker);
    GrimVal.makerMap.set("Bool", GrimBool.maker);
    GrimVal.makerMap.set("Nat", GrimNat.maker);
    GrimVal.makerMap.set("Dec", GrimDec.maker);
    GrimVal.makerMap.set("Str", GrimStr.maker);
    GrimVal.makerMap.set("Some", GrimOpt.maker);
    GrimVal.makerMap.set("Error", GrimError.maker);

    // Collection types, from Immutable.js
    GrimVal.makerMap.set("List", GrimList.maker);
    GrimVal.makerMap.set("Tuple", GrimTuple.maker); // just another wrapper for list
    GrimVal.makerMap.set("Map", GrimMap.maker);
    GrimVal.makerMap.set("Set", GrimSet.maker);

    // Function application
    GrimVal.makerMap.set("App", GrimApp.maker);
    GrimVal.makerMap.set("@", GrimApp.maker);
    GrimVal.makerMap.set("Fun", GrimFun.maker);
    GrimVal.makerMap.set("Let", GrimLet.maker);


    
    // CanAst makers - register the same makers for type-safe CanAst processing
    GrimVal.canAstMakerMap.set("Str", GrimStr.canAstMaker);
    GrimVal.canAstMakerMap.set("Nat", GrimNat.canAstMaker);
    GrimVal.canAstMakerMap.set("Dec", GrimDec.canAstMaker);
    GrimVal.canAstMakerMap.set("Tag", GrimTag.canAstMaker);
    GrimVal.canAstMakerMap.set("Sym", GrimSym.canAstMaker);
    GrimVal.canAstMakerMap.set("Var", GrimVar.canAstMaker);
    GrimVal.canAstMakerMap.set("Bool", GrimBool.canAstMaker);
    GrimVal.canAstMakerMap.set("Some", GrimOpt.canAstMaker);
    GrimVal.canAstMakerMap.set("Error", GrimError.canAstMaker);
    
    // Collection types
    GrimVal.canAstMakerMap.set("List", GrimList.canAstMaker);
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
