/**
 * Source-package contracts without claiming installed wheel acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { generateOwnedPythonPackage } from "../src/backends/python/owned-package.mjs";
import { ownedPythonAssets } from "../src/backends/python/owned-assets.mjs";
import { ownedCppCompositionReviewedIr } from "./helpers/owned-cpp-composition-fixture.mjs";
import { ownedPythonScalarsReviewedIr } from "./helpers/owned-python-scalars-fixture.mjs";

for(const fixture of [ownedCppCompositionReviewedIr, ownedPythonScalarsReviewedIr]) test(`owned Python package binds its typed sources (${fixture.name})`, () => {
	const ir = fixture(), generated = generateOwnedPythonPackage(ir);
	assert.deepEqual(generated.files, generateOwnedPythonPackage(ir).files);
	const manifest = JSON.parse(generated.files["binding-manifest.json"]);
	assert.equal(manifest.bindingIrSha256, generated.c.native.model.bindingIrSha256);
	assert.deepEqual(manifest.files, Object.keys(generated.files).sort());
	assert.equal(manifest.contract.stubSha256, sha256(generated.files[manifest.typeStub]));
	assert.equal(manifest.contract.conversionsSha256, sha256(generated.files[manifest.internalModule]));
	assert.equal(manifest.contract.runtimeSha256, sha256(generated.files[`${generated.packageDir}/_owned.py`]));
	assert.equal(manifest.contract.abiHeaderSha256, sha256(generated.abiHeader));
	assert.equal(manifest.contract.loaderSha256, sha256(ownedPythonAssets(null)));
	assert.equal(manifest.contract.ownership, "checked-result-leases");
	assert.equal(manifest.contract.callbackLifetime, "call");
	assert.match(generated.files[manifest.publicModule], /from \. import _native as _OwnedNative/u);
	assert.match(generated.files[manifest.internalModule], /_bind\(_R\._OwnedRuntime\(_Assets\._LIBRARY, _Assets\._ensure_process\)\)/u);
	assert.match(generated.files[`${generated.packageDir}/_assets.py`], /raise ImportError\("Build a compiled PyPI release/u);
	assert.doesNotMatch(generated.files[manifest.typeStub], /\bAny\b|\b(?:handle|token)\s*:/u);
	assert.equal(generated.requiresTypeAliases, true);
	for(const fn of generated.functions)
	{
		assert.ok(manifest.exports.includes(fn.publicName));
		assert.ok(generated.files[manifest.publicModule].includes(`def ${fn.publicName}(`));
		assert.ok(generated.files[manifest.typeStub].includes(`def ${fn.publicName}(`));
	}
});
