/**
 * Filesystem controls for JVM source-free closure. Synthetic bytes are not JVM evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypeJvmDeploymentFiles, verifyNominalSubtypeJvmDeployment } from "./nominal-subtype-jvm-package.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const identity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });

for(const profile of ["java", "kotlin"]) test(`source-free nominal ${profile} classpaths reject omitted, extra, changed and linked inputs`, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-jvm-closure-"));
	t.after(() => rm(root, { recursive: true }));
	const source = "consumer." + (profile === "java" ? "java" : "kt");
	const payload = profile === "java" ? { "component.jar": "original jar", "classes/Consumer.class": "original class", "classes/Consumer$Nested.class": "original nested class" }
		: { "component.jar": "original jar", "consumer.jar": "original consumer" };
	for(const [path, bytes] of Object.entries(payload)) await saveLakeFile(root, path, bytes);
	const context = { profile, command: process.execPath
		, interpreterSha256: sha256(await readFile(process.execPath))
		, archiveSha256: sha256(payload["component.jar"])
		, files: Object.fromEntries([[source, "compiler input"], ...Object.entries(payload)].map(([path, value]) => [path, identity(Buffer.from(value))])) };
	const before = await verifyNominalSubtypeJvmDeployment(root, context);
	assert.deepEqual(before.files, Object.fromEntries(Object.entries(payload).map(([path, value]) => [path, identity(Buffer.from(value))])));
	for(const [path, original] of Object.entries(payload))
	{
		await rm(join(root, path)); await assert.rejects(verifyNominalSubtypeJvmDeployment(root, context));
		await saveLakeFile(root, path, original + "changed"); await assert.rejects(verifyNominalSubtypeJvmDeployment(root, context));
		await saveLakeFile(root, path, original);
	}
	for(const path of [source, "extra.class", "extra/Injected.class"])
	{
		await saveLakeFile(root, path, "unrecorded"); await assert.rejects(verifyNominalSubtypeJvmDeployment(root, context));
		await rm(join(root, path));
	}
	const link = join(root, "injected.jar");
	await symlink(join(root, "component.jar"), link); await assert.rejects(verifyNominalSubtypeJvmDeployment(root, context));
	await rm(link);
	await assert.rejects(verifyNominalSubtypeJvmDeployment(root, { ...context, interpreterSha256: "0".repeat(64) }));
	assert.deepEqual(await verifyNominalSubtypeJvmDeployment(root, context), before);
	const changes = [item => { item.profile = "unknown"; }
		, item => { delete item.files[source]; }
		, item => { item.files["component.jar"].sha256 = "0".repeat(64); }
		, item => { item.files["component.jar"].bytes = -1; }
		, item => { item.files["extra.class"] = item.files["component.jar"]; }];
	for(const change of changes)
	{
		const changed = structuredClone(context); change(changed);
		assert.throws(() => nominalSubtypeJvmDeploymentFiles(changed));
	}
});
