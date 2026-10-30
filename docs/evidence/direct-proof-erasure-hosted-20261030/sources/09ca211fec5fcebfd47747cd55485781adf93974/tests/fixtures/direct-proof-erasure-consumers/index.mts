/**
 * Check direct proof erasure package declarations under strict TypeScript.
 *
 * @file
 */
import * as api from "direct-proof-erasure";

const unary: typeof api.keep = api.keep;
const arity: Parameters<typeof api.keep>["length"] = 1;
void arity;
const parameters: Parameters<typeof api.keep> = [42];
const result: number = unary(parameters[0]);

// @ts-expect-error Closed Lean proofs are reconstructed internally, not accepted from hosts.
api.keep(42, true);
// @ts-expect-error UInt32 is a number, never a proof-shaped object.
api.keep({ proof: true });

void result;
