/**
 * Keep the internal universal fixture independent of unrelated reviewed contracts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";

const fixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-canonical-fixture-plan-"));
	t.after(() => rm(root, { recursive: true }));
	for(const path of ["lean-toolchain", "package.json"
		, "poc/lean-link-spike/graph-lock.json"
		, "poc/lean-link-spike/bindings/alpha.binding-ir.json"
	]) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), await readFile(path));
	}
	await writeFile(join(root, "unrelated.binding-ir.json"), "not a selected contract");
	return root;
};

test("canonical fixture planning selects the graph-pinned Alpha contract before probing tools", async t => {
	const root = await fixture(t), calls = [], outputRoot = join(root, "result");
	await assert.rejects(buildCanonicalProject({
		projectRoot: root, engineRoot: root, outputRoot, environment: {}
		, runner: { capture: async request => {
			calls.push(request.command);
			throw Object.assign(new Error("Unavailable test tool"), { code: "ENOENT" });
		} }
	}), error => error.code === "build-tools-unavailable");
	assert.deepEqual(calls.sort(), ["docker", "nix"]);
	await assert.rejects(access(outputRoot), error => error.code === "ENOENT");
});

test("canonical fixture planning rejects drift and alternate contract paths before tools", async t => {
	const root = await fixture(t), outputRoot = join(root, "result");
	const path = join(root, "poc/lean-link-spike/graph-lock.json");
	const graph = JSON.parse(await readFile(path));
	const changes = [
		value => { value.libraries[0].bindingIr.sha256 = "0".repeat(64); }
		, value => { value.libraries[0].bindingIr.semanticSha256 = "0".repeat(64); }
		, value => { value.libraries[0].bindingIr.path = "../unrelated.binding-ir.json"; }
		, value => { value.libraries[0].id = "unrelated@0.0.0"; }
		, value => { value.libraries.push(structuredClone(value.libraries[0])); }
	];
	const runner = { capture: async () => assert.fail("Invalid fixture must not probe tools") };
	for(const change of changes)
	{
		const changed = structuredClone(graph);
		change(changed);
		await writeFile(path, JSON.stringify(changed));
		await assert.rejects(buildCanonicalProject({
			projectRoot: root, engineRoot: root, outputRoot, environment: {}, runner
		}), error => error.code === "universal-fixture-binding-ir-mismatch");
		await assert.rejects(access(outputRoot), error => error.code === "ENOENT");
	}
	await writeFile(path, JSON.stringify(graph));
	const binding = join(root, "poc/lean-link-spike/bindings/alpha.binding-ir.json");
	await writeFile(binding, (await readFile(binding, "utf8")) + "\n");
	await assert.rejects(buildCanonicalProject({
		projectRoot: root, engineRoot: root, outputRoot, environment: {}, runner
	}), error => error.code === "universal-fixture-binding-ir-mismatch");
});
