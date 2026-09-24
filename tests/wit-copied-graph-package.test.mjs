/**
 * Prepared recursive WIT packages, source-free consumption and reproduction.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { compileCopiedWitGraphPackageModel, witGraphPackageReadme } from "../src/backends/wit/copied-graph-package.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { generateCopiedCGraphTypes } from "../src/backends/c/copied-graph-layout.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

test("recursive WIT package models expose stable public names without extra C targets", () => {
	const ir = nativeRecursiveReviewedIr(), before = structuredClone(ir), model = compileCopiedWitGraphPackageModel(ir);
	assert.deepEqual(ir, before);
	const repeated = compileCopiedWitGraphPackageModel(ir);
	for(const key of ["manifest", "hostHeader", "wit", "wat", "layout"])
		assert.deepEqual(repeated[key], model[key]);
	assert.equal(model.prefix, "recursive"); assert.equal(model.layoutSha256, model.manifest.graph.layoutSha256);
	assert.equal(compileNativeGraphProjection(ir, ["wit-wasi"]).layoutSha256, model.layoutSha256);
	for(const target of ["c", "cpp", "cargo", "pypi", "rubygems", "nuget", "maven", "php-native"])
		assert.equal(compileNativeGraphProjection(ir, [target, "wit-wasi"]).layoutSha256, model.layoutSha256);
	assert.equal(compileNativeGraphProjection(ir, ["cpan", "wit-wasi"], "LeanBridge::Recursive").layoutSha256, model.layoutSha256);
	for(const name of ["recursive_envelope_outcome_t", "recursive_units_argument0_t", "recursive_units_result_t"])
		assert.ok(model.hostHeader.includes(` ${name};`));
	assert.match(model.hostHeader, /recursive_units_result_t_clear/);
	assert.match(witGraphPackageReadme(model, "2.38"), /262,144 expanded node visits/);
	assert.match(witGraphPackageReadme(model, "2.38"), /not a standalone WASI command/);
	assert.throws(() => compileCopiedWitGraphPackageModel(ir, { name: "../../escape" }), /coordinate/);
	const collision = structuredClone(ir);
	collision.types.find(type => type.name === "EmptyRecord").name = "Envelope_outcome";
	assert.throws(() => compileCopiedWitGraphPackageModel(collision), /C name collision/);
});

test("recursive WIT public headers compile twice in C and C++ before building Lean", {
	skip: !["LEAN_BRIDGE_WIT_GRAPH_HEADER_TEST", "LEAN_BRIDGE_WIT_GRAPH_INSTALLED_TEST", "LEAN_BRIDGE_WIT_GRAPH_REPRO_TEST"].some(name => process.env[name] === "1")
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-graph-headers-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const ir = nativeRecursiveReviewedIr(), model = compileCopiedWitGraphPackageModel(ir), types = generateCopiedCGraphTypes(ir);
	const environment = nativeFixtureEnvironment(["wit-wasi"]);
	await saveLakeFile(root, "recursive-graph-types.h", types.header);
	await saveLakeFile(root, "recursive-graph.h", '#include "recursive-graph-types.h"\n');
	await saveLakeFile(root, "recursive_wasmtime.h", model.hostHeader);
	await saveLakeFile(root, "headers.cc", '#include "recursive_wasmtime.h"\n#include "recursive_wasmtime.h"\n');
	for(const [compiler, standard] of [["cc", "c11"], ["c++", "c++20"]])
		await runCopied(compiler, [`-std=${standard}`, "-x", compiler === "cc" ? "c" : "c++", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-I", join(environment.LEAN_BRIDGE_WASMTIME_C_API, "include"), "headers.cc"], root, environment);
	for(const name of ["wit-installed", "wit-library-lifetime", "wit-result-fault"])
	{
		await saveLakeFile(root, `${name}.c`, await readFile(`tests/fixtures/recursive-consumers/${name}.c`));
		await runCopied("cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-fsyntax-only", "-I", join(environment.LEAN_BRIDGE_WASMTIME_C_API, "include"), `${name}.c`], root, environment);
	}
});

test("ordinary and reviewed recursive WIT archives execute from a source-free installation", {
	skip: process.env.LEAN_BRIDGE_WIT_GRAPH_INSTALLED_TEST !== "1"
	, timeout: 1_200_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-graph-installed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkWitGraphPackages } = await import("./helpers/wit-graph-packages.mjs");
	const report = await checkWitGraphPackages(root, message => t.diagnostic(message));
	assert.deepEqual(report.observations.map(run => run.reviewed), [false, true]);
	await saveLakeFile("build/recursive", "wit-packages.json", canonicalJson(report));
});

test("independent recursive WIT builds reproduce the installed archives", {
	skip: process.env.LEAN_BRIDGE_WIT_GRAPH_REPRO_TEST !== "1", timeout: 1_200_000
}, async t => {
	const original = JSON.parse(await readFile("build/recursive/wit-packages.json", "utf8"));
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-graph-repro-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkWitGraphReproducibility } = await import("./helpers/wit-graph-packages.mjs");
	const report = await checkWitGraphReproducibility(root, original, message => t.diagnostic(message));
	await saveLakeFile("build/recursive", "wit-reproducibility.json", canonicalJson(report));
});
