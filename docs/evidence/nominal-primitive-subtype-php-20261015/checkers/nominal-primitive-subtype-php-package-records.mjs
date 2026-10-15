/**
 * Authenticate primitive-base native PHP package records and generated sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypePhpGenerator } from "./nominal-primitive-subtype-php-generators.mjs";
import {
	assertNominalPrimitiveSubtypePhpIdentity
	, nominalPrimitiveSubtypePhpNativeEvidence
	, nominalPrimitiveSubtypePhpReceipt
} from "./nominal-primitive-subtype-php-package.mjs";

/**
 * Reconcile every retained file with the package receipt and frozen generator.
 *
 * @param options - Authenticated compiler and package records.
 * @param options.read - Selection-relative original byte reader.
 * @param options.json - Canonical JSON reader.
 * @param options.model - Independently checked compiler model.
 * @param options.receipt - Independently checked package-set receipt.
 * @param options.floor - Explicit native glibc floor.
 * @param options.producerCommit - Frozen producer revision.
 */
export const checkNominalPrimitiveSubtypePhpPackageRecords = async ({ read, json, model, receipt, floor, producerCommit }) => {
	const pkg = receipt.packages[0], packaged = await json("package.json");
	assert.deepEqual(Object.keys(packaged).sort(), ["archive", "closure", "evidence", "files", "receiptSha256", "retained"]);
	assert.deepEqual(packaged.archive, pkg.artifacts[0]);
	const receiptBytes = await read(`package/${nominalPrimitiveSubtypePhpReceipt}`);
	const packageReceipt = await json(`package/${nominalPrimitiveSubtypePhpReceipt}`);
	assertNominalPrimitiveSubtypePhpIdentity(packageReceipt, pkg, model, floor);
	assert.equal(packaged.receiptSha256, sha256(receiptBytes));
	const paths = [...Object.keys(packageReceipt.files), nominalPrimitiveSubtypePhpReceipt].sort();
	assert.equal(new Set(paths).size, paths.length); assert.deepEqual(Object.keys(packaged.files).sort(), paths);
	for(const path of paths)
	{
		assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path) && path.split("/").every(part => part && part !== "." && part !== ".."));
		const file = packaged.files[path]; assert.deepEqual(Object.keys(file).sort(), ["bytes", "sha256"]);
		assert.match(file.sha256, /^[a-f0-9]{64}$/u); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
		if(Object.hasOwn(packageReceipt.files, path)) assert.deepEqual(file, packageReceipt.files[path]);
	}
	const binaryPrefix = "native/linux-x64/";
	assert.deepEqual(packaged.retained, paths.filter(path => !path.startsWith(binaryPrefix)));
	for(const path of packaged.retained)
	{
		const bytes = await read(`package/${path}`);
		assert.deepEqual(packaged.files[path], { bytes: bytes.length, sha256: sha256(bytes) }, path);
		assert.deepEqual(Buffer.from(bytes.toString("utf8")), bytes);
	}
	const prefix = "package/lean-bridge/";
	assert.equal(model.copiedGraph, undefined);
	assert.deepEqual(await json(prefix + "component/model.json"), model);
	assert.deepEqual(await json(prefix + "component/binding-ir.json"), model.bindingIr);
	const component = await json(prefix + "component/native-component.json");
	const adapter = await json(prefix + "native-c-adapter.json");
	const runtime = await json(prefix + "runtime.json");
	assert.equal(sha256(canonicalJson(runtime)), packageReceipt.runtimeIdentity);
	assert.equal(component.runtimeIdentity, packageReceipt.runtimeIdentity);
	assert.equal(adapter.runtimeIdentity, packageReceipt.runtimeIdentity);
	assert.equal(component.bindingIrSha256, model.bindingIrSha256);
	assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	const libraries = { [adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [component.library]: component.nativeLibrary.sha256
		, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/"))
			.map(([path, file]) => [path.slice(4), file.sha256])) };
	assert.deepEqual(Object.fromEntries(paths.filter(path => path.startsWith(binaryPrefix))
		.map(path => [path.slice(binaryPrefix.length), packaged.files[path].sha256])), libraries);
	assert.deepEqual(packaged.evidence, nominalPrimitiveSubtypePhpNativeEvidence(packageReceipt, component, adapter, runtime));
	const { generateCopiedPhpPackage, paths: generatorPaths } = await nominalPrimitiveSubtypePhpGenerator(producerCommit);
	const generated = generateCopiedPhpPackage(model.bindingIr, packaged.evidence);
	for(const [path, source] of Object.entries(generated)) assert.equal((await read(`package/${path}`)).toString(), source, path);
	assert.deepEqual(paths.filter(path => /\.php$/u.test(path)).sort(), Object.keys(generated).filter(path => /\.php$/u.test(path)).sort());
	return { packageReceipt, packaged, generatorPaths };
};
