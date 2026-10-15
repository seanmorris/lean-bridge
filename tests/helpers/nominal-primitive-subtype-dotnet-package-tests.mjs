/**
 * Check C# package provenance and deployed closure separately from compiled acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertNominalPrimitiveSubtypeDotnetIdentity, nominalPrimitiveSubtypeDotnetNativeEvidence, verifyNominalPrimitiveSubtypeDotnetDeployment } from "./nominal-primitive-subtype-dotnet-package.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

test("primitive-base nominal C# package identity rejects coordinate, source, floor and runtime drift", () => {
	const model = { bindingIrSha256: "a".repeat(64), component: { id: "synthetic" }, sourceIdentity: { fixture: true } };
	const pkg = { target: "nuget", ecosystem: "nuget", role: "component"
		, profile: "native-library-v1", runtimeDelivery: "embedded", requires: []
		, name: "Nominalprimitivesubtypes.Api", version: "1.0.0"
		, runtimeIdentity: "b".repeat(64)
		, artifacts: [{ path: "archives/Nominalprimitivesubtypes.Api.1.0.0.nupkg" }] };
	const receipt = { schemaVersion: 1, kind: "lean-bridge-ordinary-nuget-package"
		, ecosystem: "nuget", name: pkg.name, version: pkg.version
		, namespace: "LeanBridge.Nominalprimitivesubtypes"
		, assembly: "LeanBridge.Nominalprimitivesubtypes"
		, runtimeIdentity: pkg.runtimeIdentity
		, ...model
		, glibcMinimumVersion: "2.36", compiledProjectionSha256: "c".repeat(64) };
	assertNominalPrimitiveSubtypeDotnetIdentity(receipt, pkg, model, "2.36");
	for(const key of Object.keys(receipt))
	{
		assert.throws(() => assertNominalPrimitiveSubtypeDotnetIdentity({ ...receipt, [key]: "changed" }, pkg, model, "2.36"));
		const missing = { ...receipt }; delete missing[key];
		assert.throws(() => assertNominalPrimitiveSubtypeDotnetIdentity(missing, pkg, model, "2.36"));
	}
	for(const key of Object.keys(pkg))
		assert.throws(() => assertNominalPrimitiveSubtypeDotnetIdentity(receipt, { ...pkg, [key]: "changed" }, model, "2.36"));
	assert.throws(() => assertNominalPrimitiveSubtypeDotnetIdentity(receipt, { ...pkg, artifacts: [] }, model, "2.36"));
	assert.throws(() => assertNominalPrimitiveSubtypeDotnetIdentity(receipt, { ...pkg, artifacts: [...pkg.artifacts, ...pkg.artifacts] }, model, "2.36"));
	assert.throws(() => assertNominalPrimitiveSubtypeDotnetIdentity(receipt, pkg, model, "2.38"));
});

test("primitive-base nominal C# loader identities derive from complete original native receipts", () => {
	const file = digit => ({ sha256: digit.repeat(64), bytes: 1 });
	const runtime = { files: { "include/runtime.h": file("1"), "lib/libruntime.so": file("2") } };
	const identity = { runtimeIdentity: sha256(canonicalJson(runtime)), bindingIrSha256: "3".repeat(64) };
	const component = { ...identity, library: "libcomponent.so", nativeLibrary: file("4") };
	const adapter = { ...identity, library: "libadapter.so"
		, componentReceiptSha256: sha256(canonicalJson(component))
		, files: { "lib/libadapter.so": file("5") } };
	const receipt = { ...identity, component: { id: "synthetic" }
		, files: { "runtimes/linux-x64/native/libruntime.so": file("2")
			, "runtimes/linux-x64/native/libcomponent.so": file("4")
			, "runtimes/linux-x64/native/libadapter.so": file("5") } };
	const evidence = nominalPrimitiveSubtypeDotnetNativeEvidence(receipt, component, adapter, runtime);
	assert.deepEqual(Object.keys(evidence.libraries), ["libadapter.so", "libcomponent.so", "libruntime.so"]);
	const reordered = { ...receipt, files: Object.fromEntries(Object.entries(receipt.files).reverse()) };
	assert.equal(JSON.stringify(nominalPrimitiveSubtypeDotnetNativeEvidence(reordered, component, adapter, runtime)), JSON.stringify(evidence));
	for(const path of Object.keys(receipt.files))
	{
		const bad = structuredClone(receipt); bad.files[path].sha256 = "0".repeat(64);
		assert.throws(() => nominalPrimitiveSubtypeDotnetNativeEvidence(bad, component, adapter, runtime));
		delete bad.files[path]; assert.throws(() => nominalPrimitiveSubtypeDotnetNativeEvidence(bad, component, adapter, runtime));
	}
	assert.throws(() => nominalPrimitiveSubtypeDotnetNativeEvidence(receipt, { ...component, runtimeIdentity: "0".repeat(64) }, adapter, runtime));
	assert.throws(() => nominalPrimitiveSubtypeDotnetNativeEvidence(receipt, component, { ...adapter, componentReceiptSha256: "0".repeat(64) }, runtime));
	assert.throws(() => nominalPrimitiveSubtypeDotnetNativeEvidence(receipt, component, adapter, { ...runtime, extra: true }));
});

test("source-free C# replay rejects changed, missing, extra and linked deployment inputs", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-dotnet-deployment-"));
	t.after(() => rm(root, { recursive: true }));
	const files = { "Consumer.dll": "synthetic consumer"
		, "LeanBridge.Nominalprimitivesubtypes.dll": "synthetic library"
		, "Consumer.deps.json": "{}"
		, "runtimes/linux-x64/native/libsynthetic.so": "synthetic native" };
	const outputs = {};
	for(const [path, bytes] of Object.entries(files))
	{
		await saveLakeFile(root, path, bytes); outputs[path] = { bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) };
	}
	const original = await verifyNominalPrimitiveSubtypeDotnetDeployment(root, outputs);
	for(const [path, bytes] of Object.entries(files))
	{
		await saveLakeFile(root, path, "changed"); await assert.rejects(verifyNominalPrimitiveSubtypeDotnetDeployment(root, outputs));
		await rm(join(root, path)); await assert.rejects(verifyNominalPrimitiveSubtypeDotnetDeployment(root, outputs));
		await symlink(join(root, path === "Consumer.dll" ? "LeanBridge.Nominalprimitivesubtypes.dll" : "Consumer.dll"), join(root, path));
		await assert.rejects(verifyNominalPrimitiveSubtypeDotnetDeployment(root, outputs));
		await rm(join(root, path)); await saveLakeFile(root, path, bytes);
	}
	await saveLakeFile(root, "extra.dll", "unknown"); await assert.rejects(verifyNominalPrimitiveSubtypeDotnetDeployment(root, outputs));
	await rm(join(root, "extra.dll")); assert.deepEqual(await verifyNominalPrimitiveSubtypeDotnetDeployment(root, outputs), original);
});
