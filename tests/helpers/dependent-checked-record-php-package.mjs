/**
 * Authenticate dependent checked-record checked-record native PHP packages against the
 * original Composer archive, rather than treating a successful PHP process as
 * package evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateCopiedPhpPackage } from "../../src/backends/php/copied-values.mjs";
import { verifyFinContainerEdgePhpEnvironment } from "./fin-container-edge-php-closure.mjs";
import {
	dependentCheckedRecordPhpNamespace, dependentCheckedRecordPhpTarget
} from "./dependent-checked-record-php-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const dependentCheckedRecordPhpReceipt = "lean-bridge/package-receipt.json";
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });

/**
 * Verify package-set coordinates and compiler identities before reading PHP.
 *
 * @param receipt - Archive-local Composer receipt.
 * @param pkg - Verified package-set component entry.
 * @param model - Reproduced compiler model.
 * @param floor - Explicit selected glibc floor.
 */
export const assertDependentCheckedRecordPhpIdentity = (receipt, pkg, model, floor) => {
	assert.equal(pkg.target, "php-native"); assert.equal(pkg.ecosystem, "composer");
	assert.equal(pkg.role, "component"); assert.equal(pkg.profile, "native-library-v1");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.artifacts.length, 1);
	assert.equal(pkg.name, dependentCheckedRecordPhpTarget.name);
	assert.equal(pkg.version, dependentCheckedRecordPhpTarget.version);
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, "lean-bridge-ordinary-php-package");
	assert.equal(receipt.ecosystem, "composer"); assert.equal(receipt.namespace, dependentCheckedRecordPhpNamespace);
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.component, model.component);
	assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
	assert.match(floor, /^2\.[0-9]+$/u); assert.equal(receipt.glibcMinimumVersion, floor);
	assert.ok(pkg.artifacts[0].path.endsWith(
		`/${pkg.name.replace("/", "-")}-${pkg.version}-linux-x86_64.zip`));
};

/**
 * Reconstruct loader evidence in generator order, never from generated PHP.
 *
 * @param receipt - Archive-local Composer receipt.
 * @param component - Compiler-owned native component receipt.
 * @param adapter - Compiler-owned native C adapter receipt.
 * @param runtime - Compiler-owned shared runtime manifest.
 */
export const dependentCheckedRecordPhpNativeEvidence = (receipt, component, adapter, runtime) => {
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
		.filter(([path]) => path.startsWith("native/linux-x64/"))
		.map(([path, file]) => [path.slice("native/linux-x64/".length), file.sha256]));
	assert.deepEqual(actual, libraries);
	return {
		runtimeIdentity: receipt.runtimeIdentity
		, componentId: receipt.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, library: adapter.library, libraries };
};

/**
 * Authenticate all original text members, regenerate public PHP from the
 * compiler model, and retain enough evidence to recheck it after CI expires.
 *
 * @param root0 - Authenticated package inspection inputs.
 * @param root0.context - Archive-derived offline Composer installation.
 * @param root0.pkg - Verified package-set component entry.
 * @param root0.model - Reproduced compiler model.
 * @param root0.floor - Explicit selected glibc floor.
 * @param root0.tools - Authenticated PHP and Composer tool identities.
 * @param root0.output - Retained record directory.
 */
export const inspectDependentCheckedRecordPhpPackage = async ({
	context, pkg, model, floor, tools, output
}) => {
	const closure = await verifyFinContainerEdgePhpEnvironment(context);
	assert.equal(context.name, dependentCheckedRecordPhpTarget.name);
	assert.equal(context.command, tools.command); assert.equal(context.composer, tools.composer);
	assert.deepEqual(context.tools, tools.tools); assert.deepEqual(context.runtimeFlags, tools.runtimeFlags);
	const root = join(context.root, "vendor", context.name), receipt = JSON.parse(context.receiptBytes);
	assert.equal(context.receiptBytes, canonicalJson(receipt));
	assertDependentCheckedRecordPhpIdentity(receipt, pkg, model, floor);
	const json = async path => JSON.parse(await readFile(join(root, "lean-bridge", path)));
	assert.deepEqual(await json("component/model.json"), model);
	const component = await json("component/native-component.json");
	const adapter = await json("native-c-adapter.json"), runtime = await json("runtime.json");
	const evidence = dependentCheckedRecordPhpNativeEvidence(receipt, component, adapter, runtime);
	for(const [path, source] of Object.entries(generateCopiedPhpPackage(model.bindingIr, evidence)))
		assert.equal(await readFile(join(root, path), "utf8"), source, path);
	const files = { ...receipt.files, [dependentCheckedRecordPhpReceipt]: identity(context.receiptBytes) };
	const retained = [];
	for(const path of Object.keys(files).sort())
	{
		if(path.startsWith("native/linux-x64/")) continue;
		const bytes = await readFile(join(root, path));
		assert.deepEqual(identity(bytes), files[path], `PHP archive member drift: ${path}`);
		assert.deepEqual(Buffer.from(bytes.toString("utf8")), bytes, path);
		await saveLakeFile(output, `package/${path}`, bytes); retained.push(path);
	}
	for(const [path, expected] of Object.entries({ ...context.inputs, ...context.generatedFiles }))
	{
		const bytes = await readFile(join(context.root, path));
		assert.deepEqual(identity(bytes), expected, `PHP install input drift: ${path}`);
		await saveLakeFile(output, `installation/${path}`, bytes);
	}
	const record = {
		archive: pkg.artifacts[0]
		, receiptSha256: sha256(context.receiptBytes)
		, files, retained, evidence, closure };
	await saveLakeFile(output, "package.json", canonicalJson(record));
	assert.deepEqual(await verifyFinContainerEdgePhpEnvironment(context), closure);
	return record;
};
