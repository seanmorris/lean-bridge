/**
 * Authenticate dependent checked-record checked-record WIT packages against the reproduced native inputs.
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
import { dependentCheckedRecordWitTarget } from "./dependent-checked-record-wit-fixture.mjs";

const { name, version } = dependentCheckedRecordWitTarget;
export const dependentCheckedRecordWitDirectory = `${name}-${version}-wit-wasi`;
export const dependentCheckedRecordWitReceipt = "lean-bridge-package.json";
export const dependentCheckedRecordWitLibrary = `lib${name}_wasmtime.so`;
export const dependentCheckedRecordWitComponent = `component/${name}.wasm`;
export const dependentCheckedRecordWitPkgConfig = `${name}-wit`;
/** Regenerated textual members, keyed by installed path. */
export const dependentCheckedRecordWitSources = Object.freeze([`wit/${name}.wit`, `component/${name}.wat`, `include/${name}_wasmtime.h`, "binding-manifest.json", `src/${name}_wasmtime.c`]);
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

/**
 * Require exact archive coordinates, source identity, runtime and platform floor.
 *
 * @param receipt - Original archive-derived receipt.
 * @param pkg - Independently verified package-set component.
 * @param model - Reproduced compiler model.
 * @param floor - Explicit glibc floor.
 */
export const assertDependentCheckedRecordWitIdentity = (receipt, pkg, model, floor) => {
	assert.equal(pkg.target, "wit-wasi"); assert.equal(pkg.ecosystem, "wit-wasi");
	assert.equal(pkg.role, "component"); assert.equal(pkg.profile, "native-library-v1");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.name, name); assert.equal(pkg.version, version);
	assert.equal(pkg.artifacts.length, 1);
	assert.ok(pkg.artifacts[0].path.endsWith(`/${dependentCheckedRecordWitDirectory}.tar.gz`));
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
export const dependentCheckedRecordWitNativeEvidence = (receipt, component, adapter, runtime, wit, tools) => {
	assert.equal(sha256(canonicalJson(runtime)), receipt.runtimeIdentity);
	for(const record of [component, adapter, wit])
	{
		assert.equal(record.runtimeIdentity, receipt.runtimeIdentity);
		assert.equal(record.bindingIrSha256, receipt.bindingIrSha256);
	}
	for(const record of [adapter, wit]) assert.equal(record.componentReceiptSha256, sha256(canonicalJson(component)));
	assert.equal(wit.adapterReceiptSha256, sha256(canonicalJson(adapter)));
	assert.equal(wit.profile, "native-wit-v1"); assert.equal(wit.library, dependentCheckedRecordWitLibrary);
	assert.equal(wit.component, dependentCheckedRecordWitComponent);
	assert.equal(wit.glibcMinimumVersion, receipt.glibcMinimumVersion);
	assert.deepEqual(wit.settings, { name, version });
	const { root: ignoredRoot, ...wasmtime } = tools.wasmtime; assert.ok(ignoredRoot);
	assert.deepEqual(wit.wasmtime, wasmtime);
	const dependencies = witHostDependencies({ receipt: component, adapter, runtime }, tools.wasmtime.files);
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
 * Render every textual member from the frozen model with the given generator closure.
 *
 * @param generator - Current or historical WIT generator functions.
 * @param model - Original compiler model.
 * @param componentBytes - Actual component bytes.
 * @param dependencies - Reconstructed host dependencies.
 */
export const dependentCheckedRecordWitMembers = (generator, model, componentBytes, dependencies) => {
	const projection = generator.compileCopiedWitModel(model.bindingIr, { name, version }, { callables: true });
	const members = { [`wit/${name}.wit`]: projection.wit
		, [`component/${name}.wat`]: projection.wat
		, [`include/${name}_wasmtime.h`]: generator.renderWitHostHeader(projection)
		, "binding-manifest.json": canonicalJson(projection.manifest)
		, [`src/${name}_wasmtime.c`]: generator.guardWitHostSource(generator.renderWitHostSource(projection, componentBytes), projection.surface.prefix, dependencies) };
	assert.deepEqual(Object.keys(members), [...dependentCheckedRecordWitSources]);
	return { projection, members };
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
export const inspectDependentCheckedRecordWitPackage = async ({ installed, receiptBytes, pkg, model, floor, tools, output }) => {
	const closure = await verifyFinContainerEdgeFileClosure({ installed, receiptBytes, receiptPath: dependentCheckedRecordWitReceipt });
	const receipt = JSON.parse(receiptBytes); assert.equal(receiptBytes, canonicalJson(receipt));
	assertDependentCheckedRecordWitIdentity(receipt, pkg, model, floor); assert.equal(model.copiedGraph, undefined);
	const json = async path => JSON.parse(await readFile(join(installed, path)));
	assert.deepEqual(await json("share/lean-bridge/component/model.json"), model);
	const component = await json("share/lean-bridge/component/native-component.json"), adapter = await json("share/lean-bridge/native-c-adapter.json");
	const runtime = await json("share/lean-bridge/runtime.json"), wit = await json("native-wit-adapter.json");
	const evidence = dependentCheckedRecordWitNativeEvidence(receipt, component, adapter, runtime, wit, tools);
	const componentBytes = await readFile(join(installed, wit.component));
	assert.equal(sha256(componentBytes), receipt.componentSha256);
	const { members } = dependentCheckedRecordWitMembers({ compileCopiedWitModel, renderWitHostHeader, renderWitHostSource, guardWitHostSource }, model, componentBytes, evidence.dependencies);
	for(const [path, source] of Object.entries(members)) assert.equal(await readFile(join(installed, path), "utf8"), source, path);
	const files = { ...receipt.files, [dependentCheckedRecordWitReceipt]: identity(receiptBytes) }, retained = [];
	for(const path of Object.keys(files).sort())
	{
		if(path.endsWith(".so") || path.endsWith(".wasm")) continue;
		const bytes = await readFile(join(installed, path)); assert.deepEqual(identity(bytes), files[path]);
		assert.deepEqual(Buffer.from(bytes.toString("utf8")), bytes, path);
		await saveLakeFile(output, `package/${path}`, bytes); retained.push(path);
	}
	const record = { archive: pkg.artifacts[0], receiptSha256: sha256(receiptBytes), files, retained, evidence, closure };
	await saveLakeFile(output, "package.json", canonicalJson(record));
	assert.deepEqual(await verifyFinContainerEdgeFileClosure({ installed, receiptBytes, receiptPath: dependentCheckedRecordWitReceipt }), closure);
	return record;
};
