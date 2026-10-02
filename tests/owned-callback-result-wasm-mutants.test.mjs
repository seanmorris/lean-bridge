/**
 * Broken callback owner implementations must fail their semantic assertions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { compileOwnedJavaScriptWasmFixture } from "./helpers/owned-javascript-wasm-native.mjs";
import { ownedCallbackResultConfiguration, ownedCallbackResultReviewedIr, ownedCallbackResultSource } from "./helpers/owned-callback-result-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const mutations = [
	["lost-anchor", "src/release/owned-wasm-borrow-registry.mjs"
		, "current = current.anchor", "current = null"
		, "callback-transitive-expiration"]
	, ["independent-native-result", "owned-values-codec.h"
		, "transaction->anchor\n    ? lb_owned_scope_commit_borrow(&transaction->scope, &owner->batch, transaction->anchor, transaction->anchor_generation)\n    : "
		, "", "callback-native-owner-expiration"]
	, ["unchecked-anchor-input", "owned-values-codec.h"
		, "transaction.anchor_input = 1;", "transaction.anchor_input = 0;"
		, "callback-native-anchor-membership"]
	, ["host-owner-unwrapping", "src/release/owned-wasm-callbacks.mjs"
		, 'if(callback.type.callable.result.ownership === "borrow")'
		, "if(false)", "callback-whole-owner-reply"]
	, ["early-host-view-expiration", "src/release/owned-wasm-callbacks.mjs"
		, "let result = Reflect.apply(callback.value, undefined, args);"
		, "let result = Reflect.apply(callback.value, undefined, args); state.borrow.rollback();"
		, "callback-host-handoff-before-expiration"]
	, ["unpublished-owner", "src/release/owned-wasm-calls.mjs"
		, "if(output) cleanup(output.rollback);"
		, "if(output) { if(!failed) cleanup(output.rollback); }"
		, "callback-unpublished-owner-cleanup"]
];

for(const mode of ["ordinary", "reviewed"]) test(`callback result Wasm semantic mutants (${mode})`, {
	skip: process.env.LEAN_BRIDGE_OWNED_CALLBACK_RESULT_TEST !== "1"
	, timeout: 900000
}, async t => {
	const fixture = await compileOwnedJavaScriptWasmFixture(t, "owned-aggregates", {
		hostCallbacks: true, callbackResultAnchors: true
		, fixtureOptions: { configuration: await ownedCallbackResultConfiguration()
			, sourceSuffix: ownedCallbackResultSource
			, evidenceName: `wasm-callback-result-mutants-${mode}-inputs.json` }
		, ...mode === "reviewed" ? { reviewedIr: ownedCallbackResultReviewedIr() } : {}
	});
	const { directory, controlSymbol, callbackKey, rebuild } = fixture.evidence, files = {};
	for(const name of ["calls", "bindings", "values", "scalars", "registry", "borrow-registry", "callbacks"])
	{
		const path = `src/release/owned-wasm-${name}.mjs`;
		files[path] = await readFile(path, "utf8"); await saveLakeFile(directory, path, files[path]);
	}
	for(const name of ["component-scalars", "owned-wasm-control"])
		await saveLakeFile(directory, `src/abi/${name}.mjs`, await readFile(`src/abi/${name}.mjs`));
	files["owned-values-codec.h"] = await readFile(join(directory, "owned-values-codec.h"), "utf8");
	const probe = await readFile("tests/fixtures/structured-types/owned-callback-result-wasm-semantic.mjs", "utf8");
	await saveLakeFile(directory, "semantic-checks.mjs", probe);
	await saveLakeFile(directory, "semantic.mjs", `import assert from "node:assert/strict";
import create from "./probe.mjs";
import {createOwnedWasmBindings} from "./src/release/owned-wasm-bindings.mjs";
import {createOwnedWasmCalls} from "./src/release/owned-wasm-calls.mjs";
import {checkCallbackResultSemantics} from "./semantic-checks.mjs";
const module = await create(), layout = ${canonicalJson(fixture.layout)};
let poisoned = false, lastOwner = 0, failure = null, forcedAnchor = null;
const binding = createOwnedWasmBindings(module, module[${JSON.stringify("_" + controlSymbol)}], {
  assertOpen: () => assert.equal(poisoned, false), poison: () => { poisoned = true; }
}, ${JSON.stringify(callbackKey)});
assert.equal(binding.initialize(), 0);
const runtime = createOwnedWasmCalls(module, layout, {...binding.bindings,
  openOwner: () => { lastOwner = binding.bindings.openOwner(); return lastOwner; },
  dispatch: (index, args, result, owner, transfers, anchor) => binding.bindings.dispatch(index, args, result, owner, transfers, forcedAnchor ?? anchor)
}, {afterProjection: () => { if(failure) throw failure; }});
const api = Object.fromEntries(layout.native.functions.map(fn => [fn.name, (...args) => runtime.call(fn.id, args)]));
api.counts = () => ({owners:binding.owners(),allocations:binding.allocations(),identities:module._owned_identities()});
api.lastOwner = () => lastOwner; api.alive = binding.bindings.aliveOwner;
api.failProjection = value => { failure = value; }; api.forceAnchor = value => { forcedAnchor = value; };
const observed = checkCallbackResultSemantics(api, process.argv[2]);
assert.equal(runtime.close(), true); console.log(JSON.stringify(observed));
`);
	const run = args => processBuildRunner.capture({ command: process.execPath, args, cwd: directory, timeoutMs: 60000 });
	const baseline = JSON.parse((await run(["semantic.mjs"])).stdout);
	assert.deepEqual(baseline, { checks: mutations.length });
	const observations = [];
	for(const [name, path, before, after, label] of mutations)
	{
		t.diagnostic(`${mode}: checking semantic mutant ${name}`);
		const original = files[path]; assert.ok(original.includes(before), name);
		if(name !== "unchecked-anchor-input") assert.equal(original.split(before).length, 2, name);
		const changed = original.replaceAll(before, after), native = !path.endsWith(".mjs");
		try
		{
			await saveLakeFile(directory, path, changed);
			if(native) await rebuild(); else await run(["--check", path]);
			await assert.rejects(run(["semantic.mjs", name]), error => {
				assert.equal(error.code, "build-command-failed");
				assert.match(error.details.stderr, new RegExp(label, "u"), name);
				assert.doesNotMatch(error.details.stderr, /SyntaxError|memory access out of bounds|unreachable|Segmentation fault/u);
				return true;
			}, name);
			observations.push({ name, path, sourceSha256: sha256(changed)
				, parsed: true, compiled: native, semanticRejection: true });
		}
		finally
		{ await saveLakeFile(directory, path, original); if(native) await rebuild(); }
	}
	const restored = JSON.parse((await run(["semantic.mjs"])).stdout);
	assert.deepEqual(restored, baseline);
	await saveLakeFile("build/owned-callback-results", `wasm-${mode}-mutants.json`, canonicalJson({
		mode, input: fixture.evidence.input, baseline, restored, observations
		, probeSha256: sha256(probe)
		, binarySha256: sha256(await readFile(join(directory, "probe.wasm")))
	}));
	t.diagnostic(`${mode}: ${observations.length} parsed/compiled semantic mutants rejected; restored implementation passes`);
});
