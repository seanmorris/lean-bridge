/**
 * Type-check the complete dependent checked-record package surface.
 *
 * @file
 */
import * as api from "dependentrecords";

const input: api.Dependent = { bound: 3n, below: 2n };
const total: bigint = api.dependentTotal(input);
const output: api.Dependent = api.dependentRoundtrip(input);
const generated: api.Dependent = api.dependentResult(4n);
// @ts-expect-error Erased proof fields never enter the host interface.
api.dependentTotal({ bound: 3n, below: 2n, valid: true });
// @ts-expect-error Nat and Fin payloads are represented exactly as bigint.
api.dependentTotal({ bound: 3, below: 2 });
void total; void output; void generated;
