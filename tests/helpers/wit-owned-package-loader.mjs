/**
 * Reject mismatched installed libraries before entering native Lean or Wasmtime.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

/**
 * Probe all five dependency identities under local and global symbol visibility.
 *
 * @param options - Relocated installation and isolated consumer compiler settings.
 * @param options.root - Task-owned consumer test directory.
 * @param options.installed - Relocated installed owned WIT archive.
 * @param options.environment - Compiler environment without Lean or producer SDKs.
 * @param options.manifest - Verified installed package inventory.
 */
export const checkOwnedWitInstalledDependencies = async ({ root, installed, environment, manifest }) => {
	const duplicate = join(root, "duplicate-package"); await cp(installed, duplicate, { recursive: true });
	const source = await readFile("tests/fixtures/structured-types/wit-owned-package-loader.c");
	await saveLakeFile(root, "loader.c", source);
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror"
		, "-UNDEBUG", "-I", join(installed, "include"), "loader.c"
		, "-ldl", "-o", "loader"], root, environment);
	const reports = [], library = "lib/libowned_aggregates_wasmtime.so";
	const run = async (visibility, dependency = "none") => {
		const result = await runCopied(join(root, "loader"), [visibility
			, join(installed, library), join(duplicate, library), dependency], root);
		assert.equal(result.stderr, ""); const report = JSON.parse(result.stdout);
		assert.equal(report.conflict, dependency !== "none"); assert.ok(report.checks > 10);
		return report;
	};
	for(const visibility of ["local", "global"])
		reports.push({ visibility, compatibleAndFork: true, ...await run(visibility) });
	for(const dependency of manifest.dependencies)
	{
		const path = join(duplicate, "lib", dependency.name), bytes = await readFile(path);
		assert.equal(sha256(bytes), dependency.sha256);
		await saveLakeFile(duplicate, `lib/${dependency.name}`, Buffer.concat([bytes, Buffer.from([1])]));
		for(const visibility of ["local", "global"])
			reports.push({ visibility, tamperedDependency: dependency.name, ...await run(visibility, path) });
		await saveLakeFile(duplicate, `lib/${dependency.name}`, bytes);
	}
	assert.equal(reports.length, 12);
	await verifyNativeFiles(duplicate, manifest.files); await verifyNativeFiles(installed, manifest.files);
	const evidence = { sourceSha256: sha256(source), executableSha256: sha256(await readFile(join(root, "loader"))), reports };
	await rm(duplicate, { recursive: true, force: true });
	return evidence;
};
