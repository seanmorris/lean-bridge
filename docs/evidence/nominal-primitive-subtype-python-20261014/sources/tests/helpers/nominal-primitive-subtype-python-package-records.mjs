/**
 * Authenticate retained Python package records against the frozen producer generator.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalPrimitiveSubtypePythonPackage } from "./nominal-primitive-subtype-python-fixture.mjs";
import { nominalSubtypePythonGenerator as nominalPrimitiveSubtypePythonGenerator } from "./nominal-subtype-python-generators.mjs";
import { assertNominalPrimitiveSubtypePythonIdentity, nominalPrimitiveSubtypePythonReceipt } from "./nominal-primitive-subtype-python-wheel.mjs";

/**
 * Reconcile every retained wheel file, generated source and native-library identity.
 *
 * @param options - Original records and independently authenticated author model.
 * @param options.read - Original byte reader relative to one route/API selection.
 * @param options.json - Canonical JSON reader.
 * @param options.model - Verified reproduced compiler model.
 * @param options.receipt - Verified package-set receipt.
 * @param options.floor - Independently selected glibc floor.
 * @param options.producerCommit - Frozen producer revision.
 */
export const checkNominalPrimitiveSubtypePythonPackage = async ({ read, json, model, receipt, floor, producerCommit }) => {
	const pkg = receipt.packages[0], wheel = await json("wheel.json");
	assert.deepEqual(Object.keys(wheel).sort(), ["archive", "evidence", "files", "receiptSha256", "retained"]);
	assert.deepEqual(wheel.archive, pkg.artifacts[0]);
	const packageReceipt = await json(`package/${nominalPrimitiveSubtypePythonReceipt}`);
	assertNominalPrimitiveSubtypePythonIdentity(packageReceipt, pkg, model, floor);
	assert.equal(wheel.receiptSha256, sha256(await read(`package/${nominalPrimitiveSubtypePythonReceipt}`)));
	const recordPath = "nominalprimitivesubtypes-1.0.0.dist-info/RECORD";
	const paths = [...Object.keys(packageReceipt.files), nominalPrimitiveSubtypePythonReceipt, recordPath].sort();
	assert.equal(new Set(paths).size, paths.length);
	assert.deepEqual(Object.keys(wheel.files).sort(), paths);
	for(const path of paths)
	{
		assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path) && path.split("/").every(part => part && part !== "." && part !== ".."));
		const file = wheel.files[path]; assert.deepEqual(Object.keys(file).sort(), ["bytes", "sha256"]);
		assert.match(file.sha256, /^[a-f0-9]{64}$/u); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
		if(Object.hasOwn(packageReceipt.files, path)) assert.deepEqual(file, packageReceipt.files[path]);
	}
	const binaryPrefix = `${nominalPrimitiveSubtypePythonPackage}/native/linux-x64/`;
	assert.deepEqual(wheel.retained, paths.filter(path => !path.startsWith(binaryPrefix)));
	for(const path of wheel.retained)
	{
		const bytes = await read(`package/${path}`);
		assert.deepEqual(wheel.files[path], { bytes: bytes.length, sha256: sha256(bytes) }, path);
		assert.deepEqual(Buffer.from(bytes.toString("utf8")), bytes);
	}
	const lines = paths.filter(path => path !== recordPath).map(path => `${path},sha256=${Buffer.from(wheel.files[path].sha256, "hex").toString("base64url")},${wheel.files[path].bytes}`);
	assert.equal((await read(`package/${recordPath}`)).toString(), [...lines, `${recordPath},,`, ""].join("\n"));
	const prefix = `package/${nominalPrimitiveSubtypePythonPackage}/lean_bridge/`;
	assert.deepEqual(await json(prefix + "component/model.json"), model);
	assert.deepEqual(await json(prefix + "component/binding-ir.json"), model.bindingIr);
	const component = await json(prefix + "component/native-component.json"), adapter = await json(prefix + "native-c-adapter.json"), runtime = await json(prefix + "runtime.json");
	assert.equal(sha256(canonicalJson(runtime)), packageReceipt.runtimeIdentity);
	assert.equal(component.runtimeIdentity, packageReceipt.runtimeIdentity); assert.equal(adapter.runtimeIdentity, packageReceipt.runtimeIdentity);
	assert.equal(component.bindingIrSha256, model.bindingIrSha256); assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	const libraries = { [adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [component.library]: component.nativeLibrary.sha256
		, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256])) };
	assert.deepEqual(Object.fromEntries(paths.filter(path => path.startsWith(binaryPrefix)).map(path => [path.slice(binaryPrefix.length), wheel.files[path].sha256])), libraries);
	const evidence = { runtimeIdentity: packageReceipt.runtimeIdentity
		, componentId: model.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, library: adapter.library, libraries };
	assert.deepEqual(wheel.evidence, evidence);
	const { generateCopiedPythonPackage, paths: generatorPaths } = await nominalPrimitiveSubtypePythonGenerator(producerCommit);
	const generated = generateCopiedPythonPackage(model.bindingIr, evidence), generatedPaths = [];
	for(const [path, source] of Object.entries(generated))
	{
		const destination = path.startsWith(`${nominalPrimitiveSubtypePythonPackage}/`) ? path : `${nominalPrimitiveSubtypePythonPackage}/lean_bridge/${path}`;
		assert.equal((await read(`package/${destination}`)).toString(), source); generatedPaths.push(destination);
	}
	assert.deepEqual(paths.filter(path => /\.pyi?$/u.test(path)).sort(), generatedPaths.filter(path => /\.pyi?$/u.test(path)).sort());
	const metadata = (await read("package/nominalprimitivesubtypes-1.0.0.dist-info/METADATA")).toString();
	assert.match(metadata, /^Name: nominalprimitivesubtypes$/mu); assert.match(metadata, /^Version: 1\.0\.0$/mu);
	assert.match(metadata, /^Requires-Python: >=3\.11$/mu); assert.doesNotMatch(metadata, /^Requires-Dist:/mu);
	assert.equal((await read("package/nominalprimitivesubtypes-1.0.0.dist-info/WHEEL")).toString(), `Wheel-Version: 1.0\nGenerator: lean-bridge-python-copied/1\nRoot-Is-Purelib: false\nTag: ${packageReceipt.tag}\n`);
	assert.equal((await read("package/nominalprimitivesubtypes-1.0.0.dist-info/top_level.txt")).toString(), `${nominalPrimitiveSubtypePythonPackage}\n`);
	return { packageReceipt, wheel, generatorPaths };
};
