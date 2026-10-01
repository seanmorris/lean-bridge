/**
 * Original result owners cross real Component Model calls into compiled Lean.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedWitGraphModel } from "../src/backends/wit/owned-graph-model.mjs";
import { generateOwnedWitPackage } from "../src/backends/wit/owned-package.mjs";
import { snapshotWasmtimeCapi } from "../src/build/native-wit-projection.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedRustBorrowConfiguration, ownedRustBorrowReviewedIr, ownedRustBorrowSource } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedBorrowConfiguration, ownedBorrowReviewedIr } from "./helpers/owned-borrow-fixture.mjs";
import { ownedRustTransferReviewedIr } from "./helpers/owned-rust-transfer-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { ownedWitBorrowProbe, ownedWitBorrowNativeSource } from "./helpers/wit-owned-borrow-probe.mjs";
import { rejectOwnedWitBorrowMutants } from "./helpers/wit-owned-borrow-mutants.mjs";
import { assertOwnedWitBorrowCi, ownedWitBorrowReports } from "./helpers/wit-owned-borrow-ci.mjs";

test("WIT borrow CI requires every enabled runtime and installed report", async () => {
	const workflow = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const manifest = JSON.parse(await readFile("package.json", "utf8"));
	assertOwnedWitBorrowCi(workflow, manifest);
	for(const removed of ["          npm run test:owned-wit-borrows 2>&1 | tee build/wit-owned-borrows.log\n"
		, "          rg '^# skipped 0$' build/wit-owned-borrows.log\n"
		, ...ownedWitBorrowReports.map(path => "          test -s " + path + "\n")])
		assert.throws(() => assertOwnedWitBorrowCi(workflow.replace(removed, ""), manifest));
});

test("WIT borrowed results require explicit original-owner capability", () => {
	const ir = ownedRustBorrowReviewedIr();
	assert.throws(() => compileOwnedWitGraphModel(ir, {}, { transferredInputs: true }), /explicit output leases/u);
	const model = compileOwnedWitGraphModel(ir, {}, { transferredInputs: true, anchoredResults: true });
	assert.equal(model.layout.functions.length, 26);
	assert.equal(model.manifest.graph.schemaVersion, 2);
	assert.equal(model.manifest.graph.resultAnchors.length, 19);
	assert.deepEqual(model.manifest.graph.resultAnchors.find(fn => fn.bindingId === "lean:Owned.bundle"), { bindingId: "lean:Owned.bundle", parameter: 2 });
	assert.equal(model.manifest.deferred.includes("anchored-borrowed-results"), false);
	assert.ok(model.manifest.deferred.includes("receiver-result-anchors"));
	for(const key of ["layout", "manifest", "wit", "wat"])
		assert.deepEqual(compileOwnedWitGraphModel(ownedRustTransferReviewedIr(), {}, { transferredInputs: true, anchoredResults: true })[key]
			, compileOwnedWitGraphModel(ownedRustTransferReviewedIr(), {}, { transferredInputs: true })[key]);
});

for(const mode of ["ordinary", "reviewed"]) for(const borrowOnly of [false, true]) test(`WIT preserves borrowed-result lifetimes through compiled Lean (${mode}${borrowOnly ? ", no transfers" : ""})`, {
	skip: process.env.LEAN_BRIDGE_WIT_OWNED_BORROW_TEST !== "1", timeout: 1200000
}, async t => {
	const name = mode + (borrowOnly ? "-borrow-only" : "");
	const compiled = await compileOwnedAggregateFixture(t, {
		...mode === "ordinary" ? { configuration: await (borrowOnly ? ownedBorrowConfiguration : ownedRustBorrowConfiguration)() }
			: { reviewedIr: (borrowOnly ? ownedBorrowReviewedIr : ownedRustBorrowReviewedIr)() }
		, hostCallbacks: true, sourceSuffix: borrowOnly ? "" : ownedRustBorrowSource
		, evidenceName: `wit-borrows-${name}-inputs.json`
	});
	const model = compileOwnedWitGraphModel(compiled.model.bindingIr, {}, { transferredInputs: !borrowOnly, anchoredResults: true });
	assert.equal(model.layout.functions.length, borrowOnly ? 22 : 26);
	assert.equal(model.manifest.graph.resultAnchors.length, borrowOnly ? 18 : 19);
	if(borrowOnly) assert.equal(model.manifest.graph.inputTransfers, undefined);
	await saveLakeFile(compiled.directory, "component.wat", model.wat);
	await saveLakeFile(compiled.directory, "component.wit", model.wit);
	await runCopied("wasm-tools", ["parse", "component.wat", "-o", "component.wasm"], compiled.directory, process.env);
	await runCopied("wasm-tools", ["validate", "component.wasm"], compiled.directory, process.env);
	await runCopied("wasm-tools", ["component", "wit", "component.wit", "--json"], compiled.directory, process.env);
	const component = await readFile(join(compiled.directory, "component.wasm"));
	const input = { metadata: compiled.metadata
		, sourceIdentity: compiled.sourceIdentity
		, component: compiled.model.component, hostCallbacks: true
		, transferredInputs: !borrowOnly, anchoredResults: true };
	const generated = generateOwnedWitPackage(input, component);
	assert.equal(generated.carriers.leanSource, compiled.leanSource);
	assert.deepEqual(generated.model.layout, model.layout);
	const sdk = join(compiled.directory, "wasmtime");
	await snapshotWasmtimeCapi(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? resolve(".toolchains/wasmtime42"), sdk);
	const implementation = ownedWitBorrowNativeSource(generated);
	for(const [path, source] of Object.entries(generated.files))
		await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
	await saveLakeFile(compiled.directory, "borrow-copies.h", [
		["OPTION", "echoOption"], ["ARRAY", "echoArray"], ["LIST", "echoList"]
		, ["RESULT", "echoResult"], ["TUPLE", "echoTuple"]
		, ["ROW", "echoRow"], ["NESTED", "echoNested"]
	].map(([macro, name]) => {
		const id = generated.values.functions.find(fn => fn.name === name).parameters[0];
		return `#define COPY_${macro} ${generated.values.copies.find(fn => fn.id === id).cName}`;
	}).join("\n") + "\n");
	const source = await ownedWitBorrowProbe(generated, false, borrowOnly);
	const extra = ["public-api.c", "-lgmp", "-I", join(sdk, "include"), "-L", join(sdk, "lib"), `-Wl,-rpath,${join(sdk, "lib")}`, "-lwasmtime"];
	const run = await compiled.compile(`wit-${mode}-borrowed`, source, false, extra);
	const normal = await run(); assert.equal(normal.stderr, "");
	const [result, counts] = normal.stdout.trim().split("\n").map(line => JSON.parse(line));
	assert.ok(result.checks > 1000); assert.ok(result.failures > 0);
	if(!borrowOnly) assert.ok(result.beforeFailures > 0 && result.afterFailures > 0);
	else
	{ assert.equal(result.emptyShapes, 4); assert.equal(result.maximumBorrowDepth, 128); }
	assert.equal(result.live, 0); assert.equal(result.identities, 0);
	assert.ok(counts.componentCalls > 100); assert.equal(counts.componentCalls, counts.nativeImports);
	assert.ok(counts.leanCalls > 100 && counts.leanCalls <= counts.nativeImports);
	assert.equal(counts.exports, borrowOnly ? 4 : 26);
	const sanitized = await compiled.compile(`wit-${mode}-borrowed-sanitized`, source, true, extra);
	const environment = { LSAN_OPTIONS: "exitcode=0" };
	const cold = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
	const exercised = await sanitized([], environment);
	assert.deepEqual(cold.stdout.trim().split("\n").map(line => JSON.parse(line)), [{ cold: true }
		, { componentCalls: 0, nativeImports: 0, leanCalls: 0, exports: 0 }]);
	assert.equal(exercised.stdout, normal.stdout);
	const normalize = text => text.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS").replaceAll(compiled.directory, "<probe>");
	assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
	assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
	const mutations = borrowOnly ? [] : await rejectOwnedWitBorrowMutants(compiled, implementation, source, extra, normal.stdout);
	await saveLakeFile("build/owned-wit-borrows", `${name}.json`, canonicalJson({
		schemaVersion: 1, mode, borrowOnly
		, input, result, counts, mutations, sanitizer: "address,undefined"
		, startupLeakBaseline: normalize(cold.stderr)
		, componentBase64: component.toString("base64")
		, componentSha256: sha256(component)
		, sourceSha256: sha256(generated.source), probeSha256: sha256(source)
		, manifest: model.manifest }));
	t.diagnostic(JSON.stringify({ mode, ...result, ...counts }));
});
