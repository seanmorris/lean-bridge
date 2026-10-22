/**
 * Reproduce, install offline and relocate dependent checked records in C/C++.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, cp, mkdir, mkdtemp, readFile, rename, rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	readVerifiedPackageSetReceipt, verifyPackageSetReceipt
} from "../../src/release/package-set-receipt.mjs";
import {
	copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment
	, runCopied
} from "./copied-fixture-install.mjs";
import {
	dependentCheckedRecordFixture
} from "./dependent-checked-record-browser-fixture.mjs";
import {
	dependentCheckedRecordNativeCaller
	, dependentCheckedRecordNativeProfiles
	, dependentCheckedRecordNativeRoutes
	, dependentCheckedRecordNativeSelection
} from "./dependent-checked-record-native-fixture.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { refinementEngineTransport } from "./refinement-engine.mjs";

const flag = "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NATIVE_TEST";
if(process.env[flag] !== undefined)
	assert.ok(["0", "1"].includes(process.env[flag]), `Invalid ${flag}`);
const enabled = process.env[flag] === "1";
const routeVariable = "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NATIVE_ROUTES";
const routes = process.env[routeVariable]?.split(",")
	?? [...dependentCheckedRecordNativeRoutes];
assert.ok(routes.length && new Set(routes).size === routes.length
	&& routes.every(route => dependentCheckedRecordNativeRoutes.includes(route)));
if(process.env[routeVariable] !== undefined)
	assert.ok(enabled, "Explicit dependent native routes require the installed gate");

const fileTree = async directory => Object.fromEntries(await Promise.all(
	(await nativeArtifactPaths(directory)).map(async path => [
		path, sha256(await readFile(join(directory, path)))
	])
));

for(const route of routes) test(
	`installed dependent records reproduce and relocate in C/C++ for ${route}`
	, { skip: !enabled, timeout: 7_200_000 }, async t => {
	const output = resolve(
		process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_NATIVE_OUTPUT
			?? "build/dependent-checked-record-native", route
	);
	await assert.rejects(access(output), { code: "ENOENT" });
	await mkdir(output, { recursive: true });
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-dependent-record-native-"
	));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true });
		else t.diagnostic(`Retained failed dependent native inputs: ${root}`);
	});
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"]
		, { encoding: "utf8" }).trim();
	assert.doesNotThrow(() => execFileSync(
		"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
	), "Installed evidence requires clean tracked source");
	const environment = {
		...nativeFixtureEnvironment(dependentCheckedRecordNativeProfiles)
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR:
			process.env.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.36"
	};
	const selection = dependentCheckedRecordNativeSelection(route);
	await saveLakeFile(output, "configuration.json"
		, canonicalJson(selection.configuration));
	await saveLakeFile(output, "expected.binding-ir.json"
		, canonicalJson(selection.expected));
	const handoff = join(root, "handoff"), builds = [];
	for(const attempt of [0, 1])
	{
		const author = join(root, `author-${attempt}`);
		const projectRoot = join(author, "project");
		const outputRoot = join(author, "release");
		const record = join(output, `build-${attempt}`);
		await cp(dependentCheckedRecordFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json"
			, canonicalJson(selection.configuration));
		if(selection.reviewed)
			await saveLakeFile(projectRoot, "api.binding-ir.json"
				, canonicalJson(selection.expected));
		const sourceBefore = await lakeInputState(projectRoot);
		const stable = sourceBefore.map(({ path, mode, sha256: digest }) => ({
			path, mode, sha256: digest
		}));
		t.diagnostic(`${route} dependent native author ${attempt}`);
		const built = await buildCanonicalProject({
			projectRoot, outputRoot, engineRoot: process.cwd()
			, targets: dependentCheckedRecordNativeProfiles, environment
			, runner: refinementEngineTransport()
		}).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`;
			throw error;
		});
		assert.deepEqual(await lakeInputState(projectRoot), sourceBefore);
		const modelBytes = await readFile(join(
			outputRoot, "native/component/model.json"
		));
		const model = JSON.parse(modelBytes);
		assert.equal(reviewedContractDifference(
			selection.expected, model.bindingIr
		), null);
		const receiptPath = join(outputRoot, "package-set-receipt.json");
		await verifyPackageSetReceipt({ receiptPath });
		const receiptBytes = await readFile(receiptPath);
		const receipt = JSON.parse(receiptBytes);
		assert.deepEqual(receipt.packages.map(pkg => pkg.target).sort()
			, dependentCheckedRecordNativeProfiles);
		await saveLakeFile(record, "model.json", modelBytes);
		await saveLakeFile(record, "package-set-receipt.json", receiptBytes);
		await saveLakeFile(record, "author-inputs.json", canonicalJson(sourceBefore));
		for(const name of [
			"DependentRecords.lean", "lean-bridge.exports.json"
			, ...selection.reviewed ? ["api.binding-ir.json"] : []
		]) await saveLakeFile(record, name
			, await readFile(join(projectRoot, name)));
		builds.push({
			authorInputsSha256: sha256(canonicalJson(stable))
			, bindingIrSha256: built.bindingIrSha256
			, modelSha256: sha256(modelBytes)
			, receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
				pkg.artifacts.map(artifact => [artifact.path, artifact.sha256])))
		});
		if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
		await rm(author, { recursive: true });
		await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0]);
	const { receipt } = await readVerifiedPackageSetReceipt({
		receiptPath: join(handoff, "package-set-receipt.json")
	});
	const consumer = join(root, "consumer"), reports = [];
	for(const profile of dependentCheckedRecordNativeProfiles)
	{
		const caller = await dependentCheckedRecordNativeCaller(profile, route);
		const packages = receipt.packages.filter(pkg => pkg.target === profile);
		assert.equal(packages.length, 1);
		const observation = await installCopiedConsumer({
			profile, consumer, handoff, packages, environment
			, fixture: {
				source: () => caller.source, wit: []
				, success: "dependent-checked-record-ok"
				, expectedChecks: caller.checks
			}
		});
		const installedRoot = join(consumer, profile), pkg = packages[0];
		const installedPackage = join(installedRoot
			, `${pkg.name}-${pkg.version}-${profile}`);
		const installedTree = await fileTree(installedPackage);
		const installedReplay = await runCopied(
			observation.command, [], installedRoot, {
				...copiedCleanEnvironment
				, LD_LIBRARY_PATH: join(installedPackage, "lib")
			}
		);
		assert.equal(installedReplay.stderr, "");
		assert.equal(installedReplay.stdout
			, `dependent-checked-record-ok:${caller.checks}\n`);
		const relocated = join(consumer, `${profile}-relocated`);
		await rename(installedRoot, relocated);
		await assert.rejects(access(installedRoot), { code: "ENOENT" });
		const relocatedPackage = join(relocated
			, `${pkg.name}-${pkg.version}-${profile}`);
		assert.deepEqual(await fileTree(relocatedPackage), installedTree);
		const replay = await runCopied(join(relocated, "consumer"), [], relocated, {
			...copiedCleanEnvironment
			, LD_LIBRARY_PATH: join(relocatedPackage, "lib")
		});
		assert.equal(replay.stderr, "");
		assert.equal(replay.stdout, installedReplay.stdout);
		assert.equal(await readFile(
			join(relocated, `consumer.${profile}`), "utf8"
		), caller.source);
		const report = {
			schemaVersion: 1, route, profile, packages, checks: caller.checks
			, consumerSha256: observation.consumerSha256, installedTree
			, installedStdoutSha256: sha256(installedReplay.stdout)
			, relocatedStdoutSha256: sha256(replay.stdout)
			, sourceRemovedBeforeInstallation: true
			, offlineInstall: observation.offlineInstall
			, compilerFreePath: observation.compilerFreePath
			, relocatedInstallation: true, repeatExecution: true
			, callerInputsUnchanged: true, nativePayloadUnchanged: true
		};
		reports.push(report);
		await saveLakeFile(output, `consumers/${profile}.${profile}`, caller.source);
		await saveLakeFile(output, `${profile}/report.json`, canonicalJson(report));
	}
	await cp(handoff, join(output, "handoff"), { recursive: true });
	const report = {
		schemaVersion: 1, route, producerCommit
		, configuration: selection.configuration
		, expectedBindingIrSha256: hashBindingIr(selection.expected)
		, builds, receipt, reports, profiles: dependentCheckedRecordNativeProfiles
		, independentBuilds: 2, reproducible: true
		, authorInputsUnchanged: true, sourceCommitClean: true
		, sourceRemovedBeforeInstallation: true, offlineInstall: true
		, compilerFreePath: true, relocatedInstallation: true
		, immutableCallerAssertions: true, relation: "below < bound"
	};
	await saveLakeFile(output, "report.json", canonicalJson(report));
	assert.equal(report.reports.length, 2);
	complete = true;
	}
);
