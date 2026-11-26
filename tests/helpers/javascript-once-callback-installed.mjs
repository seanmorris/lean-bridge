/** @file Verify an author-selected once policy from installed, compiled Lean task calls. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {resolve,join} from "node:path";
import {testThreadedNpmClients} from "./threaded-npm-consumer-matrix.mjs";

const fixture=resolve("tests/fixtures/javascript-once-callback"), drivers=resolve("tests/fixtures/javascript-parked-reader");
const cfg=JSON.parse(await readFile(join(fixture,"lean-bridge.exports.json")));
testThreadedNpmClients({title:"installed task registrations enforce once before entering the host",fixture,cfg,
	summary:"The callback budget belongs to each task parameter registration.",
	envPrefix:"LEAN_BRIDGE_NPM_ONCE_CALLBACK",defaultOutput:"build/npm-once-callback",
	clientFiles:{"node.mjs":join(drivers,"node.mjs"),"worker.mjs":join(drivers,"worker.mjs")},
	checkIr(ir) {
		const method=ir.declarations.find(d=>d.source.declaration==="Budget.probe");
		assert.deepEqual(method.parameters.slice(1).map(p=>ir.types.find(t=>t.id===p.type.id).callable.invocation),["once","many"]);
	},
	check(row) { assert.deepEqual(row,{first:1,many:2,nested:1,attempted:1,sameFunction:3,recovered:42,live:[0,0,0,0,0]}); }
});
