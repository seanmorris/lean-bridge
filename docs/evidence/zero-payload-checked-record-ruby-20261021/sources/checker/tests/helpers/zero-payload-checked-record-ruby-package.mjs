/**
 * Authenticate a zero-payload Ruby gem against its frozen package receipt and
 * independently selected compiler model before its public caller executes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateCopiedRubyPackage } from "../../src/backends/ruby/copied-values.mjs";
import { verifyFinContainerEdgeRubyEnvironment } from "./fin-container-edge-ruby-closure.mjs";
import {
	zeroPayloadRubyNamespace, zeroPayloadRubyRequirePath
	, zeroPayloadRubyTarget
} from "./zero-payload-checked-record-ruby-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const zeroPayloadRubyReceipt = "lean-bridge/package-receipt.json";

/**
 * Require the selected gem coordinate, embedded runtime, and exact compiler
 * identity before treating an installed payload as a component package.
 *
 * @param receipt - Archive-derived Ruby package receipt.
 * @param pkg - Independently verified package-set component entry.
 * @param model - Reproduced canonical compiler model.
 * @param floor - Explicit native glibc floor.
 */
export const assertZeroPayloadRubyIdentity = (receipt, pkg, model, floor) => {
	assert.equal(pkg.target, "rubygems"); assert.equal(pkg.ecosystem, "rubygems");
	assert.equal(pkg.role, "component"); assert.equal(pkg.profile, "native-library-v1");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.artifacts.length, 1); assert.deepEqual({ name: pkg.name, version: pkg.version }, zeroPayloadRubyTarget);
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, "lean-bridge-ordinary-rubygems-package");
	assert.equal(receipt.ecosystem, "rubygems"); assert.equal(receipt.namespace, zeroPayloadRubyNamespace);
	assert.equal(receipt.requirePath, zeroPayloadRubyRequirePath);
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.component, model.component); assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
	assert.match(floor, /^2\.[0-9]+$/u); assert.equal(receipt.glibcMinimumVersion, floor);
	assert.equal(pkg.artifacts[0].path, `archives/${pkg.name}-${pkg.version}-x86_64-linux.gem`);
};

/**
 * Reconstruct native loader identities without accepting installed files as a
 * baseline. Receipt ordering is deliberately irrelevant.
 *
 * @param receipt - Archive-derived Ruby package receipt.
 * @param component - Embedded native component receipt.
 * @param adapter - Embedded C adapter receipt.
 * @param runtime - Shared runtime manifest.
 */
export const zeroPayloadRubyNativeEvidence = (receipt, component, adapter, runtime) => {
	assert.equal(sha256(canonicalJson(runtime)), receipt.runtimeIdentity);
	assert.equal(component.runtimeIdentity, receipt.runtimeIdentity); assert.equal(adapter.runtimeIdentity, receipt.runtimeIdentity);
	assert.equal(component.bindingIrSha256, receipt.bindingIrSha256); assert.equal(adapter.bindingIrSha256, receipt.bindingIrSha256);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	const libraries = { [adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [component.library]: component.nativeLibrary.sha256
		, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/"))
			.map(([path, file]) => [path.slice(4), file.sha256])) };
	const prefix = `lib/${zeroPayloadRubyRequirePath}/native/linux-x64/`;
	assert.deepEqual(Object.fromEntries(Object.entries(receipt.files).filter(([path]) => path.startsWith(prefix))
		.map(([path, file]) => [path.slice(prefix.length), file.sha256])), libraries);
	return { runtimeIdentity: receipt.runtimeIdentity
		, componentId: receipt.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, library: adapter.library
		, libraries };
};

/**
 * Preserve complete original text inputs and regenerate the public/private
 * Ruby sources from the reproduced compiler model.
 *
 * @param options - Authenticated installation and compiler inputs.
 * @param options.context - Archive-derived installed gem environment.
 * @param options.pkg - Package-set component entry.
 * @param options.model - Reproduced canonical compiler model.
 * @param options.floor - Explicit native glibc floor.
 * @param options.output - Fresh retained-record directory.
 */
export const inspectZeroPayloadRubyPackage = async ({ context, pkg, model, floor, output }) => {
	const closure = await verifyFinContainerEdgeRubyEnvironment(context);
	assert.equal(context.fullName, `${pkg.name}-${pkg.version}-x86_64-linux`);
	const root = join(context.gems, "gems", context.fullName), receipt = JSON.parse(context.receiptBytes);
	assert.equal(context.receiptBytes, canonicalJson(receipt));
	assertZeroPayloadRubyIdentity(receipt, pkg, model, floor);
	const json = async path => JSON.parse(await readFile(join(root, "lean-bridge", path)));
	assert.deepEqual(await json("component/model.json"), model);
	assert.deepEqual(await json("platform.json"), {
		profile: "native-library-v1"
		, ruby: "3.3"
		, platform: "x86_64-linux"
		, glibcMinimumVersion: floor
	});
	const component = await json("component/native-component.json"), adapter = await json("native-c-adapter.json")
		, runtime = await json("runtime.json");
	const evidence = zeroPayloadRubyNativeEvidence(receipt, component, adapter, runtime);
	for(const [path, source] of Object.entries(generateCopiedRubyPackage(model.bindingIr, evidence)))
		assert.equal(await readFile(join(root, path), "utf8"), source, path);
	const files = { ...receipt.files, [zeroPayloadRubyReceipt]: {
		bytes: Buffer.byteLength(context.receiptBytes)
		, sha256: sha256(context.receiptBytes) } };
	const retained = [];
	for(const path of Object.keys(files).sort())
	{
		if(path.startsWith(`lib/${zeroPayloadRubyRequirePath}/native/linux-x64/`)) continue;
		const bytes = await readFile(join(root, path));
		assert.deepEqual({ bytes: bytes.length, sha256: sha256(bytes) }, files[path]);
		assert.equal(Buffer.from(bytes.toString("utf8"), "utf8").compare(bytes), 0, path);
		await saveLakeFile(output, `package/${path}`, bytes); retained.push(path);
	}
	const specPath = `specifications/${context.fullName}.gemspec`, specBytes = await readFile(join(context.gems, specPath));
	await saveLakeFile(output, "installed.gemspec", specBytes);
	assert.deepEqual({ bytes: specBytes.length, sha256: sha256(specBytes) }, context.files[specPath]);
	const record = { archive: pkg.artifacts[0], receiptSha256: sha256(context.receiptBytes), files, retained, evidence, closure };
	await saveLakeFile(output, "gem.json", canonicalJson(record));
	assert.deepEqual(await verifyFinContainerEdgeRubyEnvironment(context), closure);
	return record;
};
