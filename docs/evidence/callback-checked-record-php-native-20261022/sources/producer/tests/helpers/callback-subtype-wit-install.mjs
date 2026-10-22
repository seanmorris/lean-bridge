/**
 * Close a generic WIT installation into a relocated, source-free runtime.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, readFile, readdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeArtifactPaths, verifyNativeFiles } from "../../src/build/native-artifacts.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";

const digest = async path => sha256(await readFile(path));

/**
 * Remove every compiler input and the release handoff before two runtime replays.
 *
 * @param options - The completed generic installation and its authenticated package.
 * @param options.consumer - Parent directory containing the generic installation.
 * @param options.handoff - Authenticated release handoff removed before replay.
 * @param options.pkg - Package-set component entry consumed by the installation.
 * @param options.relocated - New source-free deployment root.
 * @param options.expectedChecks - Exact independent-consumer check count.
 */
export const closeCallbackSubtypeWit = async options => {
	const { consumer, handoff, pkg, relocated, expectedChecks = 26 } = options;
	assert.ok(Number.isSafeInteger(expectedChecks) && expectedChecks > 0);
	const root = join(consumer, "wit-wasi");
	const packageName = `${pkg.name}-${pkg.version}-wit-wasi`;
	const installed = join(root, packageName);
	const receiptPath = join(installed, "lean-bridge-package.json");
	const receiptBytes = await readFile(receiptPath);
	const receipt = JSON.parse(receiptBytes);
	assert.equal(receiptBytes.toString(), canonicalJson(receipt));
	assert.equal(receipt.kind, "lean-bridge-ordinary-wit-package");
	assert.equal(receipt.ecosystem, "wit-wasi");
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.deepEqual(await nativeArtifactPaths(installed), [...Object.keys(receipt.files), "lean-bridge-package.json"].sort());
	await verifyNativeFiles(installed, receipt.files);
	const libraries = Object.fromEntries(Object.entries(receipt.files)
		.filter(([path]) => /^lib\/[^/]+\.so(?:\.[0-9]+)*$/u.test(path)));
	assert.ok(Object.keys(libraries).length > 1);
	const binary = join(root, "consumer");
	const runpath = `$ORIGIN/${packageName}/lib`;
	const dynamic = (await runCopied("/usr/bin/readelf", ["--dynamic", binary], root)).stdout;
	assert.deepEqual([...dynamic.matchAll(/\((?:RUNPATH|RPATH)\)[^\n]*\[([^\]]*)\]/gu)].map(match => match[1]), [runpath]);
	const executableSha256 = await digest(binary);
	await rm(join(root, "consumer.c"));
	await rm(join(root, "tools"), { recursive: true });
	await rm(handoff, { recursive: true, force: true });
	await rename(root, relocated);
	await assert.rejects(access(root), { code: "ENOENT" });
	await assert.rejects(access(handoff), { code: "ENOENT" });
	assert.deepEqual((await readdir(relocated)).sort(), ["consumer", packageName].sort());
	assert.deepEqual(await nativeArtifactPaths(relocated), ["consumer"
		, ...[...Object.keys(receipt.files), "lean-bridge-package.json"].map(path => `${packageName}/${path}`)].sort());
	const observations = [];
	for(let attempt = 0; attempt < 2; attempt++)
	{
		const result = await runCopied(join(relocated, "consumer"), [], relocated, copiedCleanEnvironment);
		assert.equal(result.stderr, "");
		const observation = JSON.parse(result.stdout);
		assert.equal(observation.checks, expectedChecks);
		const expected = Object.keys(libraries).map(path => join(relocated, packageName, path)).sort();
		assert.deepEqual(observation.loadedLibraries.filter(path => path.startsWith(`${relocated}/`)).sort(), expected);
		observations.push(observation);
	}
	assert.deepEqual(observations[0], observations[1]);
	await verifyNativeFiles(join(relocated, packageName), receipt.files);
	assert.equal(await digest(join(relocated, "consumer")), executableSha256);
	return { handoffRemovedBeforeReplay: true
		, libraryClosureSha256: sha256(canonicalJson(libraries))
		, packageFileSetSha256: sha256(canonicalJson(receipt.files))
		, relocatedReplay: true, repeatExecution: true
		, runtimeOnly: true, sourceFreeExecution: true };
};
