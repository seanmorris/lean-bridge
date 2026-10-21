/**
 * Authenticate an actual zero-payload Python wheel and regenerate its public
 * sources from the compiler-owned Binding IR.
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
import {
	zeroPayloadPythonPackage, zeroPayloadPythonTarget
} from "./zero-payload-checked-record-python-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { zeroPayloadPythonReceipt } from "./zero-payload-checked-record-python-install.mjs";

/**
 * Reconstruct native-package evidence in generator order rather than trusting
 * wheel member ordering.
 *
 * @param receipt - Wheel-local package receipt.
 * @param component - Compiler-owned component receipt.
 * @param adapter - Native C adapter receipt.
 * @param runtime - Shared runtime manifest.
 */
export const zeroPayloadPythonNativeEvidence = (receipt, component, adapter, runtime) => {
	assert.equal(sha256(canonicalJson(runtime)), receipt.runtimeIdentity);
	assert.equal(component.runtimeIdentity, receipt.runtimeIdentity);
	assert.equal(adapter.runtimeIdentity, receipt.runtimeIdentity);
	assert.equal(component.bindingIrSha256, receipt.bindingIrSha256);
	assert.equal(adapter.bindingIrSha256, receipt.bindingIrSha256);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	const libraries = {
		[adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [component.library]: component.nativeLibrary.sha256
		, ...Object.fromEntries(Object.entries(runtime.files)
			.filter(([path]) => path.startsWith("lib/"))
			.map(([path, file]) => [path.slice(4), file.sha256]))
	};
	const actual = Object.fromEntries(Object.entries(receipt.files)
		.filter(([path]) => path.startsWith(`${zeroPayloadPythonPackage}/native/linux-x64/`))
		.map(([path, file]) => [path.split("/").at(-1), file.sha256]));
	assert.deepEqual(actual, libraries);
	return {
		runtimeIdentity: receipt.runtimeIdentity, componentId: receipt.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, library: adapter.library, libraries
	};
};

/**
 * Require exact Python coordinates and every compiler identity before reading
 * generated public source.
 *
 * @param receipt - Wheel-local package receipt.
 * @param pkg - Verified component package-set entry.
 * @param model - Author-build compiler model.
 * @param floor - Declared native glibc floor.
 */
export const assertZeroPayloadPythonIdentity = (receipt, pkg, model, floor) => {
	assert.equal(pkg.target, "pypi"); assert.equal(pkg.ecosystem, "pypi");
	assert.equal(pkg.role, "component"); assert.equal(pkg.profile, "native-library-v1");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.artifacts.length, 1);
	assert.equal(pkg.name, zeroPayloadPythonTarget.name);
	assert.equal(pkg.version, zeroPayloadPythonTarget.version);
	assert.equal(receipt.schemaVersion, 1);
	assert.equal(receipt.kind, "lean-bridge-ordinary-python-package");
	assert.equal(receipt.ecosystem, "pypi");
	assert.equal(receipt.moduleName, zeroPayloadPythonPackage);
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.component, model.component);
	assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
	assert.match(floor, /^2\.[0-9]+$/u);
	assert.equal(receipt.glibcMinimumVersion, floor);
	assert.equal(receipt.tag, `py3-none-manylinux_${floor.replace(".", "_")}_x86_64`);
	assert.ok(pkg.artifacts[0].path.endsWith(`/${pkg.name}-${pkg.version}-${receipt.tag}.whl`));
};

/**
 * Verify every wheel byte, regenerate its public sources and retain text
 * evidence outside the disposable install root.
 *
 * @param options - Fresh extraction directory and authenticated build inputs.
 * @param options.root - Fresh wheel extraction directory.
 * @param options.archive - Original wheel path.
 * @param options.pkg - Verified package-set component entry.
 * @param options.model - Compiler model from the author build.
 * @param options.floor - Declared native glibc floor.
 * @param options.output - Retained text-record destination.
 */
export const inspectZeroPayloadPythonWheel = async ({
	root, archive, pkg, model, floor, output
}) => {
	const bytes = await readFile(archive), artifact = pkg.artifacts[0];
	assert.equal(bytes.length, artifact.bytes); assert.equal(sha256(bytes), artifact.sha256);
	await assert.rejects(access(root), { code: "ENOENT" }); await mkdir(root, { recursive: true });
	const listed = await runCopied("/usr/bin/unzip", ["-Z1", archive], root);
	assert.equal(listed.stderr, "");
	const members = listed.stdout.trimEnd().split("\n");
	assert.equal(new Set(members).size, members.length);
	for(const path of members)
		assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path)
			&& path.split("/").every(part => part && part !== "." && part !== ".."), path);
	await runCopied("/usr/bin/unzip", ["-q", archive], root);
	const receiptBytes = await readFile(join(root, zeroPayloadPythonReceipt));
	const receipt = JSON.parse(receiptBytes);
	assertZeroPayloadPythonIdentity(receipt, pkg, model, floor);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	await verifyNativeFiles(root, receipt.files);
	const recordPath = `${pkg.name}-${pkg.version}.dist-info/RECORD`;
	const paths = [...Object.keys(receipt.files), zeroPayloadPythonReceipt, recordPath].sort();
	assert.deepEqual(await nativeArtifactPaths(root), paths);
	assert.deepEqual(members.sort(), paths);
	const json = async path => JSON.parse(await readFile(join(root
		, `${zeroPayloadPythonPackage}/lean_bridge/${path}`)));
	assert.deepEqual(await json("component/model.json"), model);
	const component = await json("component/native-component.json");
	const adapter = await json("native-c-adapter.json"), runtime = await json("runtime.json");
	const evidence = zeroPayloadPythonNativeEvidence(receipt, component, adapter, runtime);
	const generated = generateCopiedPythonPackage(model.bindingIr, evidence);
	for(const [path, source] of Object.entries(generated))
	{
		const wheelPath = path.startsWith(`${zeroPayloadPythonPackage}/`)
			? path : `${zeroPayloadPythonPackage}/lean_bridge/${path}`;
		assert.equal(await readFile(join(root, wheelPath), "utf8"), source);
	}
	const metadata = await readFile(join(root, `${pkg.name}-${pkg.version}.dist-info/METADATA`), "utf8");
	assert.match(metadata, /^Requires-Python: >=3\.11$/mu);
	assert.doesNotMatch(metadata, /^Requires-Dist:/mu);
	const files = {}, retained = [];
	for(const path of paths)
	{
		const value = await readFile(join(root, path));
		files[path] = { bytes: value.length, sha256: sha256(value) };
		if(path.startsWith(`${zeroPayloadPythonPackage}/native/linux-x64/`)) continue;
		assert.equal(Buffer.from(value.toString("utf8"), "utf8").compare(value), 0
			, `Retained text must be UTF-8: ${path}`);
		await saveLakeFile(output, `package/${path}`, value); retained.push(path);
	}
	const lines = paths.filter(path => path !== recordPath).map(path =>
		`${path},sha256=${Buffer.from(files[path].sha256, "hex").toString("base64url")},${files[path].bytes}`);
	assert.equal(await readFile(join(root, recordPath), "utf8"), [...lines, `${recordPath},,`, ""].join("\n"));
	const record = { archive: artifact, receiptSha256: sha256(receiptBytes), files, retained, evidence };
	await saveLakeFile(output, "wheel.json", canonicalJson(record));
	return { record, receiptBytes };
};
