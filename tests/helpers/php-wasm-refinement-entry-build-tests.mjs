/**
 * Controls for the graph-capable PHP-Wasm compiler-input observer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { restoreSubtypeCEntries } from "./php-wasm-subtype-entry-c.mjs";
import { createPhpWasmRefinementEntryBuildObserver } from "./php-wasm-refinement-entry-build.mjs";

const selected = Object.freeze([
	Object.freeze({ symbol: "constructor", kind: "constructor", label: "Probe.constructor" })
	, Object.freeze({ symbol: "adapter", kind: "adapter", label: "Probe.adapter" })
	, Object.freeze({ symbol: "lg_call0", kind: "public", label: "Probe.call" })
]);

const run = async omit => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-entry-observer-"));
	const input = join(root, "input"), records = join(root, "records"), objects = join(root, "objects");
	await mkdir(input); await mkdir(records); await mkdir(objects);
	const first = `lean_object *constructor(lean_object *value) { return value; }\n${omit === "adapter" ? "" : "lean_object *adapter(lean_object *value) { return value; }\n"}`;
	const second = "static ZEND_FUNCTION(lg_call0) { RETURN_NULL(); }\n";
	await writeFile(join(input, "lean.c"), first); await writeFile(join(input, "zend.c"), second);
	const runner = { capture: async request => {
		if(request.args.includes("-c"))
		{
			const source = await readFile(request.args[request.args.indexOf("-c") + 1], "utf8");
			assert.match(source, /LB_SUBTYPE_ENTRY_V1/u);
			await writeFile(request.args[request.args.indexOf("-o") + 1], source);
		}
		return { stdout: "", stderr: "", code: 0 };
	} };
	const observer = createPhpWasmRefinementEntryBuildObserver({ recordRoot: records, runner });
	observer.select(selected);
	for(const name of ["lean", "zend"])
		await observer.capture({ command: "/tool/emcc"
			, args: ["-c", join(input, name + ".c"), "-o", join(objects, name + ".o")] });
	const link = observer.capture({ command: "/tool/emcc"
		, args: ["-sSIDE_MODULE=2", join(objects, "lean.o"), join(objects, "zend.o"), "-o", join(root, "probe.so")] });
	return { root, records, observer, link };
};

test("compiler-input observer closes every selected definition and restores originals", async t => {
	const value = await run(); t.after(() => rm(value.root, { recursive: true }));
	await value.link;
	const observation = value.observer.snapshot();
	assert.deepEqual(observation.definitionCounts, { constructor: 1, adapter: 1, lg_call0: 1 });
	assert.equal(observation.compiled.length, 2); assert.equal(observation.commands.length, 3);
	for(const item of observation.compiled)
	{
		const original = await readFile(join(value.records, "c-inputs", item.name), "utf8");
		const probe = await readFile(join(value.records, "c-probes", item.name), "utf8");
		assert.equal(restoreSubtypeCEntries(probe, item), original);
	}
});

test("compiler-input observer refuses a missing definition before linking", async t => {
	const value = await run("adapter"); t.after(() => rm(value.root, { recursive: true }));
	await assert.rejects(value.link, /adapter: exactly one marked definition required/u);
	assert.throws(() => value.observer.snapshot(), /completed/u);
	assert.equal(value.observer.transcript().linked, false);
});

test("compiler-input observer overlays and restores generated owned headers", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-entry-header-observer-"));
	t.after(() => rm(root, { recursive: true }));
	const input = join(root, "input"), include = join(input, "owned");
	const records = join(root, "records"), objects = join(root, "objects");
	await mkdir(include, { recursive: true }); await mkdir(records); await mkdir(objects);
	await writeFile(join(include, "owned-values-codec.h")
		, '#include "owned-leases.h"\nstatic inline int native_adapter(int x) { return x; }\n');
	await writeFile(join(include, "owned-leases.h")
		, "static inline int owner_move(int x) { return x; }\n");
	await writeFile(join(input, "zend.c")
		, '#include "owned-values-codec.h"\nstatic ZEND_FUNCTION(lg_call0) { RETURN_NULL(); }\n');
	const selection = [
		{ symbol: "native_adapter", kind: "adapter", label: "Probe.native" }
		, { symbol: "owner_move", kind: "adapter", label: "Probe.owner" }
		, { symbol: "lg_call0", kind: "public", label: "Probe.call" }
	];
	const runner = { capture: async request => {
		if(request.args.includes("-c"))
		{
			const probe = request.args[request.args.indexOf("-iquote") + 1];
			assert.match(await readFile(join(probe, "owned-values-codec.h"), "utf8")
				, /LB_SUBTYPE_ENTRY_V1 enter adapter Probe\.native/u);
			assert.match(await readFile(join(probe, "owned-leases.h"), "utf8")
				, /LB_SUBTYPE_ENTRY_V1 enter adapter Probe\.owner/u);
			await writeFile(request.args[request.args.indexOf("-o") + 1]
				, await readFile(request.args[request.args.indexOf("-c") + 1]));
		}
		return { stdout: "", stderr: "", code: 0 };
	} };
	const observer = createPhpWasmRefinementEntryBuildObserver({
		recordRoot: records, runner
		, headerInputs: ["owned-values-codec.h", "owned-leases.h"]
	});
	observer.select(selection);
	await observer.capture({
		command: "/tool/emcc"
		, args: [
			"-I", include, "-c", join(input, "zend.c"), "-o", join(objects, "zend.o")
		]
	});
	await observer.capture({
		command: "/tool/emcc"
		, args: [
			"-sSIDE_MODULE=2", join(objects, "zend.o"), "-o", join(root, "probe.so")
		]
	});
	const observation = observer.snapshot();
	assert.deepEqual(observation.definitionCounts, {
		native_adapter: 1, owner_move: 1, lg_call0: 1
	});
	assert.equal(observation.headers.length, 2);
	for(const item of observation.headers)
	{
		const original = await readFile(join(records, "header-inputs", item.path), "utf8");
		const probe = await readFile(join(records, "header-probes", item.path), "utf8");
		assert.equal(restoreSubtypeCEntries(probe, item), original);
	}
});
