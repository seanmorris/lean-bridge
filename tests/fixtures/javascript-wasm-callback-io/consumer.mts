/** @file Enter a real trapping callback through the installed package's TypeScript signature. */
import {exercise} from "./calls.mjs";
import type * as Owned from "owned-aggregates";

declare const process: {argv: string[]};
const options = JSON.parse(process.argv[2]);
let entries = 0;
const invoke = (api: typeof Owned, callback: (value: bigint) => bigint): bigint =>
	api.viaNat(value => { entries++; return callback(value); }, 7n);
const common = await exercise(options, undefined, invoke);
if(entries !== 1) throw new Error("The typed callback did not execute exactly once");
const io = await import("@example/ledger-io");
let rejected = false;
try
{ io.add(1); }
catch(error)
{
	if(!(error instanceof Error) || !/retired|poisoned/iu.test(error.message)) throw error;
	rejected = true;
}
if(!rejected) throw new Error("The typed IO peer accepted a call after retirement");
if(import.meta.url === "typecheck-only:")
{
	const owned = await import("owned-aggregates");
	// @ts-expect-error A synchronous Nat callback cannot return a Promise.
	owned.viaNat(async value => value, 7n);
}
console.log(JSON.stringify({common, entries, rejected}));
