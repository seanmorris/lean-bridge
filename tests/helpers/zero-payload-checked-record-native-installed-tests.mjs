/**
 * Reproduce, install offline and relocate C/C++ zero-payload packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
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
	verifyFinContainerEdgeArchiveClosure
} from "./fin-container-edge-closure.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { refinementEngineTransport } from "./refinement-engine.mjs";
import {
	zeroPayloadCheckedRecordFixture, zeroPayloadCheckedRecordModule
} from "./zero-payload-checked-record-fixture.mjs";
import {
	parseZeroPayloadNativeResult, zeroPayloadNativeCaller
	, zeroPayloadNativeProfiles, zeroPayloadNativeRoutes
	, zeroPayloadNativeSelection
} from "./zero-payload-checked-record-native-fixture.mjs";
import {
	observeCheckedRecordValueIndexNativeRuntime
} from "./checked-record-value-index-native-runtime.mjs";
import {
	checkZeroPayloadNativeReport, zeroPayloadNativeRecordPaths
} from "./zero-payload-checked-record-native-report.mjs";
import {
	zeroPayloadNativeNegativeControls
} from "./zero-payload-checked-record-native-controls.mjs";

const flag = "LEAN_BRIDGE_ZERO_PAYLOAD_NATIVE_TEST";
if(process.env[flag] !== undefined)
	assert.ok(["0", "1"].includes(process.env[flag]), `Invalid ${flag}`);
const enabled = process.env[flag] === "1";
const routeVariable = "LEAN_BRIDGE_ZERO_PAYLOAD_NATIVE_ROUTES";
const routes = process.env[routeVariable]?.split(",")
	?? [...zeroPayloadNativeRoutes];
assert.ok(routes.length && new Set(routes).size === routes.length
	&& routes.every(route => zeroPayloadNativeRoutes.includes(route)));
if(process.env[routeVariable] !== undefined)
	assert.ok(enabled, "Explicit zero-payload native routes require the installed gate");

const fileTree = async directory => Object.fromEntries(await Promise.all(
	(await nativeArtifactPaths(directory)).map(async path => [
		path, sha256(await readFile(join(directory, path)))
	])
));

for(const route of routes) test(
	`installed zero-payload records reproduce and relocate in C/C++ for ${route}`
	, { skip: !enabled, timeout: 7_200_000 }, async t => {
		const output = resolve(process.env.LEAN_BRIDGE_ZERO_PAYLOAD_NATIVE_OUTPUT
			?? "build/zero-payload-checked-record-native", route);
		await assert.rejects(access(output), { code: "ENOENT" });
		await mkdir(output, { recursive: true });
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-native-"));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(`Retained failed zero-payload native inputs: ${root}`);
		});
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"]
			, { encoding: "utf8" }).trim();
		const consumerCommit = producerCommit;
		assert.doesNotThrow(() => execFileSync(
			"git", ["diff", "--quiet", "HEAD", "--"], { stdio: "ignore" }
		), "Installed evidence requires clean tracked source");
		const environment = {
			...nativeFixtureEnvironment(zeroPayloadNativeProfiles)
			, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR:
				process.env.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.36"
		};
		const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR;
		assert.match(floor, /^2\.[0-9]+$/u);
		const runtime = observeCheckedRecordValueIndexNativeRuntime();
		assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
		assert.match(runtime.glibc, /^2\.[0-9]+$/u);
		assert.ok(Number(runtime.glibc.split(".")[1])
			>= Number(floor.split(".")[1]));
		await saveLakeFile(output, "runtime.json", canonicalJson(runtime));
		const selection = zeroPayloadNativeSelection(route);
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
			await cp(zeroPayloadCheckedRecordFixture, projectRoot, { recursive: true });
			await saveLakeFile(projectRoot, "lean-bridge.exports.json"
				, canonicalJson(selection.configuration));
			if(selection.reviewed)
				await saveLakeFile(projectRoot, "api.binding-ir.json"
					, canonicalJson(selection.expected));
			const sourceBefore = await lakeInputState(projectRoot);
			const stable = sourceBefore.map(({ path, mode, sha256: digest }) => ({
				path, mode, sha256: digest
			}));
			t.diagnostic(`${route} native zero-payload author ${attempt}`);
			const built = await buildCanonicalProject({
				projectRoot, outputRoot, engineRoot: process.cwd()
				, targets: zeroPayloadNativeProfiles, environment
				, runner: refinementEngineTransport()
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			assert.deepEqual(await lakeInputState(projectRoot), sourceBefore
				, "Author source remains unchanged");
			const modelBytes = await readFile(join(outputRoot
				, "native/component/model.json"));
			const model = JSON.parse(modelBytes);
			assert.equal(reviewedContractDifference(selection.expected, model.bindingIr)
				, null);
			const receiptPath = join(outputRoot, "package-set-receipt.json");
			await verifyPackageSetReceipt({ receiptPath });
			const receiptBytes = await readFile(receiptPath);
			const receipt = JSON.parse(receiptBytes);
			assert.deepEqual(receipt.packages.map(pkg => pkg.target).sort()
				, zeroPayloadNativeProfiles);
			await saveLakeFile(record, "model.json", modelBytes);
			await saveLakeFile(record, "package-set-receipt.json", receiptBytes);
			await saveLakeFile(record, "author-inputs.json"
				, canonicalJson(sourceBefore));
			for(const name of [
				`${zeroPayloadCheckedRecordModule}.lean`, "lean-bridge.exports.json"
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
		for(const profile of zeroPayloadNativeProfiles)
		{
			const caller = await zeroPayloadNativeCaller(profile, route);
			const packages = receipt.packages.filter(pkg => pkg.target === profile);
			assert.equal(packages.length, 1);
			const fixture = {
				source: () => caller.source, expectedChecks: caller.checks
				, parseResult: stdout => parseZeroPayloadNativeResult(stdout, caller)
				, verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure
			};
			const observation = await installCopiedConsumer({
				profile, consumer, handoff, packages, environment, fixture
			});
			assert.deepEqual(observation.result, {
				checks: caller.checks, calls: caller.calls
				, rejections: caller.rejections, recoveries: caller.recoveries
			});
			const installedRoot = join(consumer, profile), pkg = packages[0];
			const installed = join(installedRoot
				, `${pkg.name}-${pkg.version}-${profile}`);
			const packageReceiptBytes = await readFile(join(
				installed, "lean-bridge-package.json"));
			const installedReplay = await runCopied(
				observation.command, [], installedRoot, {
					...copiedCleanEnvironment
					, LD_LIBRARY_PATH: join(installed, "lib")
				}
			);
			assert.equal(installedReplay.stderr, "");
			const installedResult = parseZeroPayloadNativeResult(
				installedReplay.stdout, caller);
			const installedTree = await fileTree(installed);
			const relocated = join(consumer, `${profile}-relocated`);
			await rename(installedRoot, relocated);
			await assert.rejects(access(installedRoot), { code: "ENOENT" });
			const relocatedPackage = join(relocated
				, `${pkg.name}-${pkg.version}-${profile}`);
			const closure = await verifyFinContainerEdgeArchiveClosure({
				profile, installed: relocatedPackage
				, receiptPath: "lean-bridge-package.json"
				, archive: join(handoff, pkg.artifacts[0].path)
				, archiveSha256: pkg.artifacts[0].sha256
			});
			assert.deepEqual(await fileTree(relocatedPackage), installedTree);
			const replay = await runCopied(join(relocated, "consumer"), []
				, relocated, {
					...copiedCleanEnvironment
					, LD_LIBRARY_PATH: join(relocatedPackage, "lib")
				}
			);
			assert.equal(replay.stderr, "");
			const relocatedResult = parseZeroPayloadNativeResult(
				replay.stdout, caller);
			assert.equal(await readFile(
				join(relocated, `consumer.${profile}`), "utf8"), caller.source);
			const report = {
				schemaVersion: 1, route, profile, packages
				, consumerSha256: observation.consumerSha256
				, checks: caller.checks, calls: caller.calls
				, rejections: caller.rejections, recoveries: caller.recoveries
				, installed: installedResult, relocated: relocatedResult, closure
				, installedTree, sourceRemovedBeforeInstallation: true
				, offlineInstall: observation.offlineInstall
				, compilerFreePath: observation.compilerFreePath
				, relocatedInstallation: true, immutableCallerAssertions: true
				, repeatExecution: true
			};
			reports.push(report);
			await saveLakeFile(output, `consumers/${profile}.${profile}`
				, caller.source);
			await saveLakeFile(output, `${profile}/lean-bridge-package.json`
				, packageReceiptBytes);
			await saveLakeFile(output, `${profile}/installed.stdout`
				, installedReplay.stdout);
			await saveLakeFile(output, `${profile}/relocated.stdout`, replay.stdout);
			await saveLakeFile(output, `${profile}/report.json`, canonicalJson(report));
		}
		await copyPackageSetHandoff(handoff, join(output, "handoff"));
		const report = {
			schemaVersion: 1, route, producerCommit, consumerCommit, runtime
			, declaredGlibcFloor: floor, configuration: selection.configuration
			, expectedBindingIrSha256: hashBindingIr(selection.expected)
			, builds, receipt, reports, profiles: zeroPayloadNativeProfiles
			, independentBuilds: 2, reproducible: true
			, authorInputsUnchanged: true, sourceCommitClean: true
			, sourceRemovedBeforeInstallation: true, offlineInstall: true
			, compilerFreePath: true, relocatedInstallation: true
			, immutableCallerAssertions: true
			, negativeControls: {
				checkedRefusals: selection.resultOnly ? 0 : 1
				, shapeRefusals: 0, recoveries: selection.resultOnly ? 0 : 1
			}
		};
		await saveLakeFile(output, "report.json", canonicalJson(report));
		assert.equal(report.reports.length, 2);
		for(const item of report.reports)
		{
			assert.deepEqual(item.installed, item.relocated);
			assert.equal(item.offlineInstall, true);
			assert.equal(item.compilerFreePath, true);
			assert.equal(item.relocatedInstallation, true);
		}
		const options = {
			route, producerCommit, consumerCommit, runtime, floor
		};
		const read = path => readFile(join(output, path));
		const accepted = await checkZeroPayloadNativeReport(read, options);
		const expectedPaths = zeroPayloadNativeRecordPaths(route, receipt);
		assert.deepEqual(await nativeArtifactPaths(output), expectedPaths);
		const originals = new Map(await Promise.all(expectedPaths.map(async path => [
			path, await read(path)
		])));
		const controls = await zeroPayloadNativeNegativeControls(originals, options);
		assert.deepEqual(controls.accepted, accepted);
		await saveLakeFile(output, "controls.json", canonicalJson({
			schemaVersion: 1, checkerCommit: producerCommit, ...controls
		}));
		assert.deepEqual(await nativeArtifactPaths(output)
			, [...expectedPaths, "controls.json"].sort());
		complete = true;
	}
);
