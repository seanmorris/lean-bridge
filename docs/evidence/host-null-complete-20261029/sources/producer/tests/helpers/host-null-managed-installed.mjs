/**
 * Source-free, relocated HostNull acceptance for prepared NuGet and Maven packages.
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
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { createComponentPrivateAbi } from "../../src/build/component-callable-adapters.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	installCopiedConsumer, nativeFixtureEnvironment
} from "./copied-fixture-install.mjs";
import {
	installFinContainerEdgeDotnet, runFinContainerEdgeDotnet
	, verifyFinContainerEdgeDotnetEnvironment
} from "./fin-container-edge-dotnet-closure.mjs";
import {
	installFinContainerEdgeJvm, runFinContainerEdgeJvm
	, verifyFinContainerEdgeJvmEnvironment
} from "./fin-container-edge-jvm-closure.mjs";
import {
	hostNullArities, hostNullProjection, hostNullReviewedIr
} from "./host-null-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";

export const hostNullManagedGroups = Object.freeze({
	dotnet: Object.freeze(["dotnet"])
	, jvm: Object.freeze(["java", "kotlin"])
});
export const hostNullManagedFixturePaths = Object.freeze({
	dotnet: "tests/fixtures/host-null-consumers/dotnet.cs"
	, java: "tests/fixtures/host-null-consumers/java.java"
	, kotlin: "tests/fixtures/host-null-consumers/kotlin.kt"
});
export const hostNullManagedChecks = 22;
const settings = Object.freeze({
	dotnet: Object.freeze({
		nuget: Object.freeze({ name: "HostNullDemo.Api", version: "1.0.0" })
	})
	, jvm: Object.freeze({
		maven: Object.freeze({ name: "org.leanbridge:host-null-demo", version: "1.0.0" })
	})
});
const extensions = Object.freeze({ dotnet: "cs", java: "java", kotlin: "kt" });
const exports_ = hostNullReviewedIr().declarations.map(item => item.source.declaration);
const privateShape = ir => {
	const abi = createComponentPrivateAbi(ir);
	return {
		...abi
		, types: abi.types.toSorted((left, right) => left.id.localeCompare(right.id))
		, callbacks: abi.callbacks.toSorted((left, right) => left.id.localeCompare(right.id))
		, exports: abi.exports.toSorted((left, right) => left.bindingId.localeCompare(right.bindingId))
	};
};

/**
 * Build both author routes, install their prepared package, remove author
 * sources, relocate the complete consumer and execute every managed host again.
 *
 * @param t - Node test context that owns temporary roots.
 * @param group - Dotnet or JVM workflow group.
 */
export const runHostNullManagedAcceptance = async (t, group) => {
	assert.ok(Object.hasOwn(hostNullManagedGroups, group));
	const profiles = hostNullManagedGroups[group];
	const target = group === "dotnet" ? "nuget" : "maven";
	const outputRoot = resolve((process.env.LEAN_BRIDGE_HOST_NULL_MANAGED_OUTPUT
		?? "build/host-null/managed/{group}").replace("{group}", group));
	await assert.rejects(access(outputRoot), { code: "ENOENT" });
	await mkdir(outputRoot, { recursive: true });
	const environment = nativeFixtureEnvironment(profiles);
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"])
		.toString().trim();
	const routes = [];
	for(const route of ["ordinary", "reviewed"])
	{
		const root = await mkdtemp(join(tmpdir(), `lean-bridge-host-null-${group}-`));
		t.after(() => rm(root, { recursive: true, force: true }));
		const author = join(root, "author"), projectRoot = join(author, "project");
		const release = join(author, "release"), consumer = join(root, "consumer");
		const handoff = join(consumer, "handoff"), retained = join(outputRoot, route);
		await mkdir(retained, { recursive: true });
		await cp("tests/fixtures/onboarding/host-null", projectRoot, { recursive: true });
		const configuration = {
			schemaVersion: 1, modules: ["HostNullDemo"]
			, hostProjections: [hostNullProjection]
			, targets: settings[group]
			, ...route === "ordinary" ? { exports: exports_, arities: hostNullArities } : {}
		};
		await saveLakeFile(projectRoot, "lean-bridge.exports.json"
			, canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot
			, "reviewed.binding-ir.json", canonicalJson(hostNullReviewedIr()));
		t.diagnostic(`${group}/${route}: compiling authenticated HostNull packages`);
		const built = await buildCanonicalProject({
			projectRoot, outputRoot: release, targets: [target], environment
		}).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`;
			throw error;
		});
		const modelBytes = await readFile(join(release, "native/component/model.json"));
		const model = JSON.parse(modelBytes);
		assert.deepEqual(privateShape(model.bindingIr), privateShape(hostNullReviewedIr()));
		assert.doesNotMatch(JSON.stringify(model.bindingIr), /(?:null|value)Constructor/u);
		assert.ok(model.types.some(type => type.kind === "host-null"));
		const receipt = await copyPackageSetHandoff(release, handoff);
		await verifyPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		await cp(handoff, join(retained, "handoff"), { recursive: true });
		await saveLakeFile(retained, "configuration.json", canonicalJson(configuration));
		await saveLakeFile(retained, "HostNullDemo.lean", await readFile(
			join(projectRoot, "HostNullDemo.lean")));
		const receiptSha256 = sha256(await readFile(
			join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		await assert.rejects(access(author), { code: "ENOENT" });

		const installed = [];
		for(const profile of profiles)
		{
			const packages = receipt.packages.filter(item => item.target === target);
			assert.equal(packages.filter(item => item.role === "component").length, 1);
			const source = await readFile(hostNullManagedFixturePaths[profile], "utf8");
			const fixture = {
				source: () => source
				, success: `host-null-${profile}`
				, expectedChecks: hostNullManagedChecks
				, ...(profile === "dotnet"
					? { installDotnet: installFinContainerEdgeDotnet }
					: { installJvm: installFinContainerEdgeJvm })
			};
			const result = await installCopiedConsumer({
				profile, consumer, handoff, packages, environment, fixture
			});
			delete result.command;
			installed.push({ profile, source, result });
		}
		await rm(handoff, { recursive: true, force: true });
		await assert.rejects(access(handoff), { code: "ENOENT" });

		const observations = [];
		for(const item of installed)
		{
			const current = join(consumer, item.profile);
			const relocated = join(consumer, `${item.profile}-relocated`);
			await rename(current, relocated);
			await assert.rejects(access(current), { code: "ENOENT" });
			const context = item.profile === "dotnet"
				? { ...item.result.dotnetEnvironment, root: relocated }
				: { ...item.result.jvmEnvironment, root: relocated };
			const closure = item.profile === "dotnet"
				? await verifyFinContainerEdgeDotnetEnvironment(context)
				: await verifyFinContainerEdgeJvmEnvironment(context);
			const rerun = item.profile === "dotnet"
				? await runFinContainerEdgeDotnet(context)
				: await runFinContainerEdgeJvm(context);
			assert.equal(rerun.stderr, "");
			assert.equal(rerun.stdout
				, `host-null-${item.profile}:${hostNullManagedChecks}\n`);
			assert.equal(await readFile(join(relocated
				, `consumer.${extensions[item.profile]}`), "utf8"), item.source);
			await saveLakeFile(retained
				, `${item.profile}/consumer.${extensions[item.profile]}`, item.source);
			observations.push({
				profile: item.profile, checks: item.result.checks
				, consumerSha256: sha256(item.source)
				, offlineInstall: item.result.offlineInstall
				, compilerFreePath: item.result.compilerFreePath
				, nestedOptionDistinct: true
				, positions: ["parameter", "result", "field"
					, "callback-parameter", "callback-result"]
				, executions: [
					{ checks: hostNullManagedChecks, relocated: false }
					, { checks: hostNullManagedChecks, relocated: true }
				]
				, ...closure
			});
		}
		const report = {
			schemaVersion: 1, group, route, profiles, producerCommit
			, packages: receipt.packages, receiptSha256
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(modelBytes), observations
			, sourceRemovedBeforeInstallation: true
			, installationHandoffRemovedBeforeRelocatedExecution: true
			, offlineInstall: true, compilerFreePath: true
			, relocatedInstallation: true
		};
		await saveLakeFile(retained, "report.json", canonicalJson(report));
		routes.push(report);
	}
	await saveLakeFile(outputRoot, "summary.json", canonicalJson({
		schemaVersion: 1, group, producerCommit, routes
	}));
	return routes;
};
