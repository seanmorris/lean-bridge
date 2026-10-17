/**
 * Authenticate installed Rust payloads against the original crate before compilation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateCopiedRustPackage, copiedRustLock } from "../../src/backends/rust/copied-values.mjs";
import { compiledPackageMetadata } from "../../src/analyze/package-metadata.mjs";
import { verifyFinContainerEdgeArchiveClosure } from "./fin-container-edge-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const inheritedCheckedRecordRustReceipt = "lean-bridge/package-receipt.json";

/**
 * Require the selected crate, source identity, runtime and native platform floor.
 *
 * @param receipt - Original archive-derived package receipt.
 * @param pkg - Independently verified package-set entry.
 * @param model - Reproduced compiler model.
 * @param floor - Explicit native glibc floor.
 */
export const assertInheritedCheckedRecordRustIdentity = (receipt, pkg, model, floor) => {
	assert.equal(pkg.target, "cargo"); assert.equal(pkg.ecosystem, "cargo");
	assert.equal(pkg.role, "component"); assert.equal(pkg.profile, "native-library-v1");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.artifacts.length, 1); assert.equal(pkg.name, "inheritedcheckedrecords"); assert.equal(pkg.version, "1.0.0");
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, "lean-bridge-ordinary-cargo-package");
	assert.equal(receipt.ecosystem, "cargo"); assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity); assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.component, model.component); assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
	assert.match(floor, /^2\.[0-9]+$/u); assert.equal(receipt.glibcMinimumVersion, floor);
	assert.match(receipt.compiledProjectionSha256, /^[a-f0-9]{64}$/u);
	assert.ok(pkg.artifacts[0].path.endsWith("/inheritedcheckedrecords-1.0.0.crate"));
};
/**
 * Reconstruct loader identities in producer order, independent of receipt ordering.
 *
 * @param receipt - Original Cargo receipt.
 * @param component - Compiled component receipt.
 * @param adapter - Native C adapter receipt.
 * @param runtime - Shared runtime manifest.
 */
export const inheritedCheckedRecordRustNativeEvidence = (receipt, component, adapter, runtime) => {
	assert.equal(sha256(canonicalJson(runtime)), receipt.runtimeIdentity);
	assert.equal(component.runtimeIdentity, receipt.runtimeIdentity); assert.equal(adapter.runtimeIdentity, receipt.runtimeIdentity);
	assert.equal(component.bindingIrSha256, receipt.bindingIrSha256); assert.equal(adapter.bindingIrSha256, receipt.bindingIrSha256);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	const libraries = { [adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [component.library]: component.nativeLibrary.sha256
		, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256])) };
	const prefix = "native/linux-x64/";
	assert.deepEqual(Object.fromEntries(Object.entries(receipt.files).filter(([path]) => path.startsWith(prefix))
		.map(([path, file]) => [path.slice(prefix.length), file.sha256])), libraries);
	return { runtimeIdentity: receipt.runtimeIdentity
		, componentId: receipt.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, library: adapter.library
		, libraries };
};

/**
 * Regenerate the public sources and retain all original non-binary package inputs.
 *
 * @param options - Verified installed crate and its author model.
 * @param options.installed - Extracted crate root.
 * @param options.archive - Original crate archive.
 * @param options.pkg - Verified package-set entry.
 * @param options.model - Independently reproduced compiler model.
 * @param options.floor - Explicit glibc floor.
 * @param options.output - Fresh retained-record directory.
 */
export const inspectInheritedCheckedRecordRustPackage = async ({ installed, archive, pkg, model, floor, output }) => {
	const verify = () => verifyFinContainerEdgeArchiveClosure({ profile: "rust"
		, installed
		, archive
		, archiveSha256: pkg.artifacts[0].sha256
		, receiptPath: inheritedCheckedRecordRustReceipt });
	const closure = await verify(), receiptBytes = await readFile(join(installed, inheritedCheckedRecordRustReceipt));
	const receipt = JSON.parse(receiptBytes); assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	assertInheritedCheckedRecordRustIdentity(receipt, pkg, model, floor);
	const json = async path => JSON.parse(await readFile(join(installed, "lean-bridge", path)));
	assert.deepEqual(await json("component/model.json"), model);
	const component = await json("component/native-component.json"), adapter = await json("native-c-adapter.json"), runtime = await json("runtime.json");
	const evidence = inheritedCheckedRecordRustNativeEvidence(receipt, component, adapter, runtime), compiled = await json("native-rust.json");
	assert.equal(sha256(canonicalJson(compiled)), receipt.compiledProjectionSha256);
	assert.equal(compiled.schemaVersion, 1); assert.equal(compiled.profile, "native-library-v1");
	assert.equal(compiled.name, pkg.name); assert.equal(compiled.version, pkg.version);
	assert.equal(compiled.bindingIrSha256, model.bindingIrSha256); assert.deepEqual(compiled.evidence, evidence);
	assert.match(compiled.rustc, /^rustc 1\.(?:9\d|[1-9]\d{2,})\.\d+ /u);
	const generated = generateCopiedRustPackage(model.bindingIr, evidence, { name: pkg.name, version: pkg.version, metadata: compiledPackageMetadata(model.sourceIdentity) });
	const expected = { ...generated, "Cargo.lock": await copiedRustLock(pkg.name, pkg.version) };
	assert.deepEqual(Object.keys(compiled.files).sort(), [...Object.keys(expected)
		, "lean-bridge/licenses/LeanBridge-LICENSE"
		, ...Object.keys(evidence.libraries).map(name => `native/linux-x64/${name}`)].sort());
	for(const [path, source] of Object.entries(expected)) assert.equal(await readFile(join(installed, path), "utf8"), source, path);
	for(const [path, file] of Object.entries(compiled.files)) assert.deepEqual(file, receipt.files[path]);
	const files = { ...receipt.files, [inheritedCheckedRecordRustReceipt]: { bytes: receiptBytes.length, sha256: sha256(receiptBytes) } }, retained = [];
	for(const path of Object.keys(files).sort())
	{
		if(path.startsWith("native/linux-x64/")) continue;
		const bytes = await readFile(join(installed, path));
		assert.deepEqual({ bytes: bytes.length, sha256: sha256(bytes) }, files[path]);
		assert.deepEqual(Buffer.from(bytes.toString(), "utf8"), bytes, path);
		await saveLakeFile(output, `package/${path}`, bytes); retained.push(path);
	}
	const record = { archive: pkg.artifacts[0], receiptSha256: sha256(receiptBytes), files, retained, evidence, closure };
	await saveLakeFile(output, "crate.json", canonicalJson(record));
	assert.deepEqual(await verify(), closure);
	return record;
};
