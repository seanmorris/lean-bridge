/**
 * Execute callback-local ownership through real Wasmtime and compiled Lean.
 * These direct probes do not claim installed-package or process-lifecycle acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, statfs } from "node:fs/promises";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedWitGraphModel } from "../src/backends/wit/owned-graph-model.mjs";
import { generateOwnedWitPackage } from "../src/backends/wit/owned-package.mjs";
import { createCompiledNativeModel } from "../src/build/native-graph-model.mjs";
import { snapshotWasmtimeCapi } from "../src/build/native-wit-projection.mjs";
import { ownedWitValueContract } from "../src/build/owned-wit-artifacts.mjs";
import { compileOwnedAggregateFixture } from "./helpers/owned-aggregate-native.mjs";
import { ownedDotnetCallbackResultConfiguration, ownedDotnetCallbackResultReviewedIr, ownedDotnetCallbackResultSource
	, ownedDotnetCallbackResultCombinedConfiguration, ownedDotnetCallbackResultCombinedReviewedIr, ownedDotnetCallbackResultCombinedSource } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { ownedWitCallbackResultProbe, ownedWitCallbackNativeSource } from "./helpers/wit-owned-callback-result-probe.mjs";

for(const mode of ["ordinary", "reviewed"]) for(const variant of ["no-host", "host", "combined"])
	test(`WIT callback-result owners execute through compiled Lean (${mode}, ${variant})`, {
		skip: process.env.LEAN_BRIDGE_WIT_OWNED_CALLBACK_RESULT_RUNTIME_TEST !== "1"
		, timeout: 900000
	}, async t => {
		const disk = await statfs("/tmp"), freeBytes = disk.bavail * disk.bsize;
		assert.ok(freeBytes > 2 * 1024 ** 3, `Runtime fixture requires more than 2 GiB free, observed ${freeBytes}`);
		const combined = variant === "combined", hostCallbacks = variant !== "no-host";
		const capabilities = { callbackResultAnchors: true, transferredInputs: combined, anchoredResults: combined, receiverExports: combined };
		const configuration = combined ? ownedDotnetCallbackResultCombinedConfiguration : ownedDotnetCallbackResultConfiguration;
		const reviewed = combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr;
		const compiled = await compileOwnedAggregateFixture(t, {
			...mode === "ordinary" ? { configuration: await configuration() } : { reviewedIr: reviewed() }
			, hostCallbacks
			, sourceSuffix: combined ? ownedDotnetCallbackResultCombinedSource : ownedDotnetCallbackResultSource
			, evidenceName: `wit-callback-results-${mode}-${variant}-inputs.json`
		});
		const model = compileOwnedWitGraphModel(compiled.model.bindingIr, {}, capabilities);
		assert.equal(model.manifest.graph.callbackResultAnchors.length, 4);
		await saveLakeFile(compiled.directory, "component.wat", model.wat);
		await saveLakeFile(compiled.directory, "component.wit", model.wit);
		const tools = resolve(process.env.LEAN_BRIDGE_WASM_TOOLS ?? ".toolchains/wasm-tools/bin/wasm-tools");
		const version = await runCopied(tools, ["--version"], compiled.directory, process.env);
		assert.match(version.stdout, /^wasm-tools 1\.245\.1(?: |\n|$)/u);
		const validation = [];
		for(const args of [["parse", "component.wat", "-o", "component.wasm"]
			, ["validate", "component.wasm"]
			, ["component", "wit", "component.wit", "--json"]
			, ["component", "wit", "component.wasm", "--json"]])
			validation.push({ args, ...await runCopied(tools, args, compiled.directory, process.env) });
		const component = await readFile(join(compiled.directory, "component.wasm"));
		const input = { metadata: compiled.metadata
			, sourceIdentity: compiled.sourceIdentity
			, component: compiled.model.component, hostCallbacks, ...capabilities };
		const native = createCompiledNativeModel(input, { ownedGraphs: true
			, ownedHostCallbacks: hostCallbacks, ownedCallbackResultAnchors: true
			, ownedInputTransfers: combined, ownedAnchoredResults: combined
			, ownedReceiverExports: combined });
		const generated = generateOwnedWitPackage(input, component);
		assert.equal(generated.carriers.leanSource, compiled.leanSource);
		assert.deepEqual(generated.model.layout, model.layout);
		if(!hostCallbacks)
		{
			assert.equal(generated.carriers.callbackSource, undefined); assert.equal(compiled.callbackSource, undefined);
			assert.equal(native.ownedGraph.hostCallbacks, undefined); assert.doesNotMatch(generated.publicHeader, /_host\b/u);
		}
		const sdk = join(compiled.directory, "wasmtime");
		const wasmtime = await snapshotWasmtimeCapi(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? resolve(".toolchains/wasmtime42"), sdk);
		const implementation = ownedWitCallbackNativeSource(generated);
		for(const [path, source] of Object.entries(generated.files))
			await saveLakeFile(compiled.directory, path.startsWith("src/") ? "public-api.c" : path.split("/").at(-1), path.startsWith("src/") ? implementation : source);
		const source = await ownedWitCallbackResultProbe(generated, combined, hostCallbacks);
		const expectedExports = ["newTicket", "serial", "echoRecord", "makeRecord"
			, "makeLeasedRecord", "echoRecursive", "makeRecursive"
			, "makeRecordCallback", "dispatch", "applyTwice"
			, ...hostCallbacks ? ["callbackRecord", "callbackRecursive"] : []
			, ...combined ? ["borrowRecord", "moveRecord", "moveTwice"] : []];
		for(const name of expectedExports)
			assert.ok(source.includes(generated.values.functions.find(fn => fn.name === name).cName + "("));
		const expectedClosures = ["make_record_result_t"
			, "make_leased_record_result_t", "make_recursive_result_t"
			, "apply_twice_argument1_t", "dispatch_result_t"];
		for(const name of expectedClosures) assert.ok(source.includes(`${generated.values.prefix}_${name}_call(`));
		const extra = ["public-api.c", "-lgmp", "-I", join(sdk, "include"), "-L", join(sdk, "lib"), `-Wl,-rpath,${join(sdk, "lib")}`, "-lwasmtime"];
		let execution;
		try
		{
			const execute = await compiled.compile(`wit-${mode}-${variant}-callbacks`, source, false, extra);
			execution = await execute();
		}
		catch(error)
		{
			await saveLakeFile("build/owned-wit-callback-results", `${mode}-${variant}-failure.json`, canonicalJson({
				mode, variant, error: error.message, input, probeSource: source
				, implementationSha256: sha256(implementation)
			}));
			throw error;
		}
		await saveLakeFile("build/owned-wit-callback-results", `${mode}-${variant}-execution.json`, canonicalJson({
			mode, variant, execution, probeSha256: sha256(source)
			, observedSourceSha256: sha256(implementation)
		}));
		assert.equal(execution.stderr, ""); assert.equal(execution.code, 0);
		const [result, counts] = execution.stdout.trim().split("\n").map(line => JSON.parse(line));
		assert.ok(Number.isSafeInteger(result.checks) && result.checks > 0);
		assert.ok(Number.isSafeInteger(result.allocationFailures) && result.allocationFailures > 0);
		assert.equal(result.live, 0); assert.equal(result.identities, 0);
		assert.equal(counts.componentCalls, counts.nativeImports);
		assert.ok(counts.leanCalls <= counts.nativeImports && counts.leanCalls > counts.closureCalls);
		assert.ok(counts.closureCalls >= expectedClosures.length);
		assert.equal(counts.exports, expectedExports.length);
		const observedExports = generated.layout.functions.filter((fn, index) => (BigInt(counts.exportMask) & 1n << BigInt(index)) !== 0n).map(fn => fn.name);
		const observedClosures = generated.layout.callbacks.filter((fn, index) => (BigInt(counts.closureMask) & 1n << BigInt(index)) !== 0n)
			.map(fn => generated.values.callbacks.find(value => value.id === fn.id).cName.slice(generated.values.prefix.length + 1, -5));
		assert.deepEqual(observedExports.sort(), [...expectedExports].sort());
		assert.deepEqual(observedClosures.sort(), [...expectedClosures].sort());
		const report = { schemaVersion: 1, mode, variant, input, native, result
			, counts, execution, expectedExports, expectedClosures
			, observedExports, observedClosures
			, wasmTools: version, wasmtime, validation, manifest: model.manifest
			, ownedValues: ownedWitValueContract(native, { generated, files: generated.files })
			, componentBase64: component.toString("base64")
			, componentSha256: sha256(component)
			, sourceSha256: sha256(generated.source)
			, observedSourceSha256: sha256(implementation), probeSha256: sha256(source)
			, freeBytesBefore: freeBytes
			, freeBytesAfterExecution: (await statfs("/tmp")).bavail * disk.bsize };
		await saveLakeFile("build/owned-wit-callback-results", `${mode}-${variant}.json`, canonicalJson(report));
		t.diagnostic(JSON.stringify({ mode, variant, ...result, ...counts, freeBytesBefore: report.freeBytesBefore, freeBytesAfterExecution: report.freeBytesAfterExecution }));
	});
