/**
 * Authenticate nominal WIT packages against the reproduced native inputs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { compileCopiedWitModel } from "../../src/backends/wit/copied-model.mjs";
import { renderWitHostHeader, renderWitHostSource } from "../../src/backends/wit/copied-host.mjs";
import { guardWitHostSource, witHostDependencies } from "../../src/backends/wit/host-evidence.mjs";
import { wasmtimeCapiIdentity } from "../../src/build/native-wit-artifacts.mjs";
import { verifyFinContainerEdgeFileClosure } from "./fin-container-edge-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const nominalSubtypeWitDirectory = "nominalsubtypes-1.0.0-wit-wasi";
export const nominalSubtypeWitReceipt = "lean-bridge-package.json";
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

/**
 * Require exact archive coordinates, source identity, runtime and platform floor.
 *
 * @param receipt - Original archive-derived receipt.
 * @param pkg - Independently verified package-set component.
 * @param model - Reproduced compiler model.
 * @param floor - Explicit glibc floor.
 */
export const assertNominalSubtypeWitIdentity = (receipt, pkg, model, floor) => {
	assert.equal(pkg.target, "wit-wasi"); assert.equal(pkg.ecosystem, "wit-wasi");
	assert.equal(pkg.role, "component"); assert.equal(pkg.profile, "native-library-v1");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.name, "nominalsubtypes"); assert.equal(pkg.version, "1.0.0");
	assert.equal(pkg.artifacts.length, 1);
	assert.ok(pkg.artifacts[0].path.endsWith(`/${nominalSubtypeWitDirectory}.tar.gz`));
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, "lean-bridge-ordinary-wit-package");
	assert.equal(receipt.ecosystem, "wit-wasi"); assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity); assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.component, model.component); assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
	assert.match(floor, /^2\.[0-9]+$/u); assert.equal(receipt.glibcMinimumVersion, floor);
	assert.equal(receipt.wasmtime, wasmtimeCapiIdentity.version);
	assert.match(receipt.componentSha256, /^[a-f0-9]{64}$/u);
};

/**
 * Reconstruct host dependencies without accepting identities from generated source.
 *
 * @param receipt - Original package receipt.
 * @param component - Native component receipt.
 * @param adapter - Native C adapter receipt.
 * @param runtime - Shared native runtime manifest.
 * @param wit - WIT adapter receipt.
 * @param tools - Independently inspected Wasmtime C API.
 */
export const nominalSubtypeWitNativeEvidence = (receipt, component, adapter, runtime, wit, tools) => {
	assert.equal(sha256(canonicalJson(runtime)), receipt.runtimeIdentity);
	for(const record of [component, adapter, wit])
	{
		assert.equal(record.runtimeIdentity, receipt.runtimeIdentity);
		assert.equal(record.bindingIrSha256, receipt.bindingIrSha256);
	}
	for(const record of [adapter, wit]) assert.equal(record.componentReceiptSha256, sha256(canonicalJson(component)));
	assert.equal(wit.adapterReceiptSha256, sha256(canonicalJson(adapter)));
	assert.equal(wit.profile, "native-wit-v1"); assert.equal(wit.library, "libnominalsubtypes_wasmtime.so");
	assert.equal(wit.component, "component/nominalsubtypes.wasm");
	assert.equal(wit.glibcMinimumVersion, receipt.glibcMinimumVersion);
	assert.deepEqual(wit.settings, { name: "nominalsubtypes", version: "1.0.0" });
	const { root: ignoredRoot, ...wasmtime } = tools.wasmtime; assert.ok(ignoredRoot);
	assert.deepEqual(wit.wasmtime, wasmtime);
	const dependencies = witHostDependencies({ receipt: component, adapter, runtime }, tools.wasmtime.files);
	const libraries = Object.fromEntries(dependencies.map(({ name, ...file }) => [`lib/${name}`, file]));
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
 * Regenerate the WIT, embedded component source and dependency-guarded public host.
 * Retain original textual members; the original complete archive retains binaries.
 *
 * @param options - Archive-authenticated installation and compiler inputs.
 * @param options.installed - Installed package directory.
 * @param options.receiptBytes - Original receipt, read before extraction.
 * @param options.pkg - Verified package-set component.
 * @param options.model - Original compiler model.
 * @param options.floor - Explicit glibc floor.
 * @param options.tools - Pre-installation tool identities.
 * @param options.output - Fresh retained record directory.
 */
export const inspectNominalSubtypeWitPackage = async ({ installed, receiptBytes, pkg, model, floor, tools, output }) => {
	const closure = await verifyFinContainerEdgeFileClosure({ installed, receiptBytes, receiptPath: nominalSubtypeWitReceipt });
	const receipt = JSON.parse(receiptBytes); assert.equal(receiptBytes, canonicalJson(receipt));
	assertNominalSubtypeWitIdentity(receipt, pkg, model, floor); assert.equal(model.copiedGraph, undefined);
	const json = async path => JSON.parse(await readFile(join(installed, path)));
	assert.deepEqual(await json("share/lean-bridge/component/model.json"), model);
	const component = await json("share/lean-bridge/component/native-component.json"), adapter = await json("share/lean-bridge/native-c-adapter.json");
	const runtime = await json("share/lean-bridge/runtime.json"), wit = await json("native-wit-adapter.json");
	const evidence = nominalSubtypeWitNativeEvidence(receipt, component, adapter, runtime, wit, tools);
	const projection = compileCopiedWitModel(model.bindingIr, { name: pkg.name, version: pkg.version }, { callables: true });
	const componentBytes = await readFile(join(installed, wit.component));
	assert.equal(sha256(componentBytes), receipt.componentSha256);
	for(const [path, source] of Object.entries({ "wit/nominalsubtypes.wit": projection.wit
		, "component/nominalsubtypes.wat": projection.wat
		, "include/nominalsubtypes_wasmtime.h": renderWitHostHeader(projection)
		, "binding-manifest.json": canonicalJson(projection.manifest)
		, "src/nominalsubtypes_wasmtime.c": guardWitHostSource(renderWitHostSource(projection, componentBytes), projection.surface.prefix, evidence.dependencies) }))
		assert.equal(await readFile(join(installed, path), "utf8"), source, path);
	const files = { ...receipt.files, [nominalSubtypeWitReceipt]: identity(receiptBytes) }, retained = [];
	for(const path of Object.keys(files).sort())
	{
		if(path.endsWith(".so") || path.endsWith(".wasm")) continue;
		const bytes = await readFile(join(installed, path)); assert.deepEqual(identity(bytes), files[path]);
		assert.deepEqual(Buffer.from(bytes.toString("utf8")), bytes, path);
		await saveLakeFile(output, `package/${path}`, bytes); retained.push(path);
	}
	const record = { archive: pkg.artifacts[0], receiptSha256: sha256(receiptBytes), files, retained, evidence, closure };
	await saveLakeFile(output, "package.json", canonicalJson(record));
	assert.deepEqual(await verifyFinContainerEdgeFileClosure({ installed, receiptBytes, receiptPath: nominalSubtypeWitReceipt }), closure);
	return record;
};
