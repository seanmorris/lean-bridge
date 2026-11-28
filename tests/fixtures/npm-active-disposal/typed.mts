import {exercise} from "./calls.mjs";
import * as api from "@example/tariff-quotes";

const result=exercise(false);
const typedValue=api.visitApplicationQuote(n=>n+900,(q,n)=>{
    const original=api.passApplicationQuote(q);
    const sibling=original.retain();
    try { original.dispose(); return sibling(n); }
    finally { sibling.dispose(); original.dispose(); }
},4);
console.log(JSON.stringify({...result,typedValue}));
