/** @file Check once-only callback cancellation and registration reuse across installed npm clients. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {join, resolve} from "node:path";
import {testThreadedNpmClients} from "./threaded-npm-consumer-matrix.mjs";

const fixture = resolve("tests/fixtures/javascript-once-callback");
const scheduler = resolve("tests/fixtures/javascript-parked-reader");
const race = resolve("tests/fixtures/javascript-callback-cancellation");
const cfg = JSON.parse(await readFile(join(fixture, "lean-bridge.exports.json")));
testThreadedNpmClients({
	title: "a cancelled installed callback cannot answer a newer registration of the same function"
	, fixture, cfg, summary: "The callback budget belongs to each task parameter registration."
	, envPrefix: "LEAN_BRIDGE_NPM_CALLBACK_CANCEL", defaultOutput: "build/npm-callback-cancellation"
	, clientFiles: {"node.mjs": join(scheduler, "node.mjs"), "worker.mjs": join(scheduler, "worker.mjs"),
		"calls.mjs": join(race, "calls.mjs"), "calls.d.mts": join(race, "calls.d.mts"), "typed.mts": join(race, "typed.mts")}
	, checkIr(ir)
	{
		const single = ir.declarations.find(d => d.source.declaration === "Budget.single");
		assert.equal(ir.types.find(t => t.id === single.parameters[1].type.id).callable.invocation, "once");
	}
	, check(row)
	{
		const empty = [0,0,0,0,0];
		const observed = {beforeReply: empty, successes: 0, failures: 1, freshSettlements: 1, calls: [1,2]};
		assert.deepEqual(row, {earlyEntries: 0, lateValue: observed, lateError: observed, recovered: 42, live: empty});
	}
});
