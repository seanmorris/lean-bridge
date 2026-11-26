/** @file Use an installed synchronous IO package directly from strict TypeScript. */
import * as api from "@example/ledger-io";
import {exercise} from "./calls.mjs";

const common = exercise(api);
const total: number = api.read_total();
const result = api.choose(false, false, "returned");
const branch: string | number = "ok" in result ? result.ok : result.error;
if(branch !== 4000000000 || total !== 3) throw new Error("Wrong synchronous return");
const bytes = new Uint8Array([31]);
try
{
	api.nested(true, 2, 0n, "", bytes);
	throw new Error("Expected a declared failure");
}
catch(error)
{
	if(!(error instanceof api.EIO_RubyIO_nested)) throw error;
	const payload = error.payload;
	const leaf: string | bigint | Uint8Array = "ok" in payload ? payload.ok
		: "ok" in payload.error ? payload.error.ok : payload.error.error;
	if(!(leaf instanceof Uint8Array) || leaf === bytes || leaf[0] !== 31) throw new Error("Lost error payload", {cause: error});
}
if(import.meta.url === "typecheck-only:")
{
	// @ts-expect-error USize is a wasm32 number.
	api.add(2n);
	// @ts-expect-error Synchronous IO does not promise its answer.
	const pending: Promise<number> = api.add(1);
	void pending;
}
console.log(JSON.stringify({common, branch, after: api.add(1)}));
