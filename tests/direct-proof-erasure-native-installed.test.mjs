/**
 * Source-free ordinary and reviewed C/C++ acceptance for direct proof erasure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, lstat, mkdir, mkdtemp, readFile, rename, rm
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import {
	copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied
} from "./helpers/copied-fixture-install.mjs";
import { verifyFinContainerEdgeArchiveClosure } from "./helpers/fin-container-edge-closure.mjs";
import {
	assertDirectProofErasureBundle, prepareDirectProofErasureProject
} from "./helpers/direct-proof-erasure-packages.mjs";
import { directProofErasureNativeProfiles } from "./helpers/direct-proof-erasure-native-report.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { retainPackageSetEvidence } from "./helpers/package-set.mjs";

const flag = process.env.LEAN_BRIDGE_DIRECT_PROOF_NATIVE_TEST;
assert.ok(flag === undefined || ["0", "1"].includes(flag)
	, "Invalid LEAN_BRIDGE_DIRECT_PROOF_NATIVE_TEST");
const enabled = flag === "1";
const routes = process.env.LEAN_BRIDGE_DIRECT_PROOF_NATIVE_ROUTES?.split(",")
	?? ["ordinary", "reviewed"];
assert.ok(routes.length
	&& routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);
const outputFor = route => resolve((
	process.env.LEAN_BRIDGE_DIRECT_PROOF_NATIVE_OUTPUT
		?? "build/direct-proof-erasure-native/{route}"
).replace("{route}", route));
const profileSource = profile =>
	`tests/fixtures/direct-proof-erasure-consumers/${profile}.${profile}`;
const negativeSource = profile => profile === "c"
	? `#include "directprooferasure.h"
int main(void) {
  uint32_t output = 0;
  directprooferasure_error error = {0};
  return (int)directprooferasure_keep(true, 0, &output, &error);
}
`
	: `#include "directprooferasure.hpp"
namespace api = lean_bridge::directprooferasure;
int main() { return (int)api::keep(true, 0); }
`;

for(const route of routes) test(
	`installed direct proof-erasure native packages reproduce and relocate ${route}`
	, { skip: !enabled, timeout: 3_600_000 }, async t => {
		const records = outputFor(route);
		await assert.rejects(access(records), { code: "ENOENT" });
		await mkdir(records, { recursive: true });
		const suite = await mkdtemp(join(tmpdir(), "lean-bridge-direct-proof-native-"));
		t.after(() => rm(suite, { recursive: true, force: true }));
		const environment = {
			...nativeFixtureEnvironment(directProofErasureNativeProfiles)
			, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.38"
		};
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"])
			.toString().trim();
		const builds = [], handoff = join(records, "handoff");
		let receipt;
		for(const attempt of [0, 1])
		{
			const prepared = await prepareDirectProofErasureProject(t, {
				route, profiles: directProofErasureNativeProfiles
			});
			const before = await lakeInputState(prepared.projectRoot);
			const outputRoot = join(prepared.directory, "release");
			const built = await buildCanonicalProject({
				projectRoot: prepared.projectRoot, outputRoot
				, targets: directProofErasureNativeProfiles, environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			const bundleRoot = join(outputRoot, "bundle");
			const bundle = await assertDirectProofErasureBundle(bundleRoot);
			await verifyPackageSetReceipt({
				receiptPath: join(outputRoot, "package-set-receipt.json")
			});
			assert.deepEqual(await lakeInputState(prepared.projectRoot), before);
			const receiptBytes = await readFile(
				join(outputRoot, "package-set-receipt.json")
			);
			const value = JSON.parse(receiptBytes);
			const archives = Object.fromEntries(value.packages
				.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))
				.sort(([left], [right]) => left.localeCompare(right)));
			const fact = {
				...bundle, bindingIrSha256: built.bindingIrSha256
				, packageSetReceiptSha256: sha256(receiptBytes), archives
			};
			for(const [name, path] of [
				["binding-ir.json", "binding/binding-ir.json"]
				, ["compiler-adapters.json", "locks/compiler-adapters.json"]
				, ["component-build-plan.json", "locks/component-build-plan.json"]
				, ["LeanBridgeGenerated.lean", "generated/LeanBridgeGenerated.lean"]
				, ["provenance.json", "metadata/provenance.json"]
			]) await saveLakeFile(records, `build-${attempt}/${name}`
				, await readFile(join(bundleRoot, path)));
			await saveLakeFile(records, `build-${attempt}/package-set-receipt.json`
				, receiptBytes);
			await saveLakeFile(records, `build-${attempt}/configuration.json`
				, canonicalJson(prepared.configuration));
			await saveLakeFile(records, `build-${attempt}/DirectProofErasure.lean`
				, await readFile(join(prepared.projectRoot, "DirectProofErasure.lean")));
			if(attempt === 0)
			{
				const retained = await retainPackageSetEvidence(outputRoot, handoff);
				receipt = retained.receipt;
			}
			builds.push(fact);
			await rm(prepared.directory, { recursive: true, force: true });
			await assert.rejects(lstat(prepared.directory), { code: "ENOENT" });
		}
		assert.deepEqual(builds[1], builds[0]);
		await verifyPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		const consumerRoot = join(suite, "consumers"), observations = [];
		for(const profile of directProofErasureNativeProfiles)
		{
			const packages = receipt.packages.filter(item => item.target === profile);
			assert.equal(packages.length, 1);
			const pkg = packages[0];
			const source = await readFile(profileSource(profile), "utf8");
			const observation = await installCopiedConsumer({
				profile, consumer: consumerRoot, handoff, packages, environment
				, fixture: {
					source: () => source, success: `direct-proof-${profile}`
					, expectedChecks: 1005
					, verifyInstalledPackage: verifyFinContainerEdgeArchiveClosure
				}
			});
			delete observation.command;
			const root = join(consumerRoot, profile);
			const executableSha256 = sha256(await readFile(join(root, "consumer")));
			const relocated = join(consumerRoot, `${profile}-relocated`);
			await rename(root, relocated);
			await assert.rejects(access(root), { code: "ENOENT" });
			const installed = join(relocated
				, `${pkg.name}-${pkg.version}-${profile}`);
			const closure = await verifyFinContainerEdgeArchiveClosure({
				profile, installed, receiptPath: "lean-bridge-package.json"
				, archive: join(handoff, pkg.artifacts[0].path)
				, archiveSha256: pkg.artifacts[0].sha256
			});
			const extension = profile, headerName
				= `directprooferasure.h${profile === "cpp" ? "pp" : ""}`;
			const header = await readFile(join(installed, "include", headerName));
			assert.doesNotMatch(header.toString()
				, /(?:\bTrue\b|\bproof\b|_before|_after)/iu);
			const expectedHeader = profile === "c"
				? /directprooferasure_status directprooferasure_keep\(uint32_t value, uint32_t \*out, directprooferasure_error \*error\);/u
				: /inline uint32_t keep\(uint32_t value\)/u;
			assert.match(header.toString(), expectedHeader);
			const run = await runCopied(join(relocated, "consumer"), [], relocated, {
				...copiedCleanEnvironment, LD_LIBRARY_PATH: join(installed, "lib")
			});
			assert.equal(run.stderr, "");
			assert.equal(run.stdout, `direct-proof-${profile}:1005\n`);
			assert.equal(sha256(await readFile(join(relocated, "consumer")))
				, executableSha256);
			assert.equal(await readFile(join(relocated, `consumer.${extension}`), "utf8")
				, source);
			const invalid = negativeSource(profile);
			await saveLakeFile(relocated, `proof-argument-negative.${extension}`, invalid);
			let diagnostic = "";
			await assert.rejects(runCopied(
				profile === "c" ? "/usr/bin/cc" : "/usr/bin/c++"
				, [`-std=${profile === "c" ? "c11" : "c++20"}`
					, "-Wall", "-Wextra", "-Werror", "-fsyntax-only"
					, "-I", join(installed, "include")
					, `proof-argument-negative.${extension}`]
				, relocated, { ...copiedCleanEnvironment, PATH: join(relocated, "tools") }
			), error => {
				diagnostic = error.details?.stderr ?? "";
				assert.match(diagnostic
					, /(?:too many arguments|no matching function|requires 1 argument|candidate)/iu);
				return true;
			});
			await saveLakeFile(records, `${profile}/consumer.${extension}`, source);
			await saveLakeFile(records, `${profile}/${headerName}`, header);
			await saveLakeFile(records
				, `${profile}/proof-argument-negative.${extension}`, invalid);
			observations.push({
				profile, checks: observation.checks
				, offlineInstall: observation.offlineInstall
				, compilerFreePath: observation.compilerFreePath
				, runtimeParameters: 1, proofSlots: 0
				, consumerSha256: sha256(source), headerSha256: sha256(header)
				, executableSha256
				, ...closure
				, executions: [
					{ checks: 1005, relocated: false }
					, { checks: 1005, relocated: true }
				]
				, negativeProofArgument: {
					rejected: true, relocated: true
					, diagnostic: diagnostic.replaceAll(relocated, "<consumer>")
				}
			});
		}
		const report = {
			schemaVersion: 1, route, profiles: directProofErasureNativeProfiles
			, producerCommit, builds, receipt, observations
			, reproducible: true, independentBuilds: 2
			, authorInputsUnchanged: true, sourceRemovedBeforeInstallation: true
			, offlineInstall: true, compilerFreePath: true
			, relocatedInstallation: true
		};
		await saveLakeFile(records, "report.json", canonicalJson(report));
	}
);
