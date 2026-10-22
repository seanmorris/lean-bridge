/**
 * TypeScript-only callback checked-record consumer contract.
 *
 * @file
 */
import * as api from "callbackcheckedrecords";

const widen = api.withRecovery((value: api.Interval): api.Interval => ({ lo: value.lo, hi: value.hi + 1n }), { lo: 0n, hi: 0n });
const result: bigint = api.callHost(widen);
const mixedResult: bigint = api.callHostMixed(api.withRecovery(
	(marker: bigint, value: api.Interval): api.Interval => marker > 0n ? value : { lo: 0n, hi: 0n }
	, { lo: 0n, hi: 0n }
));
const closure = api.makeMixedClosure(0n);
const closureResult: api.Interval = closure(7n, { lo: 2n, hi: 5n });
closure[Symbol.dispose]();
const weighted: bigint = api.callHostNested(api.withRecovery(
	(value: api.Weighted): api.Weighted => ({ weight: value.weight, limit: value.limit + 1n })
	, { weight: 1n, limit: 1n }
));

void [result, mixedResult, closureResult, weighted];
