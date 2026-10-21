/**
 * Strict public types for a result-only zero-payload package.
 *
 * @file
 */
import * as api from "zeropayloadcheckedrecords";
const witness: api.Witness = api.produceWitness();
const token: api.Token = api.produceToken();
const marker: api.Marker = api.produceMarker();
const values: ReadonlyArray<api.Witness> = api.witnesses(3n);
const blank: api.Mark = api.produceMark(false);
const marked: api.Mark = api.produceMark(true);
// @ts-expect-error Result-only packages expose no checked input constructor.
api.witnessCount(witness);
// @ts-expect-error Empty carriers reject invented fields.
const forged: api.Witness = { positive: true };
// @ts-expect-error Result-only packages expose no checked variant input.
api.markCount(marked);
void token; void marker; void values; void blank; void forged;
