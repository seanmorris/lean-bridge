/**
 * Inspect the actual Python wheel and retain its receipt-controlled text inputs.
 * Native libraries are verified in place; their bytes remain in the original handoff.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { generateCopiedPythonPackage } from "../../src/backends/python/copied-values.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { nominalPrimitiveSubtypePythonPackage } from "./nominal-primitive-subtype-python-fixture.mjs";

export const nominalPrimitiveSubtypePythonReceipt = `${nominalPrimitiveSubtypePythonPackage}/lean_bridge/package-receipt.json`;

/**
 * Reconstruct generator evidence in producer order, independently of receipt key order.
 *
 * @param receipt - Original wheel receipt.
 * @param component - Compiler-owned native component receipt.
 * @param adapter - Native C adapter receipt.
 * @param runtime - Shared runtime manifest.
 */
export const nominalPrimitiveSubtypePythonNativeEvidence = (receipt, component, adapter, runtime) => {
	assert.equal(sha256(canonicalJson(runtime)), receipt.runtimeIdentity);
	assert.equal(component.runtimeIdentity, receipt.runtimeIdentity); assert.equal(adapter.runtimeIdentity, receipt.runtimeIdentity);
	assert.equal(component.bindingIrSha256, receipt.bindingIrSha256); assert.equal(adapter.bindingIrSha256, receipt.bindingIrSha256);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	const libraries = { [adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [component.library]: component.nativeLibrary.sha256
		, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256])) };
	const actual = Object.fromEntries(Object.entries(receipt.files)
		.filter(([path]) => path.startsWith(`${nominalPrimitiveSubtypePythonPackage}/native/linux-x64/`))
		.map(([path, file]) => [path.split("/").at(-1), file.sha256]));
	assert.deepEqual(actual, libraries);
	return { runtimeIdentity: receipt.runtimeIdentity
		, componentId: receipt.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, library: adapter.library, libraries };
};

/**
 * Require exact package coordinates, source authority and native identities.
 *
 * @param receipt - Original wheel receipt.
 * @param pkg - Independently verified package-set entry.
 * @param model - Author-build compiler model.
 * @param floor - Explicit selected glibc floor.
 */
export const assertNominalPrimitiveSubtypePythonIdentity = (receipt, pkg, model, floor) => {
	assert.equal(pkg.target, "pypi"); assert.equal(pkg.ecosystem, "pypi");
	assert.equal(pkg.role, "component"); assert.equal(pkg.profile, "native-library-v1");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.artifacts.length, 1); assert.equal(pkg.name, "nominalprimitivesubtypes"); assert.equal(pkg.version, "1.0.0");
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, "lean-bridge-ordinary-python-package");
	assert.equal(receipt.ecosystem, "pypi"); assert.equal(receipt.moduleName, nominalPrimitiveSubtypePythonPackage);
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.component, model.component); assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
	assert.match(floor, /^2\.[0-9]+$/u); assert.equal(receipt.glibcMinimumVersion, floor);
	assert.equal(receipt.tag, `py3-none-manylinux_${floor.replace(".", "_")}_x86_64`);
	assert.ok(pkg.artifacts[0].path.endsWith(`/nominalprimitivesubtypes-1.0.0-${receipt.tag}.whl`));
};

/**
 * Verify the complete archive, regenerate its API, and save original text records.
 *
 * @param options - Exclusively owned inspection directory and verified selection.
 * @param options.root - Fresh extraction directory.
 * @param options.archive - Original wheel in the source-free handoff.
 * @param options.pkg - Verified package-set component entry.
 * @param options.model - Reproduced author model.
 * @param options.floor - Declared native glibc floor.
 * @param options.output - Original-record destination.
 */
export const inspectNominalPrimitiveSubtypePythonWheel = async ({ root, archive, pkg, model, floor, output }) => {
	const bytes = await readFile(archive), artifact = pkg.artifacts[0];
	assert.equal(bytes.length, artifact.bytes); assert.equal(sha256(bytes), artifact.sha256);
	await assert.rejects(access(root), { code: "ENOENT" }); await mkdir(root, { recursive: true });
	const listed = await runCopied("/usr/bin/unzip", ["-Z1", archive], root);
	assert.equal(listed.stderr, "");
	const members = listed.stdout.trimEnd().split("\n");
	assert.equal(new Set(members).size, members.length);
	for(const path of members)
		assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path) && path.split("/").every(part => part && part !== "." && part !== ".."), path);
	await runCopied("/usr/bin/unzip", ["-q", archive], root);
	const receiptBytes = await readFile(join(root, nominalPrimitiveSubtypePythonReceipt)), receipt = JSON.parse(receiptBytes);
	assertNominalPrimitiveSubtypePythonIdentity(receipt, pkg, model, floor);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	await verifyNativeFiles(root, receipt.files);
	const recordPath = "nominalprimitivesubtypes-1.0.0.dist-info/RECORD";
	const paths = [...Object.keys(receipt.files), nominalPrimitiveSubtypePythonReceipt, recordPath].sort();
	assert.deepEqual(await nativeArtifactPaths(root), paths); assert.deepEqual(members.sort(), paths);
	const json = async path => JSON.parse(await readFile(join(root, `${nominalPrimitiveSubtypePythonPackage}/lean_bridge/${path}`)));
	assert.deepEqual(await json("component/model.json"), model);
	const component = await json("component/native-component.json"), adapter = await json("native-c-adapter.json"), runtime = await json("runtime.json");
	const evidence = nominalPrimitiveSubtypePythonNativeEvidence(receipt, component, adapter, runtime);
	const generated = generateCopiedPythonPackage(model.bindingIr, evidence);
	for(const [path, source] of Object.entries(generated))
		assert.equal(await readFile(join(root, path.startsWith(`${nominalPrimitiveSubtypePythonPackage}/`) ? path : `${nominalPrimitiveSubtypePythonPackage}/lean_bridge/${path}`), "utf8"), source);
	const metadata = await readFile(join(root, "nominalprimitivesubtypes-1.0.0.dist-info/METADATA"), "utf8");
	assert.match(metadata, /^Requires-Python: >=3\.11$/mu); assert.doesNotMatch(metadata, /^Requires-Dist:/mu);
	const files = {}, retained = [];
	for(const path of paths)
	{
		const value = await readFile(join(root, path)); files[path] = { bytes: value.length, sha256: sha256(value) };
		if(path.startsWith(`${nominalPrimitiveSubtypePythonPackage}/native/linux-x64/`)) continue;
		assert.equal(Buffer.from(value.toString("utf8"), "utf8").compare(value), 0, `Retained text must be UTF-8: ${path}`);
		await saveLakeFile(output, `package/${path}`, value); retained.push(path);
	}
	const lines = paths.filter(path => path !== recordPath).map(path => `${path},sha256=${Buffer.from(files[path].sha256, "hex").toString("base64url")},${files[path].bytes}`);
	assert.equal(await readFile(join(root, recordPath), "utf8"), [...lines, `${recordPath},,`, ""].join("\n"));
	const record = { archive: artifact, receiptSha256: sha256(receiptBytes), files, retained, evidence };
	await saveLakeFile(output, "wheel.json", canonicalJson(record));
	return { record, receiptBytes };
};
