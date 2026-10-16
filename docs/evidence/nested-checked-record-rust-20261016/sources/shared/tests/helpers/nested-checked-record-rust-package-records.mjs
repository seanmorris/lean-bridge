/**
 * Authenticate original Rust package records against the complete frozen generator.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nestedCheckedRecordRustGenerator } from "./nested-checked-record-rust-generators.mjs";
import { assertNestedCheckedRecordRustIdentity, nestedCheckedRecordRustReceipt } from "./nested-checked-record-rust-package.mjs";
import { readOwnedPerlCallbackVariantTar } from "./owned-perl-callback-result-variant-archives.mjs";

/**
 * Require the complete crate, including each original native-library payload.
 *
 * @param options - Independently authenticated artifact and member inventory.
 * @param options.archive - Original retained compressed archive bytes.
 * @param options.receiptBytes - Original canonical package receipt bytes.
 * @param options.files - Complete package member inventory including its receipt.
 * @param options.pkg - Verified package-set component entry.
 */
export const checkNestedCheckedRecordRustArchive = ({ archive, receiptBytes, files, pkg }) => {
	assert.equal(archive.length, pkg.artifacts[0].bytes); assert.equal(sha256(archive), pkg.artifacts[0].sha256);
	const members = readOwnedPerlCallbackVariantTar(archive, `${pkg.name}-${pkg.version}`);
	assert.deepEqual([...members.keys()].sort(), Object.keys(files).sort());
	assert.deepEqual(members.get(nestedCheckedRecordRustReceipt), receiptBytes);
	for(const [path, bytes] of members)
		assert.deepEqual({ bytes: bytes.length, sha256: sha256(bytes) }, files[path], path);
	return members;
};

/**
 * Reconcile every retained crate file, generated source and native-library identity.
 *
 * @param options - Original records and independently authenticated compiler model.
 * @param options.read - Selection-relative original byte reader.
 * @param options.json - Canonical JSON reader.
 * @param options.model - Independently reproduced compiler model.
 * @param options.receipt - Verified package-set receipt.
 * @param options.floor - Explicit native glibc floor.
 * @param options.producerCommit - Frozen producer revision.
 */
export const checkNestedCheckedRecordRustPackage = async ({ read, json, model, receipt, floor, producerCommit }) => {
	const pkg = receipt.packages[0], crate = await json("crate.json");
	assert.deepEqual(Object.keys(crate).sort(), ["archive", "closure", "evidence", "files", "receiptSha256", "retained"]);
	assert.deepEqual(crate.archive, pkg.artifacts[0]);
	const receiptBytes = await read(`package/${nestedCheckedRecordRustReceipt}`), packageReceipt = await json(`package/${nestedCheckedRecordRustReceipt}`);
	assertNestedCheckedRecordRustIdentity(packageReceipt, pkg, model, floor);
	const handoff = await read("handoff/package-set-receipt.json");
	assert.equal(handoff.toString(), canonicalJson(receipt));
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString(), sha256(handoff) + "  package-set-receipt.json\n");
	const archive = await read("handoff/" + crate.archive.path);
	const members = checkNestedCheckedRecordRustArchive({ archive, receiptBytes, files: crate.files, pkg });
	assert.equal(crate.receiptSha256, sha256(receiptBytes));
	const paths = [...Object.keys(packageReceipt.files), nestedCheckedRecordRustReceipt].sort();
	assert.equal(new Set(paths).size, paths.length); assert.deepEqual(Object.keys(crate.files).sort(), paths);
	for(const path of paths)
	{
		assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path) && path.split("/").every(part => part && part !== "." && part !== ".."));
		const file = crate.files[path]; assert.deepEqual(Object.keys(file).sort(), ["bytes", "sha256"]);
		assert.match(file.sha256, /^[a-f0-9]{64}$/u); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
		if(Object.hasOwn(packageReceipt.files, path)) assert.deepEqual(file, packageReceipt.files[path]);
	}
	const binaryPrefix = "native/linux-x64/";
	assert.deepEqual(crate.retained, paths.filter(path => !path.startsWith(binaryPrefix)));
	for(const path of crate.retained)
	{
		const bytes = await read(`package/${path}`);
		assert.deepEqual(bytes, members.get(path), path);
		assert.deepEqual(crate.files[path], { bytes: bytes.length, sha256: sha256(bytes) }, path);
		assert.deepEqual(Buffer.from(bytes.toString("utf8")), bytes);
	}
	const prefix = "package/lean-bridge/";
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
	assert.deepEqual(Object.fromEntries(paths.filter(path => path.startsWith(binaryPrefix)).map(path => [path.slice(binaryPrefix.length), crate.files[path].sha256])), libraries);
	const evidence = { runtimeIdentity: packageReceipt.runtimeIdentity
		, componentId: model.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, library: adapter.library, libraries };
	assert.deepEqual(crate.evidence, evidence);
	const { generateCopiedRustPackage, lock, paths: generatorPaths } = await nestedCheckedRecordRustGenerator(producerCommit);
	const metadata = JSON.parse(model.sourceIdentity.exportConfigurationSource).package ?? {};
	const generated = generateCopiedRustPackage(model.bindingIr, evidence, { name: pkg.name, version: pkg.version, metadata });
	assert.equal((await read("package/Cargo.lock")).toString(), lock);
	for(const [path, source] of Object.entries(generated)) assert.equal((await read(`package/${path}`)).toString(), source, path);
	assert.deepEqual(paths.filter(path => /\.rs$/u.test(path)).sort(), Object.keys(generated).filter(path => /\.rs$/u.test(path)).sort());
	const compiled = await json(prefix + "native-rust.json");
	assert.equal(sha256(canonicalJson(compiled)), packageReceipt.compiledProjectionSha256);
	assert.equal(compiled.schemaVersion, 1); assert.equal(compiled.profile, "native-library-v1");
	assert.equal(compiled.name, pkg.name); assert.equal(compiled.version, pkg.version);
	assert.equal(compiled.bindingIrSha256, model.bindingIrSha256); assert.deepEqual(compiled.evidence, evidence);
	assert.match(compiled.rustc, /^rustc 1\.(?:9\d|[1-9]\d{2,})\.\d+ /u);
	assert.deepEqual(Object.keys(compiled.files).sort(), [...Object.keys(generated)
		, "Cargo.lock", "lean-bridge/licenses/LeanBridge-LICENSE"
		, ...Object.keys(libraries).map(name => binaryPrefix + name)].sort());
	for(const [path, file] of Object.entries(compiled.files)) assert.deepEqual(file, crate.files[path]);
	assert.deepEqual(crate.closure, { receiptSha256: sha256(receiptBytes)
		, packageFileSetSha256: sha256(canonicalJson(paths)) });
	return { packageReceipt, crate, generatorPaths };
};
