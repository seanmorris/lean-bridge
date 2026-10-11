/**
 * Execute complete WIT caller-input snapshots through a source-free installed package.
 * This additive supplement does not replace the existing ten-host edge reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, lstat, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, runCopied } from "./copied-fixture-install.mjs";
import { finContainerEnvironment, finContainerRefinements, finContainerTargets } from "./fin-container-install.mjs";
import { prepareFinContainerEdgeExecutable } from "./fin-container-edge-install.mjs";
import { verifyFinContainerEdgeArchiveClosure, verifyFinContainerEdgeFileClosure } from "./fin-container-edge-closure.mjs";
import { finLateWitChecks, finLateWitConsumer, finLateWitExpected } from "./fin-container-late-wit.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";

const flag = process.env.LEAN_BRIDGE_FIN_LATE_WIT_TEST;
if(flag !== undefined) assert.equal(flag, "1", "Explicit late-WIT selection must be 1");

test("installed WIT late Fin rejection preserves both complete caller inputs and recovers after relocation", { skip: flag !== "1", timeout: 1_800_000 }, async t => {
	const output = resolve(process.env.LEAN_BRIDGE_FIN_LATE_WIT_OUTPUT ?? "build/fin-container-late-wit");
	await assert.rejects(lstat(output), { code: "ENOENT" });
	await mkdir(output, { recursive: true });
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-fin-late-wit-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true });
		else t.diagnostic(`Incomplete late-WIT attempt retained at ${root}`);
	});
	const environment = finContainerEnvironment(["wit-wasi"]);
	await saveLakeFile(output, "context.json", canonicalJson({ root, profile: "wit-wasi", floor: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38", lean: environment.LEAN_BRIDGE_LEAN_PREFIX, wasmtime: environment.LEAN_BRIDGE_WASMTIME_C_API }));
	const handoff = join(root, "handoff"), builds = [];
	for(const attempt of [0, 1])
	{
		const author = join(root, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp("tests/fixtures/onboarding/native-fin-containers", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["FinContainers"], targets: Object.fromEntries([finContainerTargets["wit-wasi"]]) }));
		t.diagnostic(`late-WIT author ${attempt + 1}/2`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["wit-wasi"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json"));
		const model = JSON.parse(modelBytes);
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, item.refinements ?? null])), finContainerRefinements);
		const receipt = JSON.parse(await readFile(join(outputRoot, "package-set-receipt.json")));
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		for(const [name, bytes] of [["model.json", modelBytes]
			, ["package-set-receipt.json", canonicalJson(receipt)]
			, ["FinContainers.lean", await readFile(join(projectRoot, "FinContainers.lean"))]
			, ["lean-bridge.exports.json", await readFile(join(projectRoot, "lean-bridge.exports.json"))]])
			await saveLakeFile(join(output, `author-${attempt}`), name, bytes);
		builds.push({ modelSha256: sha256(modelBytes)
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, receiptSha256: sha256(canonicalJson(receipt))
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))) });
		if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
		await rm(author, { recursive: true });
		await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0], "Independent author roots reproduce package and source identities");
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	assert.equal(receipt.packages.length, 1);
	const source = await finLateWitConsumer();
	await saveLakeFile(output, "consumer.c", source);
	const consumer = join(root, "consumer"), profile = "wit-wasi";
	const observed = await installCopiedConsumer({ profile, consumer, handoff
		, packages: receipt.packages, environment
		, fixture: { source: () => source
			, verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure
			, success: "fin-late-ok", expectedChecks: finLateWitChecks
			, wit: [/label: func\(/u] } });
	const host = join(consumer, profile), pkg = receipt.packages[0], directory = `${pkg.name}-${pkg.version}-${profile}`;
	const installed = join(host, directory), receiptPath = "lean-bridge-package.json";
	const archiveReceipt = await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xOf", join(handoff, pkg.artifacts[0].path), `${directory}/${receiptPath}`], host);
	assert.equal(archiveReceipt.stderr, "");
	const closure = options => verifyFinContainerEdgeFileClosure({ receiptPath, receiptBytes: archiveReceipt.stdout, ...options });
	const before = await closure({ installed });
	await saveLakeFile(output, "installed-receipt.json", archiveReceipt.stdout);
	const executable = await prepareFinContainerEdgeExecutable({ profile, root: host, directory, pkgConfig: `${pkg.name}-wit` });
	const prepared = await runCopied(join(host, "consumer"), [], host, copiedCleanEnvironment);
	assert.equal(prepared.stderr, ""); assert.equal(prepared.stdout, finLateWitExpected);
	await saveLakeFile(output, "before.stdout", prepared.stdout);
	assert.deepEqual(await closure({ installed }), before);
	const relocated = `${host}-relocated`;
	await rename(host, relocated);
	await assert.rejects(access(host), { code: "ENOENT" });
	const movedInstall = join(relocated, directory);
	assert.deepEqual(await closure({ installed: movedInstall }), before);
	assert.equal(sha256(await readFile(join(relocated, "consumer.c"))), sha256(source));
	assert.equal(sha256(await readFile(join(relocated, "consumer"))), executable.executableSha256);
	const repeated = await runCopied(join(relocated, "consumer"), [], relocated, copiedCleanEnvironment);
	assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout, finLateWitExpected);
	await saveLakeFile(output, "relocated.stdout", repeated.stdout);
	assert.deepEqual(await closure({ installed: movedInstall }), before);
	assert.equal(sha256(await readFile(join(relocated, "consumer"))), executable.executableSha256);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	await saveLakeFile(output, "report.json", canonicalJson({ schemaVersion: 1
		, kind: "fin-container-late-wit-v1", profile
		, path: "ordinary-source", builds, packages: receipt.packages
		, checks: finLateWitChecks, snapshotNegativeControls: 11
		, callerSha256: sha256(source)
		, ...executable, ...before
		, reproducible: true, authorRoots: 2, sourceRemovedBeforeInstallation: true
		, offlineInstall: observed.offlineInstall
		, compilerFreePath: observed.compilerFreePath
		, relocatedInstallation: true, installedFilesUnchanged: true
		, callerUnchanged: true, repeatExecution: true
		, rejectionsPerExecution: 1009, recoveriesPerExecution: 1009
		, inputTreesCompared: ["arg0", "arg1"]
		, glibcMinimumVersion: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38"
		, dispatch: { observed: false, reason: "Public rejection, caller preservation and recovery; no entry counters in this supplement." } }));
	complete = true;
});
