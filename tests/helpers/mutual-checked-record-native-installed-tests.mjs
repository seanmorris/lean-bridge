/**
 * Reproducible, source-free C/C++ acceptance for a mutually recursive checked record.
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
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied
} from "./copied-fixture-install.mjs";
import { verifyFinContainerEdgeArchiveClosure } from "./fin-container-edge-closure.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import {
	mutualCheckedRecordConfiguration, mutualCheckedRecordFixtureRoot
	, mutualCheckedRecordModule, mutualCheckedRecordReview
} from "./mutual-checked-record-fixture.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";

const flag = "LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_NATIVE_TEST";
if(process.env[flag] !== undefined) assert.ok(["0", "1"].includes(process.env[flag]), `Invalid ${flag}`);
const enabled = process.env[flag] === "1";
const routes = (process.env.LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_NATIVE_ROUTES ?? "ordinary,reviewed")
	.split(",").filter(Boolean);
assert.ok(routes.length > 0 && new Set(routes).size === routes.length
	&& routes.every(route => ["ordinary", "reviewed"].includes(route))
, "Invalid mutual checked-record native routes");
const profiles = ["c", "cpp"];
const expectedChecks = { c: 71, cpp: 23 };

const sourceFor = async profile => {
	const source = await readFile(`tests/fixtures/mutual-checked-record-consumers/${profile}.${profile}`, "utf8");
	return `#define MUTUAL_CHECKED_PARAMETER "arg0"\n${source}`;
};
const parseResult = (stdout, profile) => {
	const match = /^mutual-checked-record-ok:([0-9]+)\n$/u.exec(stdout);
	assert.ok(match, `${profile} mutual checked-record result`);
	return { checks: Number(match[1]) };
};

for(const route of routes) test(
	`installed mutual checked-record C/C++ packages reproduce and relocate ${route}`,
	{ skip: !enabled, timeout: 3_600_000 }, async t => {
		const output = resolve(process.env.LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_NATIVE_OUTPUT
			?? "build/mutual-checked-record-native", route);
		await assert.rejects(access(output), { code: "ENOENT" });
		await mkdir(output, { recursive: true });
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-mutual-checked-record-native-"));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(`Retained failed mutual checked-record inputs: ${root}`);
		});
		const expected = mutualCheckedRecordReview();
		const configuration = mutualCheckedRecordConfiguration(route);
		const environment = {
			...nativeFixtureEnvironment(profiles)
			, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR:
				process.env.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38"
		};
		const consumer = join(root, "consumer"), handoff = join(consumer, "handoff");
		const builds = [];
		for(const attempt of [0, 1])
		{
			const author = join(root, `author-${attempt}`);
			const projectRoot = join(author, "project"), outputRoot = join(author, "release");
			await cp(mutualCheckedRecordFixtureRoot, projectRoot, { recursive: true });
			await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
			if(route === "reviewed")
				await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
			const sourceBefore = await lakeInputState(projectRoot);
			t.diagnostic(`${route} native author ${attempt}: ${profiles.join(", ")}`);
			const built = await buildCanonicalProject({
				projectRoot, outputRoot, targets: profiles, environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			assert.deepEqual(await lakeInputState(projectRoot), sourceBefore
				, "Author source remains unchanged");
			const modelBytes = await readFile(join(outputRoot, "native/component/model.json"));
			const model = JSON.parse(modelBytes);
			assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
			if(route === "reviewed")
				assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
			else assert.ok(!model.sourceIdentity.reviewedBindingIr);
			const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json"));
			const receipt = JSON.parse(receiptBytes);
			await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
			assert.deepEqual(receipt.packages.map(pkg => pkg.target).sort(), [...profiles].sort());
			builds.push({
				bindingIrSha256: built.bindingIrSha256, modelSha256: sha256(modelBytes)
				, receiptSha256: sha256(receiptBytes)
				, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
					pkg.artifacts.map(artifact => [artifact.path, artifact.sha256])))
			});
			await saveLakeFile(output, `build-${attempt}/model.json`, modelBytes);
			await saveLakeFile(output, `build-${attempt}/package-set-receipt.json`, receiptBytes);
			await saveLakeFile(output, `build-${attempt}/author-inputs.json`, canonicalJson(sourceBefore));
			for(const name of [
				`${mutualCheckedRecordModule}.lean`, "lean-bridge.exports.json"
				, ...route === "reviewed" ? ["api.binding-ir.json"] : []
			]) await saveLakeFile(output, `build-${attempt}/${name}`, await readFile(join(projectRoot, name)));
			if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
			await rm(author, { recursive: true });
			await assert.rejects(access(author), { code: "ENOENT" });
		}
		assert.deepEqual(builds[1], builds[0]
			, "Independent author roots reproduce models, receipts and archives");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
		const reports = [];
		for(const profile of profiles)
		{
			const packages = receipt.packages.filter(pkg => pkg.target === profile);
			assert.equal(packages.length, 1); assert.equal(packages[0].role, "component");
			const source = await sourceFor(profile);
			const fixture = {
				source: () => source, expectedChecks: expectedChecks[profile]
				, parseResult: stdout => parseResult(stdout, profile)
				, verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure
			};
			const observation = await installCopiedConsumer({
				profile, consumer, handoff, packages, environment, fixture
			});
			const installedRoot = join(consumer, profile);
			const relocated = `${installedRoot}-relocated`;
			const pkg = packages[0], packageName = `${pkg.name}-${pkg.version}-${profile}`;
			await rename(installedRoot, relocated);
			await assert.rejects(access(installedRoot), { code: "ENOENT" });
			const installed = join(relocated, packageName);
			const closure = await verifyFinContainerEdgeArchiveClosure({
				profile, installed, receiptPath: "lean-bridge-package.json"
				, archive: join(handoff, pkg.artifacts[0].path)
				, archiveSha256: pkg.artifacts[0].sha256
			});
			const replay = await runCopied(join(relocated, "consumer"), [], relocated, {
				...copiedCleanEnvironment, LD_LIBRARY_PATH: join(installed, "lib")
			});
			assert.equal(replay.stderr, "");
			assert.deepEqual(parseResult(replay.stdout, profile), observation.result);
			assert.equal(await readFile(join(relocated, `consumer.${profile}`), "utf8"), source);
			const report = {
				profile, route, packages, checks: observation.checks
				, consumerSha256: observation.consumerSha256
				, relocatedReplay: replay, closure
				, sourceRemovedBeforeInstallation: true, offlineInstall: true
				, compilerFreeReplay: true, immutableCallerAssertions: true
				, malformedDepthCycleRecovery: true
			};
			reports.push(report);
			await saveLakeFile(output, `consumers/${profile}.${profile}`, source);
			await saveLakeFile(output, `${profile}/report.json`, canonicalJson(report));
		}
		await copyPackageSetHandoff(handoff, join(output, "handoff"));
		await saveLakeFile(output, "report.json", canonicalJson({
			schemaVersion: 1, route, profiles, builds, reports
			, producerCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
			, expectedBindingIrSha256: hashBindingIr(expected)
			, reproducible: true, independentBuilds: 2
			, relocated: true, sourceFree: true
		}));
		complete = true;
	}
);
