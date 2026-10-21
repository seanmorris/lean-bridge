/**
 * Strict public types for zero-payload checked records.
 *
 * @file
 */
import * as api from "zeropayloadcheckedrecords";
const witness: api.Witness = {};
const marker: api.Marker = {};
const token: api.Token = { tag: undefined };
const count: bigint = api.witnessCount(witness) + api.markerCount(marker);
const unit: void = api.tokenTag(token);
const produced: api.Witness = api.produceWitness();
const values: ReadonlyArray<api.Witness> = api.witnesses(3n);
const maybe = api.maybeWitness(true);
const blank: api.Mark = api.produceMark(false);
const marked: api.Mark = { kind: "marked", witness };
const branchCount: bigint = api.markCount(blank) + api.markCount(marked);
// @ts-expect-error Empty carriers reject invented fields.
api.witnessCount({ positive: true });
// @ts-expect-error Unit is a retained field, not an omitted field.
api.tokenTag({});
// @ts-expect-error Option remains distinct from its contained empty carrier.
const absent: api.Witness = { tag: "none" };
// @ts-expect-error The nested erased proof is not a public field.
api.markCount({ kind: "marked", witness: { positive: true } });
void count; void unit; void produced; void values; void maybe; void branchCount; void absent;
