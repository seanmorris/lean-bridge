/**
 * Parse or compile every mutant, then demand the original semantic assertion fail.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { processBuildRunner } from "../../src/build/process-runner.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

import { ownedJavaScriptBorrowMutations } from "./owned-javascript-borrow-mutants.mjs";

export const ownedJavaScriptReceiverMutations = [...ownedJavaScriptBorrowMutations
	, ["receiver-snapshot", "src/release/owned-wasm-borrow-registry.mjs"
		, "return native.member(fn.id, [value, ...args]);"
		, "return native.member(fn.id, [native.copy(type, value.get()), ...args]);"
		, "original-receiver-expiration"]
	, ["wrong-parameter-owner", "src/release/owned-wasm-calls.mjs"
		, "anchor = scope.whole(id, input); input = anchor.payload;"
		, "anchor = scope.whole(id, signature.receiver === 0 && i === 1 ? args[0] : input); input = args[i].get();"
		, "remaining-parameter-owner"]
	, ["shared-members", "src/release/owned-wasm-borrow-registry.mjs"
		, "...memberDescriptors(type, value, state)"
		, "...(group.roots.size === 1 ? memberDescriptors(type, value, state) : {})"
		, "shared-nominal-members"]
	, ["writable-property", "src/release/owned-wasm-borrow-registry.mjs"
		, '? { get: invoke } : { value: invoke }'
		, '? { get: invoke, set: () => {} } : { value: invoke }'
		, "read-only-receiver-property"]
];

/**
 * Reuse compiled Lean objects and rebuild only the changed native adapter.
 * Each process loads a fresh Wasm heap; the test never mutates the repository.
 *
 * @param fixture - Fresh ordinary/reviewed wasm32 component and rebuild hook.
 */
export const rejectOwnedJavaScriptReceiverMutants = async fixture => {
	const { directory, controlSymbol, callbackKey, rebuild } = fixture.evidence;
	const files = {};
	for(const name of ["calls", "bindings", "values", "scalars", "registry", "borrow-registry", "callbacks"])
	{
		const path = `src/release/owned-wasm-${name}.mjs`;
		files[path] = await readFile(path, "utf8"); await saveLakeFile(directory, path, files[path]);
	}
	for(const name of ["component-scalars", "owned-wasm-control"])
		await saveLakeFile(directory, `src/abi/${name}.mjs`, await readFile(`src/abi/${name}.mjs`));
	for(const path of ["probe.c", "owned-leases.h"]) files[path] = await readFile(join(directory, path), "utf8");
	const probe = await readFile("tests/fixtures/structured-types/owned-javascript-receiver-semantic.mjs", "utf8");
	await saveLakeFile(directory, "semantic-checks.mjs", probe);
	await saveLakeFile(directory, "owned-javascript-borrow-semantic.mjs", await readFile("tests/fixtures/structured-types/owned-javascript-borrow-semantic.mjs", "utf8"));
	await saveLakeFile(directory, "semantic.mjs", `import assert from "node:assert/strict";
import create from "./probe.mjs";
import { createOwnedWasmBindings } from "./src/release/owned-wasm-bindings.mjs";
import { createOwnedWasmCalls } from "./src/release/owned-wasm-calls.mjs";
import { checkReceiverSemantics } from "./semantic-checks.mjs";
const module = await create(), layout = ${canonicalJson(fixture.layout)};
let poisoned = false, lastOwner = 0, failure = null;
const binding = createOwnedWasmBindings(module, module[${JSON.stringify("_" + controlSymbol)}], {
  assertOpen: () => assert.equal(poisoned, false), poison: () => { poisoned = true; }
}, ${JSON.stringify(callbackKey)});
assert.equal(binding.initialize(), 0);
const runtime = createOwnedWasmCalls(module, layout, { ...binding.bindings,
  openOwner: () => { lastOwner = binding.bindings.openOwner(); return lastOwner; }
}, { afterProjection: () => { if(failure) throw failure; } });
const api = Object.fromEntries(layout.native.functions.map(fn => [fn.name, (...args) => runtime.call(fn.id, args)]));
api.copyValue = (name, value) => runtime.copyValue(layout.native.functions.find(fn => fn.name === name).result, value);
api.counts = () => ({owners:binding.owners(),allocations:binding.allocations(),identities:module._owned_identities()});
api.lastOwner = () => lastOwner; api.alive = binding.bindings.aliveOwner;
api.failProjection = value => { failure = value; };
const observed = checkReceiverSemantics(api, process.argv[2]);
assert.equal(runtime.close(), true); console.log(JSON.stringify(observed));
`);
	const run = args => processBuildRunner.capture({ command: process.execPath, args, cwd: directory, timeoutMs: 60000 });
	assert.deepEqual(JSON.parse((await run(["semantic.mjs"])).stdout), { checks: ownedJavaScriptReceiverMutations.length });
	const observations = [];
	for(const [name, path, before, after, label] of ownedJavaScriptReceiverMutations)
	{
		const original = files[path]; assert.equal(original.split(before).length, 2, name);
		const changed = original.replace(before, after), native = !path.endsWith(".mjs");
		try
		{
			await saveLakeFile(directory, path, changed);
			if(native) await rebuild(); else await run(["--check", path]);
			await assert.rejects(run(["semantic.mjs", name]), error => {
				assert.equal(error.code, "build-command-failed");
				assert.match(error.details.stderr, new RegExp(label, "u"), name);
				assert.doesNotMatch(error.details.stderr, /SyntaxError|memory access out of bounds|unreachable|Segmentation fault/u);
				return true;
			});
			observations.push({ name, path, sourceSha256: sha256(changed), parsed: true, semanticRejection: true });
		}
		finally
		{ await saveLakeFile(directory, path, original); if(native) await rebuild(); }
	}
	assert.deepEqual(JSON.parse((await run(["semantic.mjs"])).stdout), { checks: ownedJavaScriptReceiverMutations.length });
	return { baselineChecks: ownedJavaScriptReceiverMutations.length, probeSha256: sha256(probe), observations };
};
