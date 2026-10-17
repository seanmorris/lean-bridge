/**
 * Authenticate installed recursive checked-record native PHP payloads against the original ZIP.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { compileCopiedPhpGraphPackageModel, generateCopiedPhpGraphPackage } from "../../src/backends/php/copied-graph-package.mjs";
import { verifyFinContainerEdgePhpEnvironment } from "./fin-container-edge-php-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { recursiveCheckedRecordPhpPackage } from "./recursive-checked-record-php-fixture.mjs";

export const recursiveCheckedRecordPhpReceipt = "lean-bridge/package-receipt.json";
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

/**
 * Require the canonical non-callable copied-graph descriptor shape.
 *
 * @param model - Reproduced compiler model.
 */
export const assertRecursiveCheckedRecordPhpGraphIdentity = model => {
	assert.ok(model.copiedGraph && typeof model.copiedGraph === "object");
	assert.equal(model.copiedGraph.callbacks, undefined);
};

/**
 * Require exact Composer coordinates, source identity and selected platform floor.
 *
 * @param receipt - Original archive-derived package receipt.
 * @param pkg - Independently verified package-set component.
 * @param model - Reproduced compiler model.
 * @param floor - Explicit glibc floor.
 * @param fixture - Selected module.
 */
export const assertRecursiveCheckedRecordPhpIdentity = (receipt, pkg, model, floor, fixture) => {
	const { name, version, namespace } = recursiveCheckedRecordPhpPackage(fixture);
	assert.equal(pkg.target, "php-native"); assert.equal(pkg.ecosystem, "composer");
	assert.equal(pkg.role, "component"); assert.equal(pkg.profile, "native-library-v1");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.artifacts.length, 1);
	assert.equal(pkg.name, name); assert.equal(pkg.version, version);
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, "lean-bridge-ordinary-php-package");
	assert.equal(receipt.ecosystem, "composer"); assert.equal(receipt.namespace, namespace);
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.component, model.component); assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
	assert.match(floor, /^2\.[0-9]+$/u); assert.equal(receipt.glibcMinimumVersion, floor);
	assert.ok(pkg.artifacts[0].path.endsWith(`/${name.replace("/", "-")}-${version}-linux-x86_64.zip`));
};

/**
 * Reconstruct native loader identities from the producer's separate receipts.
 *
 * @param receipt - Original PHP package receipt.
 * @param component - Native component receipt.
 * @param adapter - Native C adapter receipt.
 * @param runtime - Shared runtime manifest.
 * @param bindingIr - Compiler model contract, which fixes the copied-graph layout.
 */
export const recursiveCheckedRecordPhpNativeEvidence = (receipt, component, adapter, runtime, bindingIr) => {
	// Graph packages bind their loader identity to the independently derived layout.
	const copiedGraph = { schemaVersion: 1, layoutSha256: compileCopiedPhpGraphPackageModel(bindingIr).layoutSha256 };
	assert.deepEqual(adapter.copiedGraph, copiedGraph);
	assert.equal(sha256(canonicalJson(runtime)), receipt.runtimeIdentity);
	assert.equal(component.runtimeIdentity, receipt.runtimeIdentity); assert.equal(adapter.runtimeIdentity, receipt.runtimeIdentity);
	assert.equal(component.bindingIrSha256, receipt.bindingIrSha256); assert.equal(adapter.bindingIrSha256, receipt.bindingIrSha256);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	const libraries = { [adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [component.library]: component.nativeLibrary.sha256
		, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256])) };
	assert.deepEqual(Object.fromEntries(Object.entries(receipt.files).filter(([path]) => path.startsWith("native/linux-x64/"))
		.map(([path, file]) => [path.slice("native/linux-x64/".length), file.sha256])), libraries);
	return { runtimeIdentity: receipt.runtimeIdentity
		, componentId: receipt.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, copiedGraph, library: adapter.library, libraries };
};

/**
 * Retain text members and independently regenerate every public/private PHP source.
 *
 * @param options - Authenticated installation and compiler inputs.
 * @param options.context - Archive-derived installation context.
 * @param options.pkg - Verified package-set component.
 * @param options.model - Reproduced compiler model.
 * @param options.floor - Explicit glibc floor.
 * @param options.tools - Pre-installation tool identities and flags.
 * @param options.output - Fresh retained-record directory.
 * @param options.fixture - Selected module.
 */
export const inspectRecursiveCheckedRecordPhpPackage = async ({ context, pkg, model, floor, tools, output, fixture }) => {
	const { name } = recursiveCheckedRecordPhpPackage(fixture);
	const closure = await verifyFinContainerEdgePhpEnvironment(context);
	assert.equal(context.name, name);
	assert.equal(context.command, tools.command); assert.equal(context.composer, tools.composer);
	assert.deepEqual(context.tools, tools.tools); assert.deepEqual(context.runtimeFlags, tools.runtimeFlags);
	const root = join(context.root, "vendor", context.name), receipt = JSON.parse(context.receiptBytes);
	assert.equal(context.receiptBytes, canonicalJson(receipt));
	assertRecursiveCheckedRecordPhpIdentity(receipt, pkg, model, floor, fixture);
	const json = async path => JSON.parse(await readFile(join(root, "lean-bridge", path)));
	assert.deepEqual(await json("component/model.json"), model);
	assertRecursiveCheckedRecordPhpGraphIdentity(model);
	const component = await json("component/native-component.json"), adapter = await json("native-c-adapter.json"), runtime = await json("runtime.json");
	const evidence = recursiveCheckedRecordPhpNativeEvidence(receipt, component, adapter, runtime, model.bindingIr);
	// Every selected export has parameter refinements, so exact diagnostics are mandatory.
	const generated = generateCopiedPhpGraphPackage(model.bindingIr, evidence, { refinementDiagnostics: true });
	const { prefix } = compileCopiedPhpGraphPackageModel(model.bindingIr);
	assert.equal(generated["src/Internal/Native.php"].split(`const char *${prefix}_graph_error(void);\n`).length, 2);
	assert.equal(JSON.parse(generated["binding-manifest.json"]).refinementDiagnostics, true);
	for(const [path, source] of Object.entries(generated))
		assert.equal(await readFile(join(root, path), "utf8"), source, path);
	const files = { ...receipt.files, [recursiveCheckedRecordPhpReceipt]: identity(context.receiptBytes) }, retained = [];
	for(const path of Object.keys(files).sort())
	{
		if(path.startsWith("native/linux-x64/")) continue;
		const bytes = await readFile(join(root, path)); assert.deepEqual(identity(bytes), files[path]);
		assert.deepEqual(Buffer.from(bytes.toString("utf8")), bytes, path);
		await saveLakeFile(output, `package/${path}`, bytes); retained.push(path);
	}
	for(const [path, expected] of Object.entries({ ...context.inputs, ...context.generatedFiles }))
	{
		const bytes = await readFile(join(context.root, path)); assert.deepEqual(identity(bytes), expected);
		await saveLakeFile(output, `installation/${path}`, bytes);
	}
	const record = { archive: pkg.artifacts[0], receiptSha256: sha256(context.receiptBytes), files, retained, evidence, closure };
	await saveLakeFile(output, "package.json", canonicalJson(record));
	assert.deepEqual(await verifyFinContainerEdgePhpEnvironment(context), closure);
	return record;
};
