/**
 * Prepared WIT dependency identities and private file-hash regression checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { guardWitHostSource, witHostDependencies } from "../src/backends/wit/host-evidence.mjs";
import { witHostLibraryHash } from "../src/backends/wit/host-library-hash.mjs";
import { compileCopiedWitGraphPackageModel } from "../src/backends/wit/copied-graph-package.mjs";
import { renderWitGraphHostSource } from "../src/backends/wit/copied-graph-host.mjs";
import { compileCopiedWitModel } from "../src/backends/wit/copied-model.mjs";
import { renderWitHostSource } from "../src/backends/wit/copied-host.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { witCallableSignatures } from "./helpers/wit-callable-fixture.mjs";
import { witCollectionFaultIr } from "./helpers/wit-collection-faults.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const identity = { bytes: 10, sha256: "a".repeat(64) };
const evidence = () => ({
	receipt: { library: "libcomponent_123.so", nativeLibrary: identity }
	, adapter: { library: "libprobe.so", files: { "lib/libprobe.so": identity } }
	, runtime: { files: { "lib/libleanshared.so": identity, "lib/liblean_bridge_native.so": identity, "include/runtime.h": identity } }
});
const wasmtimeFiles = { "lib/libwasmtime.so": identity };

test("prepared WIT hosts embed all five authenticated dependencies without producer paths", () => {
	const dependencies = witHostDependencies(evidence(), wasmtimeFiles);
	assert.equal(dependencies.length, 5);
	assert.ok(dependencies.every(item => !item.name.includes("/")));
	for(const mutate of [
		value => { value.receipt.nativeLibrary = {}; }
		, value => { value.receipt.library = "../libother.so"; }
		, value => { value.receipt.library = "libwasmtime.so"; }
		, value => { value.adapter.files["lib/libprobe.so"] = { ...identity, bytes: -1 }; }
		, value => { value.runtime.files["lib/libextra.so"] = identity; }
	]) {
		const broken = evidence(); mutate(broken);
		assert.throws(() => witHostDependencies(broken, wasmtimeFiles), /exact identities/);
	}
	assert.throws(() => witHostDependencies(evidence(), {}), /exact identities/);
});

test("copied, callable and graph hosts guard public calls and custom-linker imports", () => {
	const graph = compileCopiedWitGraphPackageModel(nativeRecursiveReviewedIr());
	const callables = compileCopiedWitModel(callableReviewedIr(witCallableSignatures), {}, { callables: true });
	const copies = compileCopiedWitModel(witCollectionFaultIr());
	for(const [model, render, prefix] of [[graph, renderWitGraphHostSource, graph.prefix], [callables, renderWitHostSource, callables.surface.prefix], [copies, renderWitHostSource, copies.surface.prefix]])
	{
		const source = render(model, new Uint8Array()), dependencies = witHostDependencies(evidence(), wasmtimeFiles);
		const guarded = guardWitHostSource(source, prefix, dependencies);
		const entries = [...guarded.matchAll(new RegExp(`wasmtime_error_t \\*(?:${prefix}_wasmtime_[a-z0-9_]+|lb_call_[0-9]+)\\([^;{}]*\\) \\{`, "g"))];
		assert.ok(entries.length > 3);
		for(const entry of entries) assert.ok(guarded.slice(entry.index + entry[0].length).startsWith("\n  const char *package_failure = lb_package_failure();\n  if (package_failure) return wasmtime_error_new(package_failure);"));
		assert.match(guarded, /if \(getpid\(\) != lb_package_pid\) return;/);
		for(const { name, bytes, sha256: digest } of dependencies)
			assert.ok(guarded.includes(`{"${name}", UINT64_C(${bytes}), "${digest}"}`));
		assert.throws(() => guardWitHostSource(source.replace(`${prefix}_wasmtime_open(`, `${prefix}_not_open(`), prefix, dependencies), /Missing guarded/);
		assert.throws(() => guardWitHostSource(source.replace(`void ${prefix}_wasmtime_close(`, `void ${prefix}_not_close(`), prefix, dependencies), /Missing unique/);
		assert.throws(() => guardWitHostSource(source, "../bad", dependencies), /Invalid WIT/);
	}
});

test("native WIT receipt hashing matches Node at padding and I/O boundaries under sanitizers", {
	skip: process.env.LEAN_BRIDGE_WIT_HOST_TEST !== "1", timeout: 120_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-host-hash-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await saveLakeFile(root, "probe.c", `#define _GNU_SOURCE\n${witHostLibraryHash}
#include <stdlib.h>
#include <stdio.h>
int main(int argc, char **argv) {
  if (argc != 4) return 2;
  printf("%d\\n", lb_receipt_file_matches(argv[1], strtoull(argv[2], NULL, 10), argv[3]));
  return 0;
}\n`);
	const compilerOptions = ["-std=c11", "-O1", "-g", "-Wall", "-Wextra", "-Werror", "-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-fno-pie", "-no-pie"];
	await runCopied("cc", [...compilerOptions, "probe.c", "-o", "probe"], root, process.env);
	let checks = 0;
	const matches = async (path, bytes, digest) => {
		const result = await runCopied(join(root, "probe"), [path, String(bytes), digest], root, { PATH: "/unavailable", ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1" });
		assert.equal(result.stderr, ""); checks++; return result.stdout.trim() === "1";
	};
	for(const size of [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 16383, 16384, 16385, 1_000_000])
	{
		const value = Buffer.from(Uint8Array.from({ length: size }, (_, i) => (i * 131 + 17) % 256)), digest = sha256(value);
		await saveLakeFile(root, "value", value);
		assert.equal(await matches("value", size, digest), true, `length ${size}`);
		assert.equal(await matches("value", size + 1, digest), false);
		assert.equal(await matches("value", size, "0".repeat(64)), false);
		if(size) assert.equal(await matches("value", size - 1, digest), false);
	}
	await saveLakeFile(root, "empty", "");
	await symlink(join(root, "empty"), join(root, "link"));
	await runCopied("mkfifo", ["fifo"], root, process.env);
	for(const path of ["missing", ".", "link", "fifo"])
		assert.equal(await matches(path, 0, sha256("")), false, path);
	assert.equal(checks, 71);
	await saveLakeFile("build/recursive-wit", "host-hash.json", canonicalJson({ schemaVersion: 1
		, synthetic: true, checks, compilerOptions
		, sanitizers: ["address", "undefined", "leak"]
		, hashSourceSha256: sha256(witHostLibraryHash)
		, sourceSha256: sha256(await readFile(join(root, "probe.c")))
		, executableSha256: sha256(await readFile(join(root, "probe"))) }));
});
