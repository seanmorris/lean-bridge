import {exercise} from "./calls.mjs";
import type * as Owned from "owned-aggregates";
const api=await import("owned-aggregates");
let typedEntries=0;
const invoke: typeof Owned.withFunction=(input,visit)=>api.withFunction(input,(fn,row)=>{
  typedEntries++;
  const retained=fn.retain();
  const output=retained(row);
  if(api.serial(output.primary)!==42n) throw new Error("wrong type or value");
  if(output.primary!==input.primary && output.primary!==row.primary) output.primary.dispose();
  retained.dispose();
  return visit(fn,row);
});
const result=exercise(false,invoke);
if(typedEntries!==2) throw new Error("typed callback was not invoked twice");
console.log(JSON.stringify({...result,typedEntries}));
