/**
 * Source-only checks of the recursive checked-record WIT package contract: the real graph projection,
 * host renderer and dependency guard with stand-in native adapter sources. No package is built.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { recursiveCheckedRecordWitReview } from "./recursive-checked-record-wit-fixture.mjs";
import { recursiveCheckedRecordWitGenerator } from "./recursive-checked-record-wit-generators.mjs";
import { recursiveCheckedRecordWitCompileArgs } from "./recursive-checked-record-wit-install.mjs";
import { recursiveCheckedRecordWitModelMutations } from "./recursive-checked-record-wit-model-records.mjs";
import {
	recursiveCheckedRecordWitCurrentGenerator, recursiveCheckedRecordWitLayout, recursiveCheckedRecordWitMembers
} from "./recursive-checked-record-wit-package.mjs";

const dependencies = [{ name: "libstandin.so", bytes: 1, sha256: "0".repeat(64) }];
// Stand-in native sources: only the public graph header's diagnostic declaration is inspected.
const standIn = ({ declared = true, diagnostics = true } = {}) => ({ ...recursiveCheckedRecordWitCurrentGenerator
	, nativeGraphRefinementDiagnostics: () => diagnostics
	, nativeGraphProjectionSources: (model, component) => {
		assert.deepEqual(component, { initializer: "stand-in" });
		const p = model.bindingIr.component.name.replaceAll("-", "");
		const declaration = declared ? `const char *${p}_graph_error(void);\n` : "";
		return { [`include/detail/${p}-graph-types.h`]: "/* types */\n"
			, [`include/detail/${p}-graph.h`]: `/* graph */\n${declaration}` };
	}
});

test("recursive checked-record WIT members require the exact diagnostic host and differ from the feature-off host", () => {
	for(const fixture of ["recursive", "mutual"])
	{
		const layout = recursiveCheckedRecordWitLayout(fixture), model = { bindingIr: recursiveCheckedRecordWitReview(fixture) };
		assert.equal(model.bindingIr.component.name.replaceAll("-", ""), layout.prefix);
		const options = { model, component: { initializer: "stand-in" }, componentBytes: Buffer.from("stand-in component"), dependencies, fixture };
		const { projection, members, featureOffSha256 } = recursiveCheckedRecordWitMembers({ ...options, generator: standIn() });
		assert.deepEqual(Object.keys(members), [...layout.sources]);
		assert.equal(projection.refinementDiagnostics, true);
		assert.equal(JSON.parse(members["binding-manifest.json"]).graph.refinementDiagnostics, true);
		const host = members[`src/${layout.prefix}_wasmtime.c`];
		assert.equal(host.split(`${layout.prefix}_graph_error()`).length - 1, projection.layout.roots.length);
		assert.equal(projection.layout.roots.length, recursiveCheckedRecordWitReview(fixture).declarations.length);
		assert.notEqual(sha256(host), featureOffSha256);
		assert.throws(() => recursiveCheckedRecordWitMembers({ ...options, generator: standIn({ diagnostics: false }) }), /exact diagnostics/u);
		assert.throws(() => recursiveCheckedRecordWitMembers({ ...options, generator: standIn({ declared: false }) }));
		assert.throws(() => recursiveCheckedRecordWitMembers({ ...options, fixture: fixture === "mutual" ? "recursive" : "mutual", generator: standIn() }));
	}
});

test("recursive checked-record WIT reconstructs its generator from the committed closure", async () => {
	const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	const generator = await recursiveCheckedRecordWitGenerator(head);
	const required = ["src/backends/wit/copied-graph-package.mjs"
		, "src/backends/wit/copied-graph-host.mjs"
		, "src/backends/wit/host-evidence.mjs"
		, "src/build/native-graph-sources.mjs"
		, "src/backends/c/native-graph-adapters.mjs"];
	for(const path of required) assert.ok(generator.paths.includes(path), path);
	assert.deepEqual(Object.keys(generator).sort(), [...Object.keys(recursiveCheckedRecordWitCurrentGenerator), "paths"].sort());
	assert.throws(() => recursiveCheckedRecordWitGenerator("HEAD"));
});

test("recursive checked-record WIT compiles one unchanged caller with only the module define", () => {
	const flags = ["-I/i", "-L/l", "-Wl,-rpath,$ORIGIN/x/lib", "-lx_wasmtime", "-lwasmtime"];
	assert.deepEqual(recursiveCheckedRecordWitCompileArgs("recursive", flags, "/root/consumer")
		, ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "consumer.c", ...flags, "-o", "/root/consumer"]);
	assert.deepEqual(recursiveCheckedRecordWitCompileArgs("mutual", flags, "/root/consumer")
		, ["-std=c11", "-Wall", "-Wextra", "-Werror", "-UNDEBUG", "-DRECURSIVE_CHECKED_RECORD_MUTUAL", "consumer.c", ...flags, "-o", "/root/consumer"]);
	assert.throws(() => recursiveCheckedRecordWitCompileArgs("nested", flags, "/root/consumer"));
	for(const fixture of ["recursive", "mutual"])
	{
		const layout = recursiveCheckedRecordWitLayout(fixture);
		assert.equal(layout.directory, `${fixture}checkedrecords-1.0.0-wit-wasi`);
		assert.equal(layout.library, `lib${fixture}checkedrecords_wasmtime.so`);
		assert.equal(layout.component, `component/${fixture}checkedrecords.wasm`);
	}
});

const subtype = constructor => ({ kind: "subtype", constructor });
const fin = { kind: "fin", bound: "3" };
const record = (prefix, constructor) => ({
	kind: "checked-record", definition: `${prefix}.Packet`, constructor
	, fields: ["value", "digit"], arguments: [subtype(null), structuredClone(fin)]
});
const syntheticModel = prefix => ({
	pointerBits: 64, copiedGraph: { schemaVersion: 1 }
	, sourceIdentity: { extractorSha256: "a".repeat(64) }
	, exports: [{ name: "produce", refinements: { parameters: [null], result: { kind: "option", arguments: [record(prefix, null)] } } }
		, { name: "first", refinements: { parameters: [record(prefix, `${prefix}.mkPacket`)], result: null } }
		, { name: "second", refinements: { parameters: [{ ...record(prefix, `${prefix}.normalizePacket`), arguments: [subtype(`${prefix}.mkValue`), structuredClone(fin)] }], result: null } }] });

test("recursive checked-record WIT model mutations change refined exports and never pass vacuously", () => {
	for(const [fixture, prefix] of [["recursive", "RecursiveCheckedRecords"], ["mutual", "MutualCheckedRecords"]])
	{
		const mutations = recursiveCheckedRecordWitModelMutations(fixture);
		assert.equal(mutations.length, 8);
		assert.equal(new Set(mutations.map(([label]) => label)).size, mutations.length);
		for(const [label, mutate] of mutations)
		{
			const original = syntheticModel(prefix), changed = structuredClone(original);
			mutate(changed); assert.notDeepEqual(changed, original, `${fixture} ${label}`);
		}
		// Without refined exports every leaf mutation refuses instead of passing vacuously.
		const unrefined = {
			pointerBits: 64, copiedGraph: { schemaVersion: 1 }
			, sourceIdentity: { extractorSha256: "a".repeat(64) }
			, exports: [{ name: "first", refinements: { parameters: [null], result: null } }]
		};
		for(const [label, mutate] of mutations.slice(4))
			assert.throws(() => mutate(structuredClone(unrefined)), { name: "AssertionError" }, label);
	}
	assert.throws(() => recursiveCheckedRecordWitModelMutations("nested"));
});
