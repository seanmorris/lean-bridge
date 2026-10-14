/**
 * Match installed primitive-base npm files and locks to both retained archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { validateComponentPackageReceipt, parseNpmPackageCoordinate } from "../../src/release/component-package-receipt.mjs";
import { readOwnedPerlCallbackVariantTar as readRepositoryTar } from "./owned-perl-callback-result-variant-archives.mjs";
import { nominalPrimitiveSubtypeName } from "./nominal-primitive-subtype-fixture.mjs";

/**
 * Enumerate the original npm handoff without guessing content-addressed names.
 *
 * @param receipt - Independently validated component package receipt.
 */
export const nominalPrimitiveNpmHandoffRecords = receipt => {
	validateComponentPackageReceipt(receipt);
	return [
		"component-package-receipt.json"
		, "verify-component-package-receipt.mjs"
		, receipt.runtime.archive
		, receipt.package.archive
	].map(path => "handoff/" + path);
};

/**
 * Authenticate archive contents, installed metadata and offline lock identities.
 *
 * @param read - Selection-relative original byte reader.
 * @param npm - Independently validated execution report.
 * @param original - Frozen producer source reader.
 */
export const assertNominalPrimitiveNpmHandoff = async (read, npm, original) => {
	validateComponentPackageReceipt(npm.receipt);
	assert.equal((await read("handoff/component-package-receipt.json")).toString(), canonicalJson(npm.receipt));
	assert.deepEqual(await read("handoff/verify-component-package-receipt.mjs"), original("src/release/component-package-receipt.mjs"));
	const basisBytes = await read("installed/runtime-identity.json"), basis = JSON.parse(basisBytes);
	assert.equal(basisBytes.toString(), canonicalJson(basis));
	assert.equal(typeof basis.packing.collationLocale, "string");
	assert.ok(basis.packing.collationLocale.length > 0);
	const artifacts = {}, packages = {};
	for(const [role, item] of [["runtime", npm.receipt.runtime], ["component", npm.receipt.package]])
	{
		const bytes = await read("handoff/" + item.archive);
		assert.equal(sha256(bytes), item.sha256, item.archive);
		const files = readRepositoryTar(bytes, "package", basis.packing.collationLocale);
		const metadataBytes = files.get("package.json"), metadata = JSON.parse(metadataBytes);
		const { name, version } = parseNpmPackageCoordinate(item.package);
		assert.equal(name, role === "runtime" ? "@lean-bridge/runtime" : nominalPrimitiveSubtypeName);
		assert.equal(metadata.name, name); assert.equal(metadata.version, version);
		assert.deepEqual(await read(`installed/${role}-package.json`), metadataBytes);
		assert.deepEqual(Object.fromEntries([...files].map(([path, bytes]) => [path, sha256(bytes)])), npm.trees[name]);
		if(role === "runtime")
		{
			assert.deepEqual(files.get("runtime-identity.json"), basisBytes);
			assert.equal(metadata.leanBridge.runtimeIdentity, sha256(basisBytes));
			assert.equal(metadata.version, "0.0.0-abi" + basis.metadata.leanBridge.componentScalarAbi + "." + metadata.leanBridge.runtimeIdentity);
			assert.deepEqual([...files.keys()].sort(), [...basis.files.map(file => file.path), "package.json", "runtime-identity.json"].sort());
			assert.equal(new Set(basis.files.map(file => file.path)).size, basis.files.length);
			for(const file of basis.files) assert.equal(sha256(files.get(file.path)), file.sha256, file.path);
		}
		artifacts[name] = { bytes: bytes.length, sha256: sha256(bytes)
			, integrity: "sha512-" + createHash("sha512").update(bytes).digest("base64") };
		packages[role] = metadata;
	}
	assert.deepEqual(packages.component.dependencies, { "@lean-bridge/runtime": packages.runtime.version });
	assert.deepEqual(packages.component.leanBridge, {
		component: npm.receipt.package.package
		, componentBundleSha256: npm.receipt.componentBundleSha256
		, componentIdentitySha256: npm.receipt.componentIdentitySha256
		, bindingIrSha256: npm.builds[0].bindingIrSha256, sharedRuntime: true
	});
	const manifest = JSON.parse(await read("installed/package.json"));
	const lock = JSON.parse(await read("installed/package-lock.json"));
	assert.deepEqual(manifest, { private: true, type: "module", dependencies: manifest.dependencies });
	assert.equal(lock.lockfileVersion, 3);
	assert.deepEqual(Object.keys(manifest.dependencies).sort(), ["@lean-bridge/runtime", nominalPrimitiveSubtypeName].sort());
	assert.deepEqual(Object.keys(lock.packages).sort(), ["", "node_modules/@lean-bridge/runtime", `node_modules/${nominalPrimitiveSubtypeName}`].sort());
	assert.deepEqual(lock.packages[""].dependencies, manifest.dependencies);
	for(const [role, item] of [["runtime", npm.receipt.runtime], ["component", npm.receipt.package]])
	{
		const metadata = packages[role], dependency = lock.packages["node_modules/" + metadata.name];
		assert.equal(dependency.version, metadata.version);
		assert.equal(dependency.resolved, "file:../handoff/" + item.archive);
		assert.equal(manifest.dependencies[metadata.name], dependency.resolved);
		assert.equal(dependency.integrity, artifacts[metadata.name].integrity);
	}
	return artifacts;
};
