/** @file Compare release identities separately from the standalone installed-browser tests. */
import assert from "node:assert/strict";
import test from "node:test";
import {compareIncomingPackages} from "./helpers/npm-incoming-package.mjs";

test("incoming closure parity requires the same runtime, client programs and observations",()=>{
	const row=route=>{
		const reviewed=route==="reviewed";
		return {
			route
			, receiptSha256: (reviewed?"b":"a").repeat(64)
			, reviewedSourceSha256: reviewed?"c".repeat(64):null
			, archives: [
				{path: "lean-bridge-runtime-test.tgz",bytes: 8,sha256: "4".repeat(64)}
				, {path: "owned-aggregates-1.0.0.tgz",bytes: 12,sha256: (reviewed?"2":"1").repeat(64)}
			]
			, sourceHashes: {"typed.mts": "3".repeat(64)}
			, node: {after: 0}, typescript: {after: 0}, browser: {worker: {after: 0}}
		};
	};
	const ordinary=row("ordinary"),reviewed=row("reviewed");
	const pair=compareIncomingPackages(ordinary,reviewed);
	assert.deepEqual(pair.runtimeArchive,ordinary.archives[0]);assert.equal(pair.reviewedReceiptSha256,reviewed.receiptSha256);
	for(const mutate of [
		next=>{next.archives[0].sha256="0".repeat(64);}
		, next=>{next.archives[1]=ordinary.archives[1];}
		, next=>{next.reviewedSourceSha256=null;}
		, next=>{next.sourceHashes["typed.mts"]="9".repeat(64);}
		, next=>{next.browser.worker.after=1;}
	]) {
		const next=structuredClone(reviewed);mutate(next);assert.throws(()=>compareIncomingPackages(ordinary,next));
	}
});
