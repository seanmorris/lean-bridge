/**
 * Reassembly and re-signed compiler-evidence rejection for recursive CPAN builds.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, rm, symlink, unlink } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { stageCpanPackage, archiveCpanPackage } from "../../src/release/cpan-package.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Restore each test-owned input after corruption; keep original archives intact.
 *
 * @param output - Completed canonical CPAN build.
 * @param packages - Original archive receipts.
 */
export const checkPerlGraphPackageDrift = async (output, packages) => {
	const reassembled = join(output, "reassembled");
	for(const [index, name] of ["runtime", "component"].entries())
	{
		const archived = await archiveCpanPackage({ packageRoot: join(output, "packages", name), outputRoot: reassembled });
		assert.deepEqual(archived.receipt, packages[index]);
		assert.deepEqual(await readFile(archived.path), await readFile(join(output, "archives", packages[index].archive)));
	}
	await rm(reassembled, { recursive: true, force: true });
	const nativeRoot = join(output, "native/component"), runtimeRoot = join(output, "native/runtime");
	const bytes = async path => readFile(join(nativeRoot, path));
	const oldInventory = await bytes("artifacts.json"), oldReceipt = await bytes("native-component.json");
	const inventory = JSON.parse(oldInventory), receipt = JSON.parse(oldReceipt);
	const rejected = [];
	const stage = () => stageCpanPackage({ outputRoot: join(output, "rejected")
		, componentRoot: nativeRoot, runtimeRoot
		, runtimePackageRoot: join(output, "packages/runtime")
		, glibcMinimumVersion: "2.36" });
	for(const [path, field] of [["generated.lean", "adaptersSha256"], ["component.h", "headerSha256"], ["model.json", "modelSha256"]])
	{
		const original = await bytes(path), changed = path === "model.json"
			? canonicalJson({ ...JSON.parse(original), moduleName: "LeanBridge::Runtime" })
			: original.toString() + (path.endsWith(".lean") ? "\n-- Re-signed adapter drift\n" : "\n/* Re-signed header drift */\n");
		const changedReceipt = canonicalJson({ ...receipt, [field]: sha256(changed) });
		await saveLakeFile(nativeRoot, path, changed);
		await saveLakeFile(nativeRoot, "native-component.json", changedReceipt);
		await saveLakeFile(nativeRoot, "artifacts.json", canonicalJson({ ...inventory, files: { ...inventory.files
			, [path]: { bytes: Buffer.byteLength(changed), sha256: sha256(changed) }
			, "native-component.json": { bytes: Buffer.byteLength(changedReceipt), sha256: sha256(changedReceipt) } } }));
		try
		{ await assert.rejects(stage, /compiler metadata|module name/); rejected.push(path); }
		finally
		{
			await saveLakeFile(nativeRoot, path, original);
			await saveLakeFile(nativeRoot, "native-component.json", oldReceipt);
			await saveLakeFile(nativeRoot, "artifacts.json", oldInventory);
			await rm(join(output, "rejected"), { recursive: true, force: true });
		}
	}
	const header = await bytes("component.h"), linked = join(output, "linked-header.h");
	await saveLakeFile(output, "linked-header.h", header);
	await unlink(join(nativeRoot, "component.h")); await symlink(linked, join(nativeRoot, "component.h"));
	try
	{ await assert.rejects(stage, { message: "unsupported native artifact: component.h" }); rejected.push("symlink"); }
	finally
	{
		await unlink(join(nativeRoot, "component.h")); await saveLakeFile(nativeRoot, "component.h", header);
		await unlink(linked); await rm(join(output, "rejected"), { recursive: true, force: true });
	}
	return { deterministicReassembly: true, rejectsResignedSourceDrift: rejected };
};
