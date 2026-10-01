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

export const ownedJavaScriptBorrowMutations = [
	["share-is-independent", "src/release/owned-wasm-borrow-registry.mjs"
		, "return wrapRoot(group, type, payload);"
		, "return use(state, scope => native.copy(type, payload, scope));"
		, "shared-root-lifetime"]
	, ["retain-is-shared", "src/release/owned-wasm-borrow-registry.mjs"
		, "retain: { value: () => use(state, scope => native.copy(type, payload, scope)) }"
		, "retain: { value: () => wrapRoot(group, type, payload) }"
		, "independent-retained-lifetime"]
	, ["wrapper-identity", "src/release/owned-wasm-borrow-registry.mjs"
		, "return candidate.token === token;", "return other === value;"
		, "canonical-resource-identity"]
	, ["lost-anchor", "src/release/owned-wasm-borrow-registry.mjs"
		, "current = current.anchor", "current = null", "transitive-root-expiration"]
	, ["empty-root", "src/release/owned-wasm-borrow-registry.mjs"
		, 'result.representation === "copied" ? payload : wrapRoot(group, result, payload)'
		, '(result.representation === "copied" || (Array.isArray(payload) && !payload.length)) ? payload : wrapRoot(group, result, payload)'
		, "empty-value-keeps-root"]
	, ["unpublished-owner", "src/release/owned-wasm-calls.mjs"
		, "if(output) cleanup(output.rollback);"
		, "if(output) { if(!failed) cleanup(output.rollback); }"
		, "unpublished-owner-cleanup"]
	, ["native-revocation", "probe.c"
		, "slot->closed = 1;\n  if (slot->value.batch.context) slot->value.batch.expired = 1;"
		, "/* Broken: pinned storage incorrectly keeps a closed public owner alive. */"
		, "native-revocation-before-unpin"]
	, ["native-ancestor-revocation", "owned-leases.h"
		, "if (!registered || registered->expired) return NULL;"
		, "if (!registered) return NULL;", "native-ancestor-revocation-before-unpin"]
];

/**
 * Reuse compiled Lean objects and rebuild only the changed native adapter.
 * Each process loads a fresh Wasm heap; the test never mutates the repository.
 *
 * @param fixture - Fresh ordinary/reviewed wasm32 component and rebuild hook.
 */
export const rejectOwnedJavaScriptBorrowMutants = async fixture => {
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
	const probe = await readFile("tests/fixtures/structured-types/owned-javascript-borrow-semantic.mjs", "utf8");
	await saveLakeFile(directory, "semantic-checks.mjs", probe);
	await saveLakeFile(directory, "semantic.mjs", `import assert from "node:assert/strict";
import create from "./probe.mjs";
import { createOwnedWasmBindings } from "./src/release/owned-wasm-bindings.mjs";
import { createOwnedWasmCalls } from "./src/release/owned-wasm-calls.mjs";
import { checkBorrowSemantics } from "./semantic-checks.mjs";
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
const observed = checkBorrowSemantics(api, process.argv[2]);
assert.equal(runtime.close(), true); console.log(JSON.stringify(observed));
`);
	const run = args => processBuildRunner.capture({ command: process.execPath, args, cwd: directory, timeoutMs: 60000 });
	assert.deepEqual(JSON.parse((await run(["semantic.mjs"])).stdout), { checks: ownedJavaScriptBorrowMutations.length });
	const observations = [];
	for(const [name, path, before, after, label] of ownedJavaScriptBorrowMutations)
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
	assert.deepEqual(JSON.parse((await run(["semantic.mjs"])).stdout), { checks: ownedJavaScriptBorrowMutations.length });
	return { baselineChecks: ownedJavaScriptBorrowMutations.length, probeSha256: sha256(probe), observations };
};
