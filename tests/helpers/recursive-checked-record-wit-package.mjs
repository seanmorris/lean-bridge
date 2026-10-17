/**
 * Authenticate recursive checked-record WIT graph packages against the reproduced native inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { compileCopiedWitGraphPackageModel } from "../../src/backends/wit/copied-graph-package.mjs";
import { renderWitGraphHostSource } from "../../src/backends/wit/copied-graph-host.mjs";
import { guardWitHostSource, witHostDependencies } from "../../src/backends/wit/host-evidence.mjs";
import { nativeGraphProjectionSources, nativeGraphRefinementDiagnostics } from "../../src/build/native-graph-sources.mjs";
import { wasmtimeCapiIdentity } from "../../src/build/native-wit-artifacts.mjs";
import { verifyFinContainerEdgeFileClosure } from "./fin-container-edge-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { recursiveCheckedRecordWitPackage } from "./recursive-checked-record-wit-fixture.mjs";

export const recursiveCheckedRecordWitReceipt = "lean-bridge-package.json";
/** The current generator; record checks substitute the frozen producer closure. */
export const recursiveCheckedRecordWitCurrentGenerator = Object.freeze({
	compileCopiedWitGraphPackageModel, renderWitGraphHostSource
	, guardWitHostSource, witHostDependencies
	, nativeGraphProjectionSources, nativeGraphRefinementDiagnostics
});
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

/**
 * Installed paths and regenerated textual members for one module.
 *
 * @param fixture - Recursive or mutual module.
 */
export const recursiveCheckedRecordWitLayout = fixture => {
	const { name, version, prefix } = recursiveCheckedRecordWitPackage(fixture);
	return Object.freeze({ name, version, prefix
		, directory: `${name}-${version}-wit-wasi`
		, library: `lib${prefix}_wasmtime.so`, adapterLibrary: `lib${prefix}.so`
		, component: `component/${name}.wasm`, pkgConfig: `${name}-wit`
		, sources: Object.freeze([`wit/${name}.wit`, `component/${name}.wat`
			, `include/${prefix}_wasmtime.h`, "binding-manifest.json"
			, `src/${prefix}_wasmtime.c`
			, `include/${prefix}-graph.h`, `include/${prefix}-graph-types.h`]) });
};

/**
 * Require exact archive coordinates, source identity, runtime and platform floor.
 *
 * @param receipt - Original archive-derived receipt.
 * @param pkg - Independently verified package-set component.
 * @param model - Reproduced compiler model.
 * @param floor - Explicit glibc floor.
 * @param fixture - Recursive or mutual module.
 */
export const assertRecursiveCheckedRecordWitIdentity = (receipt, pkg, model, floor, fixture) => {
	const { name, version, directory } = recursiveCheckedRecordWitLayout(fixture);
	assert.equal(pkg.target, "wit-wasi"); assert.equal(pkg.ecosystem, "wit-wasi");
	assert.equal(pkg.role, "component"); assert.equal(pkg.profile, "native-library-v1");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.name, name); assert.equal(pkg.version, version);
	assert.equal(pkg.artifacts.length, 1);
	assert.ok(pkg.artifacts[0].path.endsWith(`/${directory}.tar.gz`));
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, "lean-bridge-ordinary-wit-package");
	assert.equal(receipt.ecosystem, "wit-wasi"); assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity); assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.component, model.component); assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
	assert.match(floor, /^2\.[0-9]+$/u); assert.equal(receipt.glibcMinimumVersion, floor);
	assert.equal(receipt.wasmtime, wasmtimeCapiIdentity.version);
	assert.match(receipt.componentSha256, /^[a-f0-9]{64}$/u);
	// Recursive modules compile through copied graphs without callbacks.
	assert.equal(model.copiedGraph?.schemaVersion, 1); assert.ok(!model.copiedGraph.callbacks);
};

/**
 * Reconstruct host dependencies without accepting identities from generated source.
 *
 * @param options - Original installed receipts and independently inspected tools.
 * @param options.receipt - Original package receipt.
 * @param options.component - Native component receipt.
 * @param options.adapter - Native C graph adapter receipt.
 * @param options.runtime - Shared native runtime manifest.
 * @param options.wit - WIT adapter receipt.
 * @param options.tools - Independently inspected Wasmtime C API.
 * @param options.generator - Current or frozen generator closure.
 * @param options.fixture - Recursive or mutual module.
 */
export const recursiveCheckedRecordWitNativeEvidence = ({ receipt, component, adapter, runtime, wit, tools, generator, fixture }) => {
	const layout = recursiveCheckedRecordWitLayout(fixture);
	assert.equal(sha256(canonicalJson(runtime)), receipt.runtimeIdentity);
	for(const record of [component, adapter, wit])
	{
		assert.equal(record.runtimeIdentity, receipt.runtimeIdentity);
		assert.equal(record.bindingIrSha256, receipt.bindingIrSha256);
	}
	for(const record of [adapter, wit]) assert.equal(record.componentReceiptSha256, sha256(canonicalJson(component)));
	assert.equal(adapter.library, layout.adapterLibrary);
	assert.equal(adapter.copiedGraph?.schemaVersion, 1); assert.match(adapter.copiedGraph.layoutSha256, /^[a-f0-9]{64}$/u);
	assert.equal(wit.adapterReceiptSha256, sha256(canonicalJson(adapter)));
	assert.equal(wit.profile, "native-wit-v1"); assert.equal(wit.library, layout.library);
	assert.equal(wit.component, layout.component);
	assert.equal(wit.glibcMinimumVersion, receipt.glibcMinimumVersion);
	assert.deepEqual(wit.settings, { name: layout.name, version: layout.version });
	const { root: ignoredRoot, ...wasmtime } = tools.wasmtime; assert.ok(ignoredRoot);
	assert.deepEqual(wit.wasmtime, wasmtime);
	const dependencies = generator.witHostDependencies({ receipt: component, adapter, runtime }, tools.wasmtime.files);
	const libraries = Object.fromEntries(dependencies.map(({ name: library, ...file }) => [`lib/${library}`, file]));
	libraries[`lib/${wit.library}`] = wit.files[`lib/${wit.library}`];
	assert.deepEqual(Object.fromEntries(Object.entries(receipt.files).filter(([path]) => path.startsWith("lib/") && path.endsWith(".so"))), libraries);
	for(const [path, file] of Object.entries(wit.files))
	{
		const installed = path === "wasmtime/LICENSE" ? "share/lean-bridge/licenses/Wasmtime-LICENSE" : path.startsWith("wasmtime/") ? path.slice(9) : path;
		assert.deepEqual(receipt.files[installed], file, path);
	}
	return { runtimeIdentity: receipt.runtimeIdentity, componentReceiptSha256: sha256(canonicalJson(component)), dependencies, libraries };
};

/**
 * Render every textual member, with exact refinement diagnostics required, and the feature-off host.
 * The diagnostic-on host must read the adapter's one-shot text; the feature-off host must differ.
 *
 * @param options - Generator closure and original compiler inputs.
 * @param options.generator - Current or frozen generator functions.
 * @param options.model - Original compiler model.
 * @param options.component - Original native component receipt.
 * @param options.componentBytes - Actual component bytes.
 * @param options.dependencies - Reconstructed host dependencies.
 * @param options.fixture - Recursive or mutual module.
 */
export const recursiveCheckedRecordWitMembers = ({ generator, model, component, componentBytes, dependencies, fixture }) => {
	const { name, version, prefix: p, sources } = recursiveCheckedRecordWitLayout(fixture);
	assert.equal(generator.nativeGraphRefinementDiagnostics(model), true, "Recursive graph adapters export exact diagnostics");
	const host = refinementDiagnostics => {
		const projection = generator.compileCopiedWitGraphPackageModel(model.bindingIr, { name, version }, { refinementDiagnostics });
		assert.equal(projection.prefix, p);
		return { projection, source: generator.guardWitHostSource(generator.renderWitGraphHostSource(projection, componentBytes), p, dependencies) };
	};
	const { projection, source } = host(true), off = host(false);
	assert.equal(projection.manifest.graph.refinementDiagnostics, true);
	assert.equal(off.projection.manifest.graph.refinementDiagnostics, undefined);
	// Every native import adapter reads the one-shot text exactly once.
	assert.equal(source.split(`const char *specific = status == 1 ? ${p}_graph_error() : NULL;`).length - 1, projection.layout.roots.length);
	assert.notEqual(off.source, source); assert.doesNotMatch(off.source, new RegExp(`${p}_graph_error`, "u"));
	const graph = generator.nativeGraphProjectionSources(model, component);
	assert.ok(graph[`include/detail/${p}-graph.h`].includes(`const char *${p}_graph_error(void);`));
	const members = { [`wit/${name}.wit`]: projection.wit
		, [`component/${name}.wat`]: projection.wat
		, [`include/${p}_wasmtime.h`]: projection.hostHeader
		, "binding-manifest.json": canonicalJson(projection.manifest)
		, [`src/${p}_wasmtime.c`]: source
		, [`include/${p}-graph.h`]: graph[`include/detail/${p}-graph.h`]
		, [`include/${p}-graph-types.h`]: graph[`include/detail/${p}-graph-types.h`] };
	assert.deepEqual(Object.keys(members), [...sources]);
	return { projection, members, featureOffSha256: sha256(off.source) };
};

/**
 * Regenerate the WIT, component source, graph headers and dependency-guarded diagnostic host.
 * Retain original textual members; the original complete archive retains binaries.
 *
 * @param options - Archive-authenticated installation and compiler inputs.
 * @param options.installed - Installed package directory.
 * @param options.receiptBytes - Original receipt, read before extraction.
 * @param options.pkg - Verified package-set component.
 * @param options.model - Original compiler model.
 * @param options.floor - Explicit glibc floor.
 * @param options.tools - Pre-installation tool identities.
 * @param options.fixture - Recursive or mutual module.
 * @param options.output - Fresh retained record directory.
 */
export const inspectRecursiveCheckedRecordWitPackage = async ({ installed, receiptBytes, pkg, model, floor, tools, fixture, output }) => {
	const closure = await verifyFinContainerEdgeFileClosure({ installed, receiptBytes, receiptPath: recursiveCheckedRecordWitReceipt });
	const receipt = JSON.parse(receiptBytes); assert.equal(receiptBytes, canonicalJson(receipt));
	assertRecursiveCheckedRecordWitIdentity(receipt, pkg, model, floor, fixture);
	const json = async path => JSON.parse(await readFile(join(installed, path)));
	assert.deepEqual(await json("share/lean-bridge/component/model.json"), model);
	const component = await json("share/lean-bridge/component/native-component.json"), adapter = await json("share/lean-bridge/native-c-adapter.json");
	const runtime = await json("share/lean-bridge/runtime.json"), wit = await json("native-wit-adapter.json");
	const generator = recursiveCheckedRecordWitCurrentGenerator;
	const evidence = recursiveCheckedRecordWitNativeEvidence({ receipt, component, adapter, runtime, wit, tools, generator, fixture });
	const componentBytes = await readFile(join(installed, wit.component));
	assert.equal(sha256(componentBytes), receipt.componentSha256);
	const { members } = recursiveCheckedRecordWitMembers({ generator, model, component, componentBytes, dependencies: evidence.dependencies, fixture });
	for(const [path, source] of Object.entries(members)) assert.equal(await readFile(join(installed, path), "utf8"), source, path);
	const files = { ...receipt.files, [recursiveCheckedRecordWitReceipt]: identity(receiptBytes) }, retained = [];
	for(const path of Object.keys(files).sort())
	{
		if(path.endsWith(".so") || path.endsWith(".wasm")) continue;
		const bytes = await readFile(join(installed, path)); assert.deepEqual(identity(bytes), files[path]);
		assert.deepEqual(Buffer.from(bytes.toString("utf8")), bytes, path);
		await saveLakeFile(output, `package/${path}`, bytes); retained.push(path);
	}
	const record = { archive: pkg.artifacts[0], receiptSha256: sha256(receiptBytes), files, retained, evidence, closure };
	await saveLakeFile(output, "package.json", canonicalJson(record));
	assert.deepEqual(await verifyFinContainerEdgeFileClosure({ installed, receiptBytes, receiptPath: recursiveCheckedRecordWitReceipt }), closure);
	return record;
};
