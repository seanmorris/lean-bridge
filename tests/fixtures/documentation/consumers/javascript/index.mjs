/**
 * Call the installed Lean component from Node JavaScript.
 *
 * @file
 */
import { add, isEmpty } from "onboarding-small";

const result = { sum: String(add(100n, 23n)), empty: isEmpty(""), nonempty: isEmpty("Lean") };
if(result.sum !== "123" || !result.empty || result.nonempty)
{
	throw new Error("Unexpected Lean result");
}
console.log(JSON.stringify(result));
