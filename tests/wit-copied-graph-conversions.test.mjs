/**
 * Real Wasmtime allocation and sanitized graph conversions, without Lean calls.
 * This gate cannot establish compiled Lean or installed-package acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedWitGraphModel } from "../src/backends/wit/copied-graph-model.mjs";
import { renderWitGraphConversions } from "../src/backends/wit/copied-graph-conversions.mjs";
import { generateCopiedCGraphTypes } from "../src/backends/c/copied-graph-layout.mjs";
import { snapshotWasmtimeCapi } from "../src/build/native-wit-projection.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";
import { nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("WIT recursive converters preserve values and reject malformed arenas without leaks", { skip: process.env.LEAN_BRIDGE_WIT_GRAPH_TEST !== "1", timeout: 120_000 }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-graph-conversions-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const sdk = join(root, "wasmtime"), environment = nativeFixtureEnvironment(["wit-wasi"]);
	await snapshotWasmtimeCapi(environment.LEAN_BRIDGE_WASMTIME_C_API, sdk);
	const ir = nativeRecursiveReviewedIr(), model = compileCopiedWitGraphModel(ir);
	const conversions = renderWitGraphConversions(model), header = generateCopiedCGraphTypes(ir).header;
	const named = name => model.nodes.find(node => node.ref.id === `lean:Recursive.${name}`);
	const type = id => model.nodes.find(node => node.id === id);
	const copies = Object.fromEntries(["Spine", "Scalars", "Tree", "Envelope", "Marker", "EmptyRecord", "LeftTree", "RightTree", "Wide", "Never"].map(name => [name, named(name)]));
	copies.Forest = type(model.layout.aliases.find(alias => alias.id === "lean:Recursive.Forest").target);
	copies.Units = type(model.layout.roots.find(fn => fn.bindingId === "lean:Recursive.units").result);
	copies.Outcome = type(named("Envelope").fields.find(field => field.name === "outcome").type);
	const macros = Object.entries(copies).map(([name, node]) => `typedef ${node.name} native_${name};\n#define IN_${name} lb_graph_decode_${node.index}\n#define OUT_${name} lb_graph_encode_${node.index}\n#define TABLE_${name} ${model.tables.findIndex(item => item.id === node.id)}`).join("\n");
	const source = (await readFile("tests/fixtures/recursive-consumers/wit-conversions.c", "utf8")).replace("/* GENERATED_TYPES */", macros);
	await saveLakeFile(root, "graph.h", header);
	await saveLakeFile(root, "conversions.h", conversions);
	await saveLakeFile(root, "probe.c", source);
	const compilerOptions = ["-std=c11", "-g", "-O1", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-fsanitize=address,undefined", "-fno-omit-frame-pointer", "-fno-pie", "-no-pie"];
	await runCopied("cc", [...compilerOptions, "-I", join(sdk, "include"), "probe.c", "-L", join(sdk, "lib"), `-Wl,-rpath,${join(sdk, "lib")}`, "-lwasmtime", "-o", "probe"], root, environment);
	const result = await runCopied(join(root, "probe"), [], root, { PATH: "/unavailable", ASAN_OPTIONS: "detect_leaks=1:halt_on_error=1", UBSAN_OPTIONS: "halt_on_error=1" });
	assert.equal(result.stderr, "");
	const observation = JSON.parse(result.stdout);
	assert.equal(observation.liveAllocations, 0);
	assert.ok(observation.scratchFailures > 20);
	assert.ok(observation.inputBudgetFailures > 100);
	assert.ok(observation.outputBudgetFailures > 100);
	assert.equal(observation.scalarTypes, 19);
	assert.equal(observation.roundtrips, 14);
	assert.ok(observation.malformedInputs >= 10);
	assert.ok(observation.malformedOutputs >= 8);
	t.diagnostic(JSON.stringify(observation));
	await saveLakeFile(resolve("build/recursive-wit"), "conversions.json", canonicalJson({
		schemaVersion: 1, synthetic: true, installedAcceptance: false
		, compilerOptions, sanitizers: ["address", "undefined", "leak"]
		, bindingIrSha256: model.manifest.bindingIrSha256
		, sourceSha256: sha256(source), conversionsSha256: sha256(conversions)
		, headerSha256: sha256(header)
		, executableSha256: sha256(await readFile(join(root, "probe")))
		, observation
	}));
});
