/**
 * Source-free ordinary and reviewed .NET/Java/Kotlin acceptance for direct
 * proof erasure.
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
	installCopiedConsumer, nativeFixtureEnvironment
} from "./helpers/copied-fixture-install.mjs";
import {
	assertDirectProofErasureNativeComponent, prepareDirectProofErasureProject
	, retainDirectProofErasureNativeComponent
} from "./helpers/direct-proof-erasure-packages.mjs";
import {
	directProofErasureManagedGroups
} from "./helpers/direct-proof-erasure-managed-report.mjs";
import {
	installFinContainerEdgeDotnet, runFinContainerEdgeDotnet
	, verifyFinContainerEdgeDotnetEnvironment
} from "./helpers/fin-container-edge-dotnet-closure.mjs";
import {
	installFinContainerEdgeJvm, runFinContainerEdgeJvm
	, verifyFinContainerEdgeJvmEnvironment
} from "./helpers/fin-container-edge-jvm-closure.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { retainPackageSetEvidence } from "./helpers/package-set.mjs";

const flag = process.env.LEAN_BRIDGE_DIRECT_PROOF_MANAGED_TEST;
assert.ok(flag === undefined || ["0", "1"].includes(flag)
	, "Invalid LEAN_BRIDGE_DIRECT_PROOF_MANAGED_TEST");
const enabled = flag === "1";
const group = process.env.LEAN_BRIDGE_DIRECT_PROOF_MANAGED_GROUP ?? "dotnet";
assert.ok(Object.hasOwn(directProofErasureManagedGroups, group));
const profiles = directProofErasureManagedGroups[group];
const routes = process.env.LEAN_BRIDGE_DIRECT_PROOF_MANAGED_ROUTES?.split(",")
	?? ["ordinary", "reviewed"];
assert.ok(routes.length
	&& routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);
const outputFor = route => resolve((
	process.env.LEAN_BRIDGE_DIRECT_PROOF_MANAGED_OUTPUT
		?? "build/direct-proof-erasure-managed/{group}/{route}"
).replace("{group}", group).replace("{route}", route));
const sourcePath = profile => `tests/fixtures/direct-proof-erasure-consumers/${profile}.${
	profile === "dotnet" ? "cs" : profile === "java" ? "java" : "kt"
}`;
const negativeSource = profile => ({
	dotnet: `using LeanBridge.Directprooferasure;
static class Negative { static void Main() { _ = Api.Keep(_before: true, value: 0u, _after: true); } }
`
	, java: `import org.leanbridge.directprooferasure.Api;
final class Consumer { public static void main(String[] args) { Api.keep(true, 0L, true); } }
`
	, kotlin: `import org.leanbridge.directprooferasure.kotlin.Api
fun main() { Api.keep(_before = true, value = 0L, _after = true) }
`
})[profile];
const diagnosticPattern = profile => profile === "dotnet"
	? /(?:No overload for method 'Keep' takes 3 arguments|best overload.*does not have a parameter named '_before')/iu
	: profile === "java"
		? /(?:method keep.*cannot be applied|actual and formal argument lists differ in length)/isu
		: /(?:cannot find a parameter with this name: _before|too many arguments for)/iu;

for(const route of routes) test(
	`installed direct proof-erasure managed packages reproduce and relocate ${group} ${route}`
	, { skip: !enabled, timeout: 3_600_000 }, async t => {
		const records = outputFor(route);
		await assert.rejects(access(records), { code: "ENOENT" });
		await mkdir(records, { recursive: true });
		const suite = await mkdtemp(join(tmpdir(), "lean-bridge-direct-proof-managed-"));
		t.after(() => rm(suite, { recursive: true, force: true }));
		const environment = nativeFixtureEnvironment(profiles);
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"])
			.toString().trim();
		const builds = [], handoff = join(records, "handoff");
		let receipt;
		for(const attempt of [0, 1])
		{
			const prepared = await prepareDirectProofErasureProject(t, {
				route, profiles
			});
			const before = await lakeInputState(prepared.projectRoot);
			const outputRoot = join(prepared.directory, "release");
			const built = await buildCanonicalProject({
				projectRoot: prepared.projectRoot, outputRoot
				, targets: profiles, environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			const component = await assertDirectProofErasureNativeComponent(outputRoot);
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
				...component, bindingIrSha256: built.bindingIrSha256
				, packageSetReceiptSha256: sha256(receiptBytes), archives
			};
			await retainDirectProofErasureNativeComponent(records, attempt, outputRoot);
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
		for(const profile of profiles)
		{
			const target = profile === "dotnet" ? "nuget" : "maven";
			const packages = receipt.packages.filter(item => item.target === target);
			assert.equal(packages.filter(item => item.role === "component").length, 1);
			const pkg = packages.find(item => item.role === "component");
			const source = await readFile(sourcePath(profile), "utf8");
			const fixture = {
				source: () => source, success: `direct-proof-${profile}`
				, expectedChecks: 1005
				, ...(profile === "dotnet"
					? { installDotnet: installFinContainerEdgeDotnet }
					: { installJvm: installFinContainerEdgeJvm })
			};
			const installed = await installCopiedConsumer({
				profile, consumer: consumerRoot, handoff, packages, environment, fixture
			});
			delete installed.command;
			const root = join(consumerRoot, profile);
			const relocated = join(consumerRoot, `${profile}-relocated`);
			await rename(root, relocated);
			await assert.rejects(access(root), { code: "ENOENT" });
			const context = profile === "dotnet"
				? { ...installed.dotnetEnvironment, root: relocated }
				: { ...installed.jvmEnvironment, root: relocated };
			const closure = profile === "dotnet"
				? await verifyFinContainerEdgeDotnetEnvironment(context)
				: await verifyFinContainerEdgeJvmEnvironment(context);
			const rerun = profile === "dotnet"
				? await runFinContainerEdgeDotnet(context)
				: await runFinContainerEdgeJvm(context);
			assert.equal(rerun.stderr, "");
			assert.equal(rerun.stdout, `direct-proof-${profile}:1005\n`);
			assert.equal(await readFile(join(relocated
				, `consumer.${profile === "dotnet" ? "cs" : profile === "java" ? "java" : "kt"}`), "utf8"), source);
			const negativeRoot = join(suite, `negative-${profile}`);
			await mkdir(negativeRoot);
			const extension = profile === "dotnet" ? "cs"
				: profile === "java" ? "java" : "kt";
			const invalid = negativeSource(profile);
			await saveLakeFile(negativeRoot, `consumer.${extension}`, invalid);
			const artifact = profile === "dotnet" ? pkg.artifacts[0]
				: pkg.artifacts.find(item => item.path.endsWith(".jar"));
			let diagnostic = "";
			const captureDiagnostic = error => {
				diagnostic = error.details?.stderr ?? error.message;
				assert.match(diagnostic, diagnosticPattern(profile));
				return true;
			};
			const negativeCompilation = profile === "dotnet"
				? installFinContainerEdgeDotnet({
					root: negativeRoot, archive: join(handoff, artifact.path)
					, archiveSha256: artifact.sha256
					, command: environment.LEAN_BRIDGE_DOTNET
				})
				: installFinContainerEdgeJvm({
					profile, root: negativeRoot, archive: join(handoff, artifact.path)
					, archiveSha256: artifact.sha256, environment
				});
			await assert.rejects(negativeCompilation, captureDiagnostic);
			await saveLakeFile(records, `${profile}/consumer.${extension}`, source);
			await saveLakeFile(records
				, `${profile}/proof-argument-negative.${extension}`, invalid);
			observations.push({
				profile, checks: installed.checks, runtimeParameters: 1, proofSlots: 0
				, offlineInstall: installed.offlineInstall
				, compilerFreePath: installed.compilerFreePath
				, consumerSha256: sha256(source)
				, ...closure
				, executions: [
					{ checks: 1005, relocated: false }
					, { checks: 1005, relocated: true }
				]
				, negativeProofArgument: {
					rejected: true, relocated: false
					, diagnostic: diagnostic.replaceAll(suite, "<suite>")
				}
			});
		}
		await saveLakeFile(records, "report.json", canonicalJson({
			schemaVersion: 1, group, route, profiles, producerCommit
			, builds, receipt, observations
			, reproducible: true, independentBuilds: 2
			, authorInputsUnchanged: true, sourceRemovedBeforeInstallation: true
			, offlineInstall: true, compilerFreePath: true
			, relocatedInstallation: true
		}));
	}
);
