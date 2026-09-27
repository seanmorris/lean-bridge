/**
 * Mutate native resources in actual Maven JAR copies, preserving original files.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { createDeterministicZip } from "../../src/release/deterministic-zip.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { javaCompilerOptions } from "./type-corpus-jvm-tools.mjs";

/**
 * Reject missing or replaced native resources even when an identical package is
 * already loaded by another classloader. Recompute the mutable archive receipt
 * to check the hashes embedded in the compiled classes, not that JSON alone.
 *
 * @param input - Offline-installed package inspection context.
 * @param input.project - Private consumer project.
 * @param input.extracted - Authenticated original JAR contents.
 * @param input.installedJar - Original Maven-installed archive.
 * @param input.receipt - Original package inventory.
 * @param input.classpath - Resolved offline Maven classpath.
 * @param input.tools - Selected Java compiler and runtime tools.
 */
export const inspectOwnedJvmInstalledAssets = async ({ project, extracted, installedJar, receipt, classpath, tools }) => {
	const root = join(project, "owned-asset-inspection"), classes = join(root, "classes");
	const temp = join(root, "native-temp"), runtime = join(root, "runtime-only");
	await mkdir(temp, { recursive: true });
	const probe = await readFile("tests/fixtures/structured-types/OwnedInstalledAssetsProbe.java", "utf8");
	await saveLakeFile(root, "OwnedInstalledAssetsProbe.java", probe);
	await saveLakeFile(root, "Wire.java", await readFile("tests/fixtures/type-corpus/consumers/Wire.java"));
	await runCopied(tools.javac, [...javaCompilerOptions, "-d", classes, "OwnedInstalledAssetsProbe.java", "Wire.java"], root);
	await runCopied(tools.jlink, ["--module-path", join(tools.jdk, "jmods")
		, "--add-modules", "java.base", "--no-header-files", "--no-man-pages"
		, "--output", runtime], root);
	const stdlib = classpath.split(":").find(path => path.endsWith("/kotlin-stdlib-2.2.0.jar"));
	assert.ok(stdlib);
	const libraries = Object.entries(receipt.files).filter(([path]) => path.startsWith("META-INF/lean-bridge/native/linux-x64/"));
	assert.equal(libraries.length, 5);
	const originals = Object.fromEntries(libraries.map(([path, value]) => [basename(path), value.sha256]));
	const scenarios = [];
	for(const [path] of libraries) for(const mutation of ["missing", "tampered"])
	{
		const changed = join(root, "changed"), jar = join(root, "changed.jar");
		await cp(extracted, changed, { recursive: true });
		const forged = structuredClone(receipt);
		if(mutation === "missing")
		{
			await rm(join(changed, path)); delete forged.files[path];
		}
		else
		{
			const bytes = Buffer.from("altered native payload\n");
			await saveLakeFile(changed, path, bytes);
			forged.files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		}
		await saveLakeFile(changed, "META-INF/lean-bridge/package-receipt.json", canonicalJson(forged));
		const archive = await createDeterministicZip({ directory: changed, sourceDateEpoch: 315532800 });
		await saveLakeFile(root, "changed.jar", archive);
		await rm(changed, { recursive: true, force: true });
		const expected = mutation === "missing" ? "Missing packaged native asset " : "Packaged native library differs from compiled evidence: ";
		for(const profile of ["java", "kotlin"]) for(const mode of ["cold", "warm"])
		{
			assert.deepEqual(await readdir(temp), []);
			const result = await runCopied(join(runtime, "bin/java"), [
				"--enable-native-access=ALL-UNNAMED", "-Djava.io.tmpdir=" + temp
				, "-cp", classes, "OwnedInstalledAssetsProbe"
				, receipt.namespace, profile, mode
				, installedJar, jar, stdlib, expected + basename(path)
			], root, { ...copiedCleanEnvironment, JAVA_HOME: runtime });
			assert.equal(result.stderr, "");
			const observation = JSON.parse(result.stdout);
			assert.equal(observation.profile, profile); assert.equal(observation.mode, mode);
			assert.equal(observation.rejected, true);
			assert.deepEqual(observation.nativeLibraries, mode === "warm" ? originals : {});
			assert.deepEqual(await readdir(temp), []);
			scenarios.push({ path, mutation, archiveSha256: sha256(archive), ...observation });
		}
		await rm(jar);
	}
	await rm(root, { recursive: true, force: true });
	return { originalArchiveSha256: sha256(await readFile(installedJar))
		, probeSha256: sha256(probe)
		, recomputedMutableReceipt: true, runtimeOnlyExecution: true
		, normalExitCleanup: true, scenarios };
};
