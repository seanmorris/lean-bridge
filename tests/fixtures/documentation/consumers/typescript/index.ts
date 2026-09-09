/**
 * Call the installed Lean component with strict generated types.
 *
 * @file
 */
import { add, isEmpty } from "onboarding-small";

const sum: bigint = add(20n, 22n);
const empty: boolean = isEmpty("");
if(sum !== 42n || !empty) throw new Error("Unexpected Lean result");
console.log(JSON.stringify({ sum: sum.toString(), empty }));
