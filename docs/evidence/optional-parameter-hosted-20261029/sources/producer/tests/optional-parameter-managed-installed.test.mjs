/**
 * Source-free ordinary and reviewed .NET/Java/Kotlin acceptance for optional
 * parameters.
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
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import {
	installCopiedConsumer, nativeFixtureEnvironment
} from "./helpers/copied-fixture-install.mjs";
import {
	installFinContainerEdgeDotnet, runFinContainerEdgeDotnet
	, verifyFinContainerEdgeDotnetEnvironment
} from "./helpers/fin-container-edge-dotnet-closure.mjs";
import {
	installFinContainerEdgeJvm, runFinContainerEdgeJvm
	, verifyFinContainerEdgeJvmEnvironment
} from "./helpers/fin-container-edge-jvm-closure.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import {
	optionalParameterManagedGroups
} from "./helpers/optional-parameter-managed-report.mjs";
import {
	managedCompilationDiagnostic, managedDiagnosticCount, managedDiagnosticPattern
} from "./helpers/optional-parameter-installed-contract.mjs";
import {
	assertOptionalParameterNativeComponent, prepareOptionalParameterProject
	, retainOptionalParameterNativeComponent
} from "./helpers/optional-parameter-packages.mjs";
import { retainPackageSetEvidence } from "./helpers/package-set.mjs";

const flag = process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_MANAGED_TEST;
assert.ok(flag === undefined || ["0", "1"].includes(flag)
	, "Invalid LEAN_BRIDGE_OPTIONAL_PARAMETER_MANAGED_TEST");
const enabled = flag === "1";
const group = process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_MANAGED_GROUP
	?? "dotnet";
assert.ok(Object.hasOwn(optionalParameterManagedGroups, group));
const profiles = optionalParameterManagedGroups[group];
const target = { dotnet: "nuget", jvm: "maven" }[group];
const routes = process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_MANAGED_ROUTES
	?.split(",") ?? ["ordinary", "reviewed"];
assert.ok(routes.length
	&& routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);
const outputFor = route => resolve((
	process.env.LEAN_BRIDGE_OPTIONAL_PARAMETER_MANAGED_OUTPUT
		?? "build/optional-parameter-managed/{group}/{route}"
).replace("{group}", group).replace("{route}", route));
const extension = profile => profile === "dotnet" ? "cs"
	: profile === "java" ? "java" : "kt";
const sourcePath = (profile, invalid = false) =>
	`tests/fixtures/optional-parameter-consumers/${profile}${invalid ? "-invalid" : ""}.${extension(profile)}`;
for(const route of routes) test(
	`installed optional-parameter managed packages reproduce and relocate ${group} ${route}`
	, { skip: !enabled, timeout: 3_600_000 }, async t => {
		const records = outputFor(route);
		await assert.rejects(access(records), { code: "ENOENT" });
		await mkdir(records, { recursive: true });
		const suite = await mkdtemp(join(tmpdir(), "lean-bridge-optional-managed-"));
		t.after(() => rm(suite, { recursive: true, force: true }));
		const environment = nativeFixtureEnvironment(profiles);
		const producerCommit = execFileSync("git", ["rev-parse", "HEAD"])
			.toString().trim();
		const builds = [], handoff = join(records, "handoff");
		let receipt;
		for(const attempt of [0, 1])
		{
			const prepared = await prepareOptionalParameterProject(t, {
				route, profiles
			});
			const before = await lakeInputState(prepared.projectRoot);
			const outputRoot = join(prepared.directory, "release");
			const built = await buildCanonicalProject({
				projectRoot: prepared.projectRoot, outputRoot
				, targets: [target], environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			const component = await assertOptionalParameterNativeComponent(outputRoot);
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
			await retainOptionalParameterNativeComponent(
				records, attempt, outputRoot);
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
		for(const profile of profiles)
		{
			const target = profile === "dotnet" ? "nuget" : "maven";
			const packages = receipt.packages.filter(item => item.target === target);
			assert.equal(packages.filter(item => item.role === "component").length, 1);
			const pkg = packages.find(item => item.role === "component");
			const source = await readFile(sourcePath(profile), "utf8");
			const fixture = {
				source: () => source, success: `optional-parameter-${profile}`
				, expectedChecks: 21
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
			assert.equal(rerun.stdout, `optional-parameter-${profile}:21\n`);
			assert.equal(await readFile(join(relocated
				, `consumer.${extension(profile)}`), "utf8"), source);

			const invalid = await readFile(sourcePath(profile, true), "utf8");
			const negativeRoot = join(suite, `negative-${profile}`);
			await mkdir(negativeRoot);
			await saveLakeFile(negativeRoot, `consumer.${extension(profile)}`, invalid);
			const artifact = profile === "dotnet" ? pkg.artifacts[0]
				: pkg.artifacts.find(item => item.path.endsWith(".jar"));
			let diagnostic = "";
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
			await assert.rejects(negativeCompilation, error => {
				diagnostic = managedCompilationDiagnostic(error);
				assert.match(diagnostic, managedDiagnosticPattern(profile));
				assert.ok(managedDiagnosticCount(profile, diagnostic) >= 2, diagnostic);
				return true;
			});
			await saveLakeFile(records, `${profile}/consumer.${extension(profile)}`
				, source);
			await saveLakeFile(records, `${profile}/invalid.${extension(profile)}`
				, invalid);
			observations.push({
				profile, checks: 23, runtimeChecks: installed.checks
				, invalidHostValues: 2, explicitHostNull: true
				, offlineInstall: installed.offlineInstall
				, compilerFreePath: installed.compilerFreePath
				, consumerSha256: sha256(source)
				, invalidConsumerSha256: sha256(invalid), closure
				, executions: [
					{ checks: 21, relocated: false }
					, { checks: 21, relocated: true }
				]
				, invalidCompile: {
					rejected: true, values: 2
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
