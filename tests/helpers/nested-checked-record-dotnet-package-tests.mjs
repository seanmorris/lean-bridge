/**
 * Check NuGet provenance and source-free deployment controls.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	assertNestedCheckedRecordDotnetIdentity
	, nestedCheckedRecordDotnetNativeEvidence
	, verifyNestedCheckedRecordDotnetDeployment
} from "./nested-checked-record-dotnet-package.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

test("nested checked-record C# package identity rejects provenance drift", () => {
	const model = {
		bindingIrSha256: "a".repeat(64), component: { id: "synthetic" }
		, sourceIdentity: { fixture: true }
	};
	const pkg = {
		target: "nuget", ecosystem: "nuget", role: "component"
		, profile: "native-library-v1", runtimeDelivery: "embedded", requires: []
		, name: "Nestedcheckedrecords.Api", version: "1.0.0"
		, runtimeIdentity: "b".repeat(64)
		, artifacts: [{ path: "archives/Nestedcheckedrecords.Api.1.0.0.nupkg" }]
	};
	const receipt = {
		schemaVersion: 1, kind: "lean-bridge-ordinary-nuget-package"
		, ecosystem: "nuget", name: pkg.name, version: pkg.version
		, namespace: "LeanBridge.Nestedcheckedrecords"
		, assembly: "LeanBridge.Nestedcheckedrecords"
		, runtimeIdentity: pkg.runtimeIdentity
		, ...model
		, glibcMinimumVersion: "2.36", compiledProjectionSha256: "c".repeat(64)
	};
	assertNestedCheckedRecordDotnetIdentity(receipt, pkg, model, "2.36");
	for(const key of Object.keys(receipt))
	{
		assert.throws(() => assertNestedCheckedRecordDotnetIdentity(
			{ ...receipt, [key]: "changed" }, pkg, model, "2.36"
		));
		const missing = { ...receipt }; delete missing[key];
		assert.throws(() => assertNestedCheckedRecordDotnetIdentity(
			missing, pkg, model, "2.36"
		));
	}
	for(const key of Object.keys(pkg))
	{
		assert.throws(() => assertNestedCheckedRecordDotnetIdentity(
			receipt, { ...pkg, [key]: "changed" }, model, "2.36"
		));
	}
	assert.throws(() => assertNestedCheckedRecordDotnetIdentity(
		receipt, { ...pkg, artifacts: [] }, model, "2.36"
	));
	assert.throws(() => assertNestedCheckedRecordDotnetIdentity(
		receipt, { ...pkg, artifacts: [...pkg.artifacts, ...pkg.artifacts] }
		, model, "2.36"
	));
	assert.throws(() => assertNestedCheckedRecordDotnetIdentity(
		receipt, pkg, model, "2.38"
	));
});

test("nested checked-record C# loader evidence binds all native receipts", () => {
	const file = digit => ({ sha256: digit.repeat(64), bytes: 1 });
	const runtime = {
		files: { "include/runtime.h": file("1"), "lib/libruntime.so": file("2") }
	};
	const identity = {
		runtimeIdentity: sha256(canonicalJson(runtime))
		, bindingIrSha256: "3".repeat(64)
	};
	const component = {
		...identity, library: "libcomponent.so", nativeLibrary: file("4")
	};
	const adapter = {
		...identity, library: "libadapter.so"
		, componentReceiptSha256: sha256(canonicalJson(component))
		, files: { "lib/libadapter.so": file("5") }
	};
	const receipt = {
		...identity, component: { id: "synthetic" }
		, files: {
			"runtimes/linux-x64/native/libruntime.so": file("2")
			, "runtimes/linux-x64/native/libcomponent.so": file("4")
			, "runtimes/linux-x64/native/libadapter.so": file("5")
		}
	};
	const evidence = nestedCheckedRecordDotnetNativeEvidence(
		receipt, component, adapter, runtime
	);
	assert.deepEqual(
		Object.keys(evidence.libraries)
		, ["libadapter.so", "libcomponent.so", "libruntime.so"]
	);
	const reordered = {
		...receipt, files: Object.fromEntries(Object.entries(receipt.files).reverse())
	};
	assert.equal(JSON.stringify(nestedCheckedRecordDotnetNativeEvidence(
		reordered, component, adapter, runtime
	)), JSON.stringify(evidence));
	for(const path of Object.keys(receipt.files))
	{
		const bad = structuredClone(receipt); bad.files[path].sha256 = "0".repeat(64);
		assert.throws(() => nestedCheckedRecordDotnetNativeEvidence(
			bad, component, adapter, runtime
		));
		delete bad.files[path];
		assert.throws(() => nestedCheckedRecordDotnetNativeEvidence(
			bad, component, adapter, runtime
		));
	}
});

test("nested checked-record source-free replay rejects deployment drift", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nested-dotnet-deployment-"));
	t.after(() => rm(root, { recursive: true }));
	const files = {
		"Consumer.dll": "synthetic consumer"
		, "LeanBridge.Nestedcheckedrecords.dll": "synthetic library"
		, "Consumer.deps.json": "{}"
		, "runtimes/linux-x64/native/libsynthetic.so": "synthetic native"
	};
	const outputs = {};
	for(const [path, bytes] of Object.entries(files))
	{
		await saveLakeFile(root, path, bytes);
		outputs[path] = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) };
	}
	const original = await verifyNestedCheckedRecordDotnetDeployment(root, outputs);
	for(const [path, bytes] of Object.entries(files))
	{
		await saveLakeFile(root, path, "changed");
		await assert.rejects(verifyNestedCheckedRecordDotnetDeployment(root, outputs));
		await rm(join(root, path));
		await assert.rejects(verifyNestedCheckedRecordDotnetDeployment(root, outputs));
		await symlink(join(root, path === "Consumer.dll"
			? "LeanBridge.Nestedcheckedrecords.dll" : "Consumer.dll"), join(root, path));
		await assert.rejects(verifyNestedCheckedRecordDotnetDeployment(root, outputs));
		await rm(join(root, path)); await saveLakeFile(root, path, bytes);
	}
	await saveLakeFile(root, "extra.dll", "unknown");
	await assert.rejects(verifyNestedCheckedRecordDotnetDeployment(root, outputs));
	await rm(join(root, "extra.dll"));
	assert.deepEqual(
		await verifyNestedCheckedRecordDotnetDeployment(root, outputs), original
	);
});
