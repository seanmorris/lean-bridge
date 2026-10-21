import * as api from "dependentrecords";

const generated: api.Dependent = api.dependentResult(4n);
const bound: bigint = generated.bound;
const below: bigint = generated.below;
// @ts-expect-error The erased proof is not a host field.
const proof: boolean = generated.valid;
// @ts-expect-error Input-only APIs are absent from this package selection.
api.dependentTotal(generated);
void bound; void below; void proof;
