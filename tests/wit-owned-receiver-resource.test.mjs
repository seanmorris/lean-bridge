/**
 * Exercise resource-only and unanchored callable members through real WIT calls.
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
import { createCompiledNativeModel } from "../src/build/native-graph-model.mjs";
import { snapshotWasmtimeCapi } from "../src/build/native-wit-projection.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedWitReceiverConfiguration } from "./helpers/wit-owned-receiver-configurations.mjs";
import { ownedWitReceiverResourceProbe } from "./helpers/wit-owned-receiver-resource-probe.mjs";
import { ownedWitBorrowNativeSource } from "./helpers/wit-owned-borrow-probe.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

for(const mode of ["ordinary", "reviewed"]) for(const kind of ["plain", "consuming", "unanchored"])
	test(`WIT receiver optional capabilities execute (${mode}, ${kind})`, {
		skip: process.env.LEAN_BRIDGE_WIT_OWNED_RECEIVER_TEST !== "1", timeout: 600000
	}, async t => {
		const selected = await ownedWitReceiverConfiguration(kind);
		const { sourceSuffix, hostCallbacks, transferredInputs, anchoredResults, receiverExports } = selected;
		const capabilities = { hostCallbacks, transferredInputs, anchoredResults, receiverExports };
		const compiled = await compileOwnedAggregateFixture(t, {
			...mode === "ordinary" ? { configuration: selected.configuration }
				: { reviewedIr: selected.reviewedIr }
			, sourceSuffix, hostCallbacks
			, evidenceName: `wit-receivers-${mode}-${kind}-inputs.json`
		});
		const model = compileOwnedWitGraphModel(compiled.model.bindingIr, {}, capabilities);
		assert.equal(model.manifest.graph.resultAnchors, undefined);
		assert.equal(model.layout.callbacks.length > 0, hostCallbacks);
		assert.equal(Boolean(model.manifest.graph.inputTransfers), transferredInputs);
		assert.equal(model.manifest.graph.receiverExports.length, kind === "unanchored" ? 16 : kind === "consuming" ? 4 : 3);
		await saveLakeFile(compiled.directory, "component.wat", model.wat);
		await saveLakeFile(compiled.directory, "component.wit", model.wit);
		for(const args of [["parse", "component.wat", "-o", "component.wasm"]
			, ["validate", "component.wasm"]
			, ["component", "wit", "component.wit", "--json"]
			, ["component", "wit", "component.wasm", "--json"]])
			await runCopied("wasm-tools", args, compiled.directory, process.env);
		const component = await readFile(join(compiled.directory, "component.wasm"));
		const input = { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component, ...capabilities };
		const native = createCompiledNativeModel(input, { ownedGraphs: true
			, ownedHostCallbacks: hostCallbacks, ownedInputTransfers: transferredInputs
			, ownedAnchoredResults: false, ownedReceiverExports: true });
		assert.equal(native.schemaVersion, 10);
		assert.equal(native.ownedGraph.resultAnchors, undefined);
		assert.equal(Boolean(native.ownedGraph.inputTransfers), transferredInputs);
		assert.equal(Boolean(native.ownedGraph.hostCallbacks), hostCallbacks);
		const generated = generateOwnedWitPackage(input, component);
		assert.equal(generated.carriers.leanSource, compiled.leanSource);
		assert.equal(Boolean(generated.carriers.callbackSource), hostCallbacks);
		assert.doesNotMatch(generated.publicHeader, /_result_validate\(/u);
		const sdk = join(compiled.directory, "wasmtime");
		await snapshotWasmtimeCapi(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? resolve(".toolchains/wasmtime42"), sdk);
		const implementation = ownedWitBorrowNativeSource(generated);
		for(const [path, source] of Object.entries(generated.files))
			await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
		const source = await ownedWitReceiverResourceProbe(generated, kind);
		const extra = ["public-api.c", "-lgmp", "-I", join(sdk, "include"), "-L", join(sdk, "lib"), `-Wl,-rpath,${join(sdk, "lib")}`, "-lwasmtime"];
		const normal = await (await compiled.compile(`wit-${mode}-${kind}`, source, false, extra))();
		assert.equal(normal.stderr, "");
		const result = JSON.parse(normal.stdout);
		assert.ok(result.checks > 30);
		assert.equal(result.live, 0); assert.equal(result.identities, 0);
		// Wrong-session and expired-receiver calls reject before WIT dispatch.
		assert.equal(result.componentCalls, kind === "unanchored" ? 17 : kind === "consuming" ? 6 : 4);
		assert.equal(result.componentCalls, result.nativeImports);
		assert.equal(result.componentCalls, result.leanCalls);
		assert.equal(result.exports, kind === "unanchored" ? 9 : kind === "consuming" ? 5 : 4);
		const sanitized = await compiled.compile(`wit-${mode}-${kind}-sanitized`, source, true, extra);
		const environment = { LSAN_OPTIONS: "exitcode=0" };
		const cold = await sanitized([], { ...environment, LEAN_BRIDGE_OWNED_COLD_ONLY: "1" });
		const exercised = await sanitized([], environment);
		assert.deepEqual(JSON.parse(cold.stdout), { cold: true });
		assert.equal(exercised.stdout, normal.stdout);
		const normalize = text => text.replace(/==\d+==/gu, "==PID==").replace(/0x[0-9a-f]+/gu, "ADDRESS").replaceAll(compiled.directory, "<probe>");
		assert.doesNotMatch(exercised.stderr, /ERROR: AddressSanitizer|runtime error:/u);
		assert.equal(normalize(exercised.stderr), normalize(cold.stderr));
		await saveLakeFile("build/owned-wit-receivers", `${mode}-${kind}.json`, canonicalJson({
			schemaVersion: 1, mode, kind, input, native, result
			, sanitizer: "address,undefined", startupLeakBaseline: normalize(cold.stderr)
			, componentBase64: component.toString("base64")
			, componentSha256: sha256(component)
			, sourceSha256: sha256(generated.source), probeSha256: sha256(source)
			, manifest: model.manifest
		}));
		t.diagnostic(JSON.stringify({ mode, kind, ...result }));
	});
