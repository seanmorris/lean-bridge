/**
 * Source-free ordinary and reviewed C/C++ acceptance for optional parameters.
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
	copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment
	, runCopied
} from "./helpers/copied-fixture-install.mjs";
import { verifyFinContainerEdgeArchiveClosure } from "./helpers/fin-container-edge-closure.mjs";
import {
	optionalParameterNativeProfiles
} from "./helpers/optional-parameter-native-report.mjs";
import {
	assertOptionalParameterBundle, prepareOptionalParameterProject
} from "./helpers/optional-parameter-packages.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { retainPackageSetEvidence } from "./helpers/package-set.mjs";

const flag = process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_NATIVE_TEST;
assert.ok(flag === undefined || ["0", "1"].includes(flag)
	, "Invalid LEAN_BRIDGE_OPTIONAL_PARAMETER_NATIVE_TEST");
const enabled = flag === "1";
const routes = process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_NATIVE_ROUTES?.split(",")
	?? ["ordinary", "reviewed"];
assert.ok(routes.length
	&& routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);
const outputFor = route => resolve((
	process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_NATIVE_OUTPUT
		?? "build/optional-parameter-native/{route}"
).replace("{route}", route));
const profileSource = profile =>
	`tests/fixtures/optional-parameter-consumers/${profile}.${profile}`;
const checks = Object.freeze({ c: 22, cpp: 21 });
const cppNullSource = `#include "defaults.hpp"
namespace api = lean_bridge::defaults;
int main() { return (int)api::present(nullptr).value_or(0); }
`;

for(const route of routes) test(
	`installed optional-parameter native packages reproduce and relocate ${route}`
	, { skip: !enabled, timeout: 3_600_000 }, async t => {
		const records = outputFor(route);
		await assert.rejects(access(records), { code: "ENOENT" });
		await mkdir(records, { recursive: true });
		const suite = await mkdtemp(join(tmpdir(), "lean-bridge-optional-native-"));
		t.after(() => rm(suite, { recursive: true, force: true }));
		const environment = {
			...nativeFixtureEnvironment(optionalParameterNativeProfiles)
			, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.38"
		};
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"])
			.toString().trim();
		const builds = [], handoff = join(records, "handoff");
		let receipt;
		for(const attempt of [0, 1])
		{
			const prepared = await prepareOptionalParameterProject(t, {
				route, profiles: optionalParameterNativeProfiles
			});
			const before = await lakeInputState(prepared.projectRoot);
			const outputRoot = join(prepared.directory, "release");
			const built = await buildCanonicalProject({
				projectRoot: prepared.projectRoot, outputRoot
				, targets: optionalParameterNativeProfiles, environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			const bundleRoot = join(outputRoot, "bundle");
			const bundle = await assertOptionalParameterBundle(bundleRoot);
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
			await saveLakeFile(records, `build-${attempt}/Defaults.lean`
				, await readFile(join(prepared.projectRoot, "Defaults.lean")));
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
		for(const profile of optionalParameterNativeProfiles)
		{
			const packages = receipt.packages.filter(item => item.target === profile);
			assert.equal(packages.length, 1);
			const pkg = packages[0];
			const source = await readFile(profileSource(profile), "utf8");
			const observation = await installCopiedConsumer({
				profile, consumer: consumerRoot, handoff, packages, environment
				, fixture: {
					source: () => source, success: `optional-parameter-${profile}`
					, expectedChecks: checks[profile]
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
				= `defaults.h${profile === "cpp" ? "pp" : ""}`;
			const header = await readFile(join(installed, "include", headerName));
			const expectedHeader = profile === "c"
				? /#define defaults_present\(\.\.\.\).*defaults_present_default_0/u
				: /inline std::optional<uint32_t> present\(std::optional<uint32_t> const& value0 =/u;
			assert.match(header.toString(), expectedHeader);
			const run = await runCopied(join(relocated, "consumer"), [], relocated, {
				...copiedCleanEnvironment, LD_LIBRARY_PATH: join(installed, "lib")
			});
			assert.equal(run.stderr, "");
			assert.equal(run.stdout
				, `optional-parameter-${profile}:${checks[profile]}\n`);
			assert.equal(sha256(await readFile(join(relocated, "consumer")))
				, executableSha256);
			assert.equal(await readFile(join(relocated, `consumer.${extension}`), "utf8")
				, source);
			let explicitHostNull;
			if(profile === "c") explicitHostNull = {
				mode: "runtime", rejected: true
				, status: "DEFAULTS_STATUS_INVALID_ARGUMENT"
			};
			else
			{
				await saveLakeFile(relocated, "explicit-null-negative.cpp", cppNullSource);
				let diagnostic = "";
				await assert.rejects(runCopied(
					"/usr/bin/c++", ["-std=c++20", "-Wall", "-Wextra"
						, "-Werror", "-fsyntax-only", "-I", join(installed, "include")
						, "explicit-null-negative.cpp"]
					, relocated, {
						...copiedCleanEnvironment, PATH: join(relocated, "tools")
					}
				), error => {
					diagnostic = error.details?.stderr ?? "";
					assert.match(diagnostic
						, /(?:no matching function|cannot convert|could not convert|invalid initialization)/iu);
					return true;
				});
				await saveLakeFile(records, "cpp/explicit-null-negative.cpp"
					, cppNullSource);
				explicitHostNull = {
					mode: "compile", rejected: true
					, diagnostic: diagnostic.replaceAll(relocated, "<consumer>")
				};
			}
			await saveLakeFile(records, `${profile}/consumer.${extension}`, source);
			await saveLakeFile(records, `${profile}/${headerName}`, header);
			observations.push({
				profile, checks: observation.checks
				, offlineInstall: observation.offlineInstall
				, compilerFreePath: observation.compilerFreePath
				, consumerSha256: sha256(source), headerSha256: sha256(header)
				, executableSha256, explicitHostNull
				, ...closure
				, executions: [
					{ checks: checks[profile], relocated: false }
					, { checks: checks[profile], relocated: true }
				]
			});
		}
		const report = {
			schemaVersion: 1, route, profiles: optionalParameterNativeProfiles
			, producerCommit, builds, receipt, observations
			, reproducible: true, independentBuilds: 2
			, authorInputsUnchanged: true, sourceRemovedBeforeInstallation: true
			, offlineInstall: true, compilerFreePath: true
			, relocatedInstallation: true
		};
		await saveLakeFile(records, "report.json", canonicalJson(report));
	}
);
