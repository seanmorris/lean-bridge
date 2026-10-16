/**
 * Authenticate original Ruby package records against the complete frozen generator.
 *
 * @file
 */
import assert from "node:assert/strict";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypeRubyGenerator as nestedCheckedRecordRubyGenerator } from "./nominal-subtype-ruby-generators.mjs";
import { assertNestedCheckedRecordRubyIdentity, nestedCheckedRecordRubyReceipt, nestedCheckedRecordRubyRequirePath } from "./nested-checked-record-ruby-package.mjs";
import { checkNestedCheckedRecordRubyArchive } from "./nested-checked-record-ruby-archive.mjs";

/**
 * Reconcile every retained gem file, generated source and native-library identity.
 *
 * @param options - Original records and independently authenticated compiler model.
 * @param options.read - Selection-relative original byte reader.
 * @param options.json - Canonical JSON reader.
 * @param options.model - Independently reproduced compiler model.
 * @param options.receipt - Verified package-set receipt.
 * @param options.floor - Explicit native glibc floor.
 * @param options.producerCommit - Frozen producer revision.
 */
export const checkNestedCheckedRecordRubyPackage = async ({ read, json, model, receipt, floor, producerCommit }) => {
	const pkg = receipt.packages[0], gem = await json("gem.json");
	assert.deepEqual(Object.keys(gem).sort(), ["archive", "closure", "evidence", "files", "receiptSha256", "retained"]);
	assert.deepEqual(gem.archive, pkg.artifacts[0]);
	const receiptBytes = await read(`package/${nestedCheckedRecordRubyReceipt}`), packageReceipt = await json(`package/${nestedCheckedRecordRubyReceipt}`);
	assertNestedCheckedRecordRubyIdentity(packageReceipt, pkg, model, floor);
	const handoff = await read("handoff/package-set-receipt.json");
	assert.equal(handoff.toString(), canonicalJson(receipt));
	assert.equal((await read("handoff/package-set-receipt.json.sha256")).toString(), sha256(handoff) + "  package-set-receipt.json\n");
	const archive = await read("handoff/" + gem.archive.path);
	const members = checkNestedCheckedRecordRubyArchive({ archive, artifact: gem.archive, files: gem.files, receiptBytes });
	assert.equal(gem.receiptSha256, sha256(receiptBytes));
	const paths = [...Object.keys(packageReceipt.files), nestedCheckedRecordRubyReceipt].sort();
	assert.equal(new Set(paths).size, paths.length); assert.deepEqual(Object.keys(gem.files).sort(), paths);
	for(const path of paths)
	{
		assert.ok(/^[A-Za-z0-9_.+/-]+$/u.test(path) && path.split("/").every(part => part && part !== "." && part !== ".."));
		const file = gem.files[path]; assert.deepEqual(Object.keys(file).sort(), ["bytes", "sha256"]);
		assert.match(file.sha256, /^[a-f0-9]{64}$/u); assert.ok(Number.isSafeInteger(file.bytes) && file.bytes >= 0);
		if(Object.hasOwn(packageReceipt.files, path)) assert.deepEqual(file, packageReceipt.files[path]);
	}
	const binaryPrefix = `lib/${nestedCheckedRecordRubyRequirePath}/native/linux-x64/`;
	assert.deepEqual(gem.retained, paths.filter(path => !path.startsWith(binaryPrefix)));
	for(const path of gem.retained)
	{
		const bytes = await read(`package/${path}`);
		assert.deepEqual(bytes, members.get(path), path);
		assert.deepEqual(gem.files[path], { bytes: bytes.length, sha256: sha256(bytes) }, path);
		assert.deepEqual(Buffer.from(bytes.toString("utf8")), bytes);
	}
	const prefix = "package/lean-bridge/";
	assert.deepEqual(await json(prefix + "component/model.json"), model);
	assert.deepEqual(await json(prefix + "component/binding-ir.json"), model.bindingIr);
	assert.deepEqual(await json(prefix + "platform.json"), { profile: "native-library-v1", ruby: "3.3", platform: "x86_64-linux", glibcMinimumVersion: floor });
	const component = await json(prefix + "component/native-component.json"), adapter = await json(prefix + "native-c-adapter.json"), runtime = await json(prefix + "runtime.json");
	assert.equal(sha256(canonicalJson(runtime)), packageReceipt.runtimeIdentity);
	assert.equal(component.runtimeIdentity, packageReceipt.runtimeIdentity); assert.equal(adapter.runtimeIdentity, packageReceipt.runtimeIdentity);
	assert.equal(component.bindingIrSha256, model.bindingIrSha256); assert.equal(adapter.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(component.sourceIdentity, model.sourceIdentity);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	const libraries = { [adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [component.library]: component.nativeLibrary.sha256
		, ...Object.fromEntries(Object.entries(runtime.files).filter(([path]) => path.startsWith("lib/")).map(([path, file]) => [path.slice(4), file.sha256])) };
	assert.deepEqual(Object.fromEntries(paths.filter(path => path.startsWith(binaryPrefix)).map(path => [path.slice(binaryPrefix.length), gem.files[path].sha256])), libraries);
	const evidence = { runtimeIdentity: packageReceipt.runtimeIdentity
		, componentId: model.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, library: adapter.library, libraries };
	assert.deepEqual(gem.evidence, evidence);
	const { generateCopiedRubyPackage, paths: generatorPaths } = await nestedCheckedRecordRubyGenerator(producerCommit);
	const generated = generateCopiedRubyPackage(model.bindingIr, evidence);
	for(const [path, source] of Object.entries(generated)) assert.equal((await read(`package/${path}`)).toString(), source, path);
	assert.deepEqual(paths.filter(path => /\.rb$/u.test(path)).sort(), Object.keys(generated).filter(path => /\.rb$/u.test(path)).sort());
	return { packageReceipt, gem, generatorPaths };
};
