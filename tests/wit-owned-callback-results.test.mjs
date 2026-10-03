/**
 * WIT callback-result generation and closed contracts, without Lean execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileOwnedWitGraphModel } from "../src/backends/wit/owned-graph-model.mjs";
import { generateOwnedWitPackage } from "../src/backends/wit/owned-package.mjs";
import { renderOwnedWitNativeResources } from "../src/backends/wit/owned-native-resources.mjs";
import { guardOwnedWitHostSource } from "../src/backends/wit/owned-host-evidence.mjs";
import { brokerHeader } from "../src/backends/native/runtime-broker.mjs";
import { nativeCallbackHeader } from "../src/backends/native/callback-broker.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../src/build/native-graph-model.mjs";
import { supportsNativeCallbackResultTargets } from "../src/build/native-project.mjs";
import { ownedWitReadme } from "../src/release/owned-wasi.mjs";
import { assertOwnedWitHostContract, ownedWitValueContract } from "../src/build/owned-wit-artifacts.mjs";
import { ownedAggregateReviewedIr } from "./helpers/owned-aggregate-fixture.mjs";
import { ownedRustTransferReviewedIr } from "./helpers/owned-rust-transfer-fixture.mjs";
import { ownedRustBorrowReviewedIr } from "./helpers/owned-rust-borrow-fixture.mjs";
import { ownedRustReceiverReviewedIr } from "./helpers/owned-rust-receiver-fixture.mjs";
import { ownedDotnetCallbackResultReviewedIr, ownedDotnetCallbackResultCombinedReviewedIr } from "./helpers/owned-dotnet-callback-result-fixture.mjs";
import { witOwnedCallbackResultFixture } from "./helpers/wit-owned-callback-result-fixture.mjs";
import { ownedWitCallbackResultProbe } from "./helpers/wit-owned-callback-result-probe.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";

const capabilities = { transferredInputs: true, anchoredResults: true, receiverExports: true, callbackResultAnchors: true };
const variants = ["no-host", "host", "combined"];

test("WIT native and multi-profile admission reconstruct callback anchors without admitting unsupported targets", async () => {
	for(const targets of [["wit-wasi"], ["c", "wit-wasi"], ["cpan", "maven", "wit-wasi", "php-native"]])
		assert.equal(supportsNativeCallbackResultTargets(targets), true);
	for(const targets of [["php-wasm"], ["wit-wasi", "npm"], ["wit-wasi", "unknown"]])
		assert.equal(supportsNativeCallbackResultTargets(targets), false);
	for(const mode of ["ordinary", "reviewed"]) for(const variant of variants)
	{
		const { input, options, model, evidence, sources } = await witOwnedCallbackResultFixture(mode, variant);
		const reconstructed = createCompiledNativeModel(input, { ownedGraphs: true
			, ownedHostCallbacks: options.hostCallbacks, ownedInputTransfers: true
			, ownedAnchoredResults: true, ownedReceiverExports: true
			, ownedCallbackResultAnchors: supportsNativeCallbackResultTargets(["wit-wasi"]) });
		assert.deepEqual(reconstructed, model);
		const readme = ownedWitReadme({ ...evidence, prefix: sources.generated.values.prefix }, "2.38", "Example", "Example::example");
		assert.match(readme, /## Callback-result anchors/u);
		assert.match(readme, /zero-based\ncallback-local parameter indexes separately from export result anchors/u);
		assert.doesNotMatch(readme, /Callback-result anchors are not yet supported/u);
		assert.match(readme, /empty values and transitive descendants/u);
		if(variant === "no-host")
		{
			assert.match(readme, /This package has no host callback descriptors/u);
			assert.doesNotMatch(readme, /Typed host callbacks borrow/u);
		}
		else assert.match(readme, /raw typed values with a NULL result owner/u);
	}
});

test("WIT callback anchors require admission and keep callback-local indexes separate from exports", () => {
	for(const combined of [false, true])
	{
		const ir = (combined ? ownedDotnetCallbackResultCombinedReviewedIr : ownedDotnetCallbackResultReviewedIr)();
		const original = canonicalJson(ir), options = combined ? capabilities : { callbackResultAnchors: true };
		assert.throws(() => compileOwnedWitGraphModel(ir, {}, { ...options, callbackResultAnchors: false }), /explicit output leases/u);
		for(const invalid of [null, 0, 1, "true"])
			assert.throws(() => compileOwnedWitGraphModel(ir, {}, { ...options, callbackResultAnchors: invalid }), /capability must be explicit/u);
		const model = compileOwnedWitGraphModel(ir, {}, options), graph = model.manifest.graph;
		assert.equal(canonicalJson(ir), original); assert.equal(graph.schemaVersion, 4);
		const anchored = model.layout.callbacks.filter(item => item.anchor !== undefined);
		assert.deepEqual(anchored.map(item => item.anchor).sort(), [1, 1, 2, 2]);
		assert.deepEqual(graph.callbackResultAnchors, anchored.map(item => ({ id: item.id, parameter: item.anchor - 1 })));
		assert.equal(graph.resultAnchors?.length ?? 0, combined ? 1 : 0);
		assert.equal(graph.receiverExports?.length ?? 0, combined ? 5 : 0);
		assert.equal(graph.inputTransfers?.length ?? 0, combined ? 2 : 0);
		assert.equal(model.manifest.deferred.includes("callback-result-anchors"), false);
		assert.equal(model.manifest.deferred.includes("export-result-anchors"), !combined);
		assert.match(renderOwnedWitNativeResources(model), /const ov_input_anchor \*input_anchor;/u);
		for(const item of anchored)
		{
			const fn = model.functions.find(fn => fn.resource?.id === item.id);
			assert.equal(fn.parameters[0].witName, "self");
			assert.equal(fn.parameters[item.anchor].copy, model.graph.value(item.parameters[item.anchor], "input"));
			assert.equal(fn.resultCopy, model.graph.value(item.result, "output"));
		}
		const reordered = structuredClone(ir); reordered.types.reverse();
		const second = compileOwnedWitGraphModel(reordered, {}, options);
		assert.deepEqual(second.manifest.graph.callbackResultAnchors, graph.callbackResultAnchors);
		assert.deepEqual(second.layout.nodes.map(node => node.id), model.layout.nodes.map(node => node.id));
		const settings = { name: "callback-order-probe" };
		for(const key of ["wit", "wat"]) assert.equal(compileOwnedWitGraphModel(reordered, settings, options)[key],
			compileOwnedWitGraphModel(ir, settings, options)[key]);
	}
});

test("WIT callback packages generate whole-owner signatures and no-host typed copies", async () => {
	for(const mode of ["ordinary", "reviewed"]) for(const variant of variants)
	{
		const { input, options, model, component, sources, compiled, evidence } = await witOwnedCallbackResultFixture(mode, variant);
		const generated = sources.generated, callbacks = generated.values.callbacks.filter(item => item.anchor !== undefined);
		const probe = await ownedWitCallbackResultProbe(generated, variant === "combined", options.hostCallbacks);
		assert.ok(probe.startsWith(`#define HOST_CALLBACKS ${options.hostCallbacks ? 1 : 0}\n#define COMBINED ${variant === "combined" ? 1 : 0}\n`));
		await assert.rejects(ownedWitCallbackResultProbe(generated, variant === "combined", !options.hostCallbacks));
		assert.equal(model.schemaVersion, 11); assert.equal(model.ownedGraph.schemaVersion, 6);
		assert.equal(compiled.ownedValues.schemaVersion, 5);
		assert.deepEqual(compiled.ownedValues.callbackResultAnchors, model.ownedGraph.callbackResultAnchors);
		assert.equal(generated.values.anchoredResults, true); assert.equal(generated.values.copies.length, 20);
		assert.deepEqual(generated.model.layout, generated.layout);
		assertOwnedWitHostContract(compiled, evidence, sources, "2.38");
		assert.throws(() => generateOwnedWitPackage({ ...input, callbackResultAnchors: false }, component), /explicit output leases/u);
		assert.throws(() => createCompiledNativeModel(input, { ownedGraphs: true
			, ownedHostCallbacks: options.hostCallbacks
			, ownedInputTransfers: options.transferredInputs
			, ownedAnchoredResults: options.anchoredResults
			, ownedReceiverExports: options.receiverExports }), /callback-result lifetime consumer adapter/u);
		for(const callback of callbacks)
		{
			const signature = generated.values.signature(callback);
			assert.ok(generated.publicHeader.includes(signature + ";"));
			assert.ok(signature.includes(`a${callback.anchor}_owner`));
			assert.ok(generated.source.includes(`status = ${callback.symbol}(host->native, `));
		}
		assert.match(generated.source, /frame\.host\.input_anchor = anchor;/u);
		assert.match(generated.source, /ov_anchor_prepare\(&transaction, anchor\)/u);
		assert.match(generated.source, /host->input_anchor/u);
		if(variant === "no-host")
		{
			assert.equal(compiled.ownedValues.hostCallbacks, null);
			assert.equal(generated.carriers.callbackSource, undefined);
			assert.doesNotMatch(generated.publicHeader, /_host\b/u);
			assert.doesNotMatch(generated.source, /lb_native_callback_register/u);
		}
	}
});

test("WIT reconstructed contracts reject stripped capabilities, downgrades and changed callback anchors", async t => {
	let rejections = 0;
	for(const mode of ["ordinary", "reviewed"]) for(const variant of variants)
	{
		const { compiled, evidence, sources, model } = await witOwnedCallbackResultFixture(mode, variant);
		const mutations = [
			value => { value.schemaVersion = 1; }
			, value => { value.ownedValues.schemaVersion = variant === "combined" ? 4 : 1; }
			, value => { delete value.ownedValues.callbackResultAnchors; }
			, value => { value.ownedValues.callbackResultAnchors.signatures.pop(); }
			, value => { value.ownedValues.callbackResultAnchors.signatures[0].parameter++; }
			, value => { value.ownedValues.callbackResultAnchors.signatures[0].id += "-wrong"; }
			, value => { value.ownedValues.callbackResultAnchors.expiration = "never"; }
			, value => { value.ownedValues.callbackResultAnchors.independentOwnership = "implicit"; }
			, value => { value.ownedValues.callbackResultAnchors.extra = true; }
			, value => { value.ownedValues.headerSha256 = "0".repeat(64); }
			, value => { value.componentReceiptSha256 = "0".repeat(64); }
			, value => { value.ownedValues.hostCallbacks = variant === "no-host" ? {} : null; }
		];
		for(const change of mutations)
		{
			const altered = structuredClone(compiled); change(altered);
			assert.throws(() => assertOwnedWitHostContract(altered, evidence, sources, "2.38")); rejections++;
		}
		for(const change of [
			value => { value.graph.schemaVersion = variant === "combined" ? 3 : 1; }
			, value => { delete value.graph.callbackResultAnchors; }
			, value => { value.graph.callbackResultAnchors[0].parameter++; }
			, value => { value.graph.callbackResultAnchors[0].id += "-wrong"; }
		]) {
			const altered = structuredClone(compiled), manifest = JSON.parse(sources.files["binding-manifest.json"]);
			change(manifest); const bytes = canonicalJson(manifest);
			altered.files["binding-manifest.json"] = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) };
			assert.throws(() => assertOwnedWitHostContract(altered, evidence, sources, "2.38"), /generated source identity/u); rejections++;
		}
		for(const change of [
			value => { value.schemaVersion = 10; value.ownedGraph.schemaVersion = 5; delete value.ownedGraph.callbackResultAnchors; }
			, value => { value.ownedGraph.schemaVersion = 5; }
			, value => { delete value.ownedGraph.callbackResultAnchors; }
			, value => { value.ownedGraph.callbackResultAnchors.signatures[0].parameter++; }
		]) {
			const altered = structuredClone(model); change(altered);
			assert.throws(() => generateCompiledNativeLeanAdapters(altered)); rejections++;
		}
	}
	assert.equal(rejections, 120); t.diagnostic(`${rejections} contract and native-witness alterations rejected`);
});

test("WIT callback invocation names and callback-local anchors reject collisions and drift", () => {
	const ir = ownedDotnetCallbackResultReviewedIr(), options = { callbackResultAnchors: true };
	const model = compileOwnedWitGraphModel(ir, {}, options);
	const invoke = model.functions.find(fn => fn.resource).witName;
	const collision = structuredClone(ir); collision.declarations[0].name = invoke.replaceAll("-", "_");
	assert.throws(() => compileOwnedWitGraphModel(collision, {}, options), /collision|duplicate|Duplicate/u);
	for(const change of [
		value => { value.callable.result.lifetime.anchor = "missing"; }
		, value => { value.callable.result.lifetime.anchor = "self"; }
		, value => { value.callable.result.lifetime.scope = "call"; }
		, value => { value.callable.parameters[1].ownership = "transfer"; }
	]) {
		const altered = structuredClone(ir);
		const callback = altered.types.find(type => type.kind === "callback"
			&& type.callable.result.ownership === "borrow" && type.callable.parameters.length === 2);
		change(callback); assert.throws(() => compileOwnedWitGraphModel(altered, {}, options));
	}
});

test("WIT callback admission preserves predecessor files and contracts byte for byte", async () => {
	for(const fixture of [ownedAggregateReviewedIr, ownedRustTransferReviewedIr, ownedRustBorrowReviewedIr, ownedRustReceiverReviewedIr])
	{
		const ir = fixture(), before = compileOwnedWitGraphModel(ir, {}, { ...capabilities, callbackResultAnchors: false });
		const after = compileOwnedWitGraphModel(ir, {}, capabilities);
		for(const key of ["layout", "manifest", "wit", "wat"]) assert.deepEqual(after[key], before[key]);
	}
	const predecessors = [
		["wit-owned-borrows-20261001"
			, "1cbcf73fbad42679441371ff5448379c0513dab5ba17892095dbaa37efef2e01"
			, [
			"4f620c739049c9e1be8da8c0fa64cd77a7791db505443e645f92c7171022dee3"
			, "e24aa55882739747a52b22510e04b6397a810e3ea687c1c12fe4e2bdc075830b"
			, "20eca4d4110fb858304007e2ff2ff7dba45af35100c041e3dcdd39f3c56257fb"
			, "af0a945a56430632403f33a0ea7d683d7b3edcc7b7da1baa663c90e93dc3a4a2"
			]
		]
		, ["wit-owned-receivers-20261001"
			, "d8621ed8b0744f9a9ac9bb5ddb1da200b3f7b85f5bab801a54c248e4b36e0262"
			, [
			"22e707ecef94329c1e8b1457356ed4b6ee72b9e499bab2b15c4b5fd813b076bd"
			, "ca9eb7d244635035189ba872182fbc8bee74b40408f66dff6d67fcf28a74686b"
			, "d346a3f77e90d614eb8d7deae3ec762c35a976c67f3f6782dfae2d2be185e34f"
			, "c5062b54ec6f8a34a254dda67cd120941974de80cbe454831c7d888d8d3862ce"
			, "9ff747899ab19b92eda666880d75a08d2f6240e3987d0f366fbe44c2b8e8848e"
			, "4a7b4d82e5ee85ba819121035a86d76b88b8f8a040ca545bd26518cbf84d1873"
			, "24a00a98f89278b2c1ec05464d800c54ac6770f47a00b86fab0f2f7c6c36603f"
			, "79cd2e965129294a771097cb0c86fa342063f3c95779b0c73b31daae9639260d"
			]
		]
	];
	for(const [name, hash, filesHashes] of predecessors)
	{
		const bytes = await readFile(`docs/evidence/${name}.json`); assert.equal(sha256(bytes), hash);
		const record = JSON.parse(bytes), records = [...record.runtime, ...record.borrowOnly ?? [], ...record.resources ?? []];
		assert.equal(records.length, filesHashes.length);
		for(const [index, item] of records.entries())
		{
			const component = Buffer.from(item.componentBase64, "base64");
			const before = generateOwnedWitPackage(item.input, component);
			const after = generateOwnedWitPackage({ ...item.input, callbackResultAnchors: true }, component);
			assert.equal(sha256(canonicalJson(before.files)), filesHashes[index]);
			assert.deepEqual(after.files, before.files); assert.deepEqual(after.model.manifest, item.manifest);
			assert.equal(sha256(after.source), item.sourceSha256);
		}
		for(const item of [...record.packages, ...record.resourcePackages ?? []])
		{
			assert.deepEqual(createCompiledNativeModel(item.inputs, { ownedGraphs: true
				, ownedHostCallbacks: Boolean(item.model.ownedGraph.hostCallbacks)
				, ownedInputTransfers: true, ownedAnchoredResults: true
				, ownedReceiverExports: true
				, ownedCallbackResultAnchors: true }), item.model);
			const generated = generateOwnedWitPackage({ ...item.inputs, callbackResultAnchors: true }
				, Buffer.from(item.componentBase64, "base64"), item.receipt.settings);
			const sources = { generated
				, files: { ...generated.files
				, [`src/${generated.values.prefix}.c`]: guardOwnedWitHostSource(generated, item.receipt.dependencies) } };
			assert.deepEqual(ownedWitValueContract(item.model, sources), item.receipt.ownedValues);
			const readme = ownedWitReadme({ projection: generated.model, prefix: generated.values.prefix, model: item.model }
				, item.manifest.glibcMinimumVersion, item.manifest.cmakePackage, item.manifest.cmakeTarget);
			assert.deepEqual({ bytes: Buffer.byteLength(readme), sha256: sha256(readme) }, item.manifest.files["README.md"]);
		}
	}
});

test("WIT callback hosts pass pinned component validation and C syntax without Lean execution", {
	skip: process.env.LEAN_BRIDGE_WIT_OWNED_CALLBACK_RESULT_TEST !== "1"
	, timeout: 120000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-wit-callback-syntax-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const tools = resolve(process.env.LEAN_BRIDGE_WASM_TOOLS ?? ".toolchains/wasm-tools/bin/wasm-tools");
	const wasmtime = resolve(process.env.LEAN_BRIDGE_WASMTIME_C_API ?? ".toolchains/wasmtime42");
	const lean = resolve(process.env.LEAN_BRIDGE_LEAN_PREFIX ?? ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
	assert.match((await runCopied(tools, ["--version"], directory, process.env)).stdout, /^wasm-tools 1\.245\.1(?: |\n|$)/u);
	for(const mode of ["ordinary", "reviewed"]) for(const variant of variants)
	{
		const { input, sources } = await witOwnedCallbackResultFixture(mode, variant), root = join(directory, `${mode}-${variant}`);
		await saveLakeFile(root, "component.wat", sources.generated.model.wat);
		await saveLakeFile(root, "component.wit", sources.generated.model.wit);
		await runCopied(tools, ["parse", "component.wat", "-o", "component.wasm"], root, process.env);
		await runCopied(tools, ["validate", "--features", "component-model", "component.wasm"], root, process.env);
		await runCopied(tools, ["component", "wit", "component.wit", "--json"], root, process.env);
		const generated = generateOwnedWitPackage(input, await readFile(join(root, "component.wasm")));
		for(const [path, source] of Object.entries(generated.files)) await saveLakeFile(root, path, source);
		await saveLakeFile(root, "internal/lean_bridge_native_runtime.h", brokerHeader.replace("#ifdef __cplusplus\n}", `${nativeCallbackHeader}\n#ifdef __cplusplus\n}`));
		const result = await runCopied(process.env.CC ?? "cc", ["-std=c11"
			, "-fsyntax-only", "-Wall", "-Wextra", "-Werror"
			, "-I", join(root, "include"), "-I", join(root, "internal")
			, "-I", join(wasmtime, "include"), "-I", join(lean, "include")
			, join(root, `src/${generated.values.prefix}.c`)], root, process.env);
		assert.equal(result.stderr, "");
	}
	t.diagnostic("6 generated components validated; 6 C hosts passed syntax; no Lean or Wasmtime execution");
});
