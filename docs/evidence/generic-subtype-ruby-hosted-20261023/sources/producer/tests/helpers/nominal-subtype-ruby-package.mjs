/**
 * Authenticate installed Ruby payloads against the original gem before public execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { generateCopiedRubyPackage } from "../../src/backends/ruby/copied-values.mjs";
import { verifyFinContainerEdgeRubyEnvironment } from "./fin-container-edge-ruby-closure.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

export const nominalSubtypeRubyRequirePath = "lean_bridge/nominalsubtypes";
export const nominalSubtypeRubyReceipt = "lean-bridge/package-receipt.json";

/**
 * Require the selected gem coordinates, source identity and platform floor.
 *
 * @param receipt - Original archive-derived package receipt.
 * @param pkg - Independently verified package-set component.
 * @param model - Reproduced author-build compiler model.
 * @param floor - Explicit native glibc floor.
 */
export const assertNominalSubtypeRubyIdentity = (receipt, pkg, model, floor) => {
	assert.equal(pkg.target, "rubygems"); assert.equal(pkg.ecosystem, "rubygems");
	assert.equal(pkg.role, "component"); assert.equal(pkg.profile, "native-library-v1");
	assert.equal(pkg.runtimeDelivery, "embedded"); assert.deepEqual(pkg.requires, []);
	assert.equal(pkg.artifacts.length, 1); assert.equal(pkg.name, "nominalsubtypes"); assert.equal(pkg.version, "1.0.0");
	assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, "lean-bridge-ordinary-rubygems-package");
	assert.equal(receipt.ecosystem, "rubygems"); assert.equal(receipt.namespace, "LeanBridge::Nominalsubtypes");
	assert.equal(receipt.requirePath, nominalSubtypeRubyRequirePath);
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.runtimeIdentity, pkg.runtimeIdentity);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(receipt.component, model.component); assert.deepEqual(receipt.sourceIdentity, model.sourceIdentity);
	assert.match(floor, /^2\.[0-9]+$/u); assert.equal(receipt.glibcMinimumVersion, floor);
	assert.ok(pkg.artifacts[0].path.endsWith("/nominalsubtypes-1.0.0-x86_64-linux.gem"));
};

/**
 * Reconstruct the producer's loader identities without trusting receipt member order.
 *
 * @param receipt - Original gem receipt.
 * @param component - Native component receipt.
 * @param adapter - C adapter receipt.
 * @param runtime - Shared runtime manifest.
 */
export const nominalSubtypeRubyNativeEvidence = (receipt, component, adapter, runtime) => {
	assert.equal(sha256(canonicalJson(runtime)), receipt.runtimeIdentity);
	assert.equal(component.runtimeIdentity, receipt.runtimeIdentity); assert.equal(adapter.runtimeIdentity, receipt.runtimeIdentity);
	assert.equal(component.bindingIrSha256, receipt.bindingIrSha256); assert.equal(adapter.bindingIrSha256, receipt.bindingIrSha256);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	const libraries = { [adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [component.library]: component.nativeLibrary.sha256
		, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256])) };
	const prefix = `lib/${nominalSubtypeRubyRequirePath}/native/linux-x64/`;
	assert.deepEqual(Object.fromEntries(Object.entries(receipt.files).filter(([path]) => path.startsWith(prefix))
		.map(([path, file]) => [path.slice(prefix.length), file.sha256])), libraries);
	return { runtimeIdentity: receipt.runtimeIdentity
		, componentId: receipt.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, library: adapter.library, libraries };
};

/**
 * Retain complete original text inputs and regenerate the public/private Ruby sources.
 * The environment verifier derives its baseline from the gem, never from installed files.
 *
 * @param options - Authenticated installation and compiler inputs.
 * @param options.context - Original archive-derived installation context.
 * @param options.pkg - Package-set component entry.
 * @param options.model - Independently reproduced compiler model.
 * @param options.floor - Explicit native glibc floor.
 * @param options.output - Fresh retained-record directory.
 */
export const inspectNominalSubtypeRubyPackage = async ({ context, pkg, model, floor, output }) => {
	const closure = await verifyFinContainerEdgeRubyEnvironment(context);
	assert.equal(context.fullName, "nominalsubtypes-1.0.0-x86_64-linux");
	const root = join(context.gems, "gems", context.fullName), receipt = JSON.parse(context.receiptBytes);
	assert.equal(context.receiptBytes, canonicalJson(receipt));
	assertNominalSubtypeRubyIdentity(receipt, pkg, model, floor);
	const json = async path => JSON.parse(await readFile(join(root, "lean-bridge", path)));
	assert.deepEqual(await json("component/model.json"), model);
	assert.deepEqual(await json("platform.json"), { profile: "native-library-v1", ruby: "3.3", platform: "x86_64-linux", glibcMinimumVersion: floor });
	const component = await json("component/native-component.json"), adapter = await json("native-c-adapter.json"), runtime = await json("runtime.json");
	const evidence = nominalSubtypeRubyNativeEvidence(receipt, component, adapter, runtime);
	for(const [path, source] of Object.entries(generateCopiedRubyPackage(model.bindingIr, evidence)))
		assert.equal(await readFile(join(root, path), "utf8"), source, path);
	const files = { ...receipt.files, [nominalSubtypeRubyReceipt]: { bytes: Buffer.byteLength(context.receiptBytes), sha256: sha256(context.receiptBytes) } };
	const retained = [];
	for(const path of Object.keys(files).sort())
	{
		if(path.startsWith(`lib/${nominalSubtypeRubyRequirePath}/native/linux-x64/`)) continue;
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
