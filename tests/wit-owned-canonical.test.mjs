/**
 * Exercise nested canonical resource handles with an independent native host.
 * These are transport tests, not installed Lean or package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { ownedCanonicalCases, ownedCanonicalFixture } from "./helpers/wit-owned-canonical-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

const workspace = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-owned-canonical-"));
	t.after(() => rm(root, { recursive: true, force: true })); return root;
};
const compile = async (root, name, source) => {
	await saveLakeFile(root, `${name}.wat`, source);
	await runCopied("wasm-tools", ["parse", `${name}.wat`, "-o", `${name}.wasm`], root, process.env);
	await runCopied("wasm-tools", ["validate", `${name}.wasm`], root, process.env);
};

test("nested borrow and transfer fixtures compile and retain WIT ownership", async t => {
	const root = await workspace(t);
	for(const mode of ownedCanonicalCases) await t.test(mode, async () => {
		const source = ownedCanonicalFixture(mode);
		assert.equal(source, ownedCanonicalFixture(mode));
		await compile(root, mode, source);
		const decoded = JSON.parse((await runCopied("wasm-tools", ["component", "wit", `${mode}.wasm`, "--json"], root, process.env)).stdout);
		const handles = decoded.types.filter(type => type.kind.handle).map(type => type.kind.handle);
		assert.ok(handles.some(handle => handle.borrow !== undefined));
		assert.ok(handles.some(handle => handle.own !== undefined));
		for(const name of ["native", "api"])
		{
			const iface = decoded.interfaces.find(iface => iface.name === name); assert.ok(iface);
			assert.equal(Object.keys(iface.functions).join(","), "inspect");
			assert.equal(iface.functions.inspect.params.length, mode.startsWith("indirect-") || mode === "wide-variant" ? 17 : 1);
		}
	});
});

test("nested borrow cleanup preserves transferred inputs and original owners", {
	skip: process.env.LEAN_BRIDGE_WIT_OWNED_CANONICAL_TEST !== "1"
}, async t => {
	const root = await workspace(t), sdk = process.env.LEAN_BRIDGE_WASMTIME_C_API;
	assert.ok(sdk, "Set LEAN_BRIDGE_WASMTIME_C_API to the pinned component-enabled C API");
	const library = resolve(sdk, "lib"), executable = join(root, "probe");
	await runCopied("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
		, "-I", resolve(sdk, "include")
		, resolve("tests/fixtures/structured-types/wit-owned-borrow-probe.c")
		, "-L", library, "-lwasmtime", `-Wl,-rpath,${library}`, "-o", executable
	], root, process.env);
	for(const mode of ownedCanonicalCases) await t.test(mode, async () => {
		await compile(root, mode, ownedCanonicalFixture(mode));
		const result = await runCopied(executable, [`${mode}.wasm`, mode], root, process.env);
		const transfers = mode === "list-mixed" ? 512 : mode.endsWith("mixed") ? 1024 : 0;
		assert.equal(result.stdout.trim(), `${mode}: calls=1024 owned-result-drops=1024 transfers=${transfers} original-owner-live=true`);
		t.diagnostic(result.stdout.trim());
	});
	await t.test("missing cleanup reproduces the borrow-handle trap", async () => {
		const original = ownedCanonicalFixture("record");
		const drop = "\n      (call $drop10000 (local.get 0))";
		assert.equal(original.split(drop).length, 2);
		await compile(root, "missing-drop", original.replace(drop, ""));
		await assert.rejects(() => runCopied(executable, ["missing-drop.wasm", "record"], root, process.env)
			, /borrow handles still remain at the end of the call/u);
	});
});
