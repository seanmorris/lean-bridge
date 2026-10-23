/**
 * TypeScript-only callback Subtype consumer contract.
 *
 * @file
 */
import * as api from "callbacksubtypes";

const positive = api.withRecovery((value: bigint): bigint => value + 1n, 1n);
const result: bigint = api.callHost(positive);
const mixedResult: bigint = api.callHostMixed(api.withRecovery(
	(marker: bigint, value: bigint): bigint => marker > 0n ? value : 1n
	, 1n
));
const closure = api.makeMixedClosure(0n);
const closureResult: bigint = closure(7n, 2n);
closure[Symbol.dispose]();

void [result, mixedResult, closureResult];
