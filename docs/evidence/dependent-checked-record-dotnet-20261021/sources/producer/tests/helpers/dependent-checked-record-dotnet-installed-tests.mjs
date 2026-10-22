/**
 * Reproduce NuGet packages and execute installed, relocated and source-free
 * dependent checked-record C# callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
	access, cp, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm
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
	verifyPackageSetReceipt
} from "../../src/release/package-set-receipt.mjs";
import {
	nativeFixtureEnvironment, runCopied
} from "./copied-fixture-install.mjs";
import {
	installFinContainerEdgeDotnet, runFinContainerEdgeDotnet
	, verifyFinContainerEdgeDotnetEnvironment
} from "./fin-container-edge-dotnet-closure.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import {
	nominalSubtypeDotnetEnvironment, observeNominalSubtypeDotnetRuntime
	, selectNominalSubtypeDotnetTools
} from "./nominal-subtype-dotnet-tools.mjs";
import {
	waitNominalSubtypeDotnetResources
} from "./nominal-subtype-dotnet-resources.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import {
	dependentCheckedRecordDotnetFixtureRoot
} from "./dependent-checked-record-dotnet-fixture.mjs";
import {
	parseDependentCheckedRecordDotnetResult, dependentCheckedRecordDotnetCaller
	, dependentCheckedRecordDotnetEnvironment, dependentCheckedRecordDotnetSelection
} from "./dependent-checked-record-dotnet-fixture.mjs";

const selected = dependentCheckedRecordDotnetEnvironment(process.env);
const identity = bytes => ({
	bytes: Buffer.byteLength(bytes), sha256: sha256(bytes)
});

const verifyDeployment = async (root, outputs) => {
	assert.equal(await realpath(root), resolve(root));
	assert.ok(outputs["Consumer.dll"]);
	assert.deepEqual(await nativeArtifactPaths(root), Object.keys(outputs).sort());
	for(const [path, expected] of Object.entries(outputs))
	{
		const target = join(root, path);
		assert.ok((await lstat(target)).isFile());
		assert.equal(await realpath(target), target);
		assert.deepEqual(identity(await readFile(target)), expected, path);
	}
	return { deployedFilesSha256: sha256(canonicalJson(outputs)) };
};

for(const route of selected.routes) test(
	`installed dependent checked records reproduce and relocate in .NET for ${route}`
	, { skip: !selected.enabled, timeout: 3_600_000 }, async t => {
		const producerCommit = execFileSync(
			"git", ["rev-parse", "HEAD"], { encoding: "utf8" }
		).trim();
		const consumerCommit = producerCommit;
		const status = execFileSync("git", [
			"status", "--porcelain=v1", "--untracked-files=all", "--"
			, ".github", "src", "tests", "scripts"
		], { encoding: "utf8" });
		assert.equal(status, "", "Installed evidence requires a clean source tree");
		const selection = dependentCheckedRecordDotnetSelection(route);
		const mode = selection.resultOnly ? "result-only" : "full";
		const output = resolve(
			process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_DOTNET_OUTPUT
				?? "build/dependent-checked-record-dotnet"
			, route
		);
		await assert.rejects(access(output), { code: "ENOENT" });
		await mkdir(output, { recursive: true });
		const environment = {
			...nativeFixtureEnvironment(["dotnet"])
			, LEAN_NUM_THREADS: "1", MSBUILDDISABLENODEREUSE: "1"
		};
		const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR;
		assert.match(floor ?? "", /^2\.[0-9]+$/u);
		assert.equal(process.platform, "linux");
		assert.equal(process.arch, "x64");
		const glibc = await runCopied(
			"/usr/bin/getconf", ["GNU_LIBC_VERSION"], output
		);
		assert.equal(glibc.stderr, "");
		assert.match(glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
		const glibcVersion = glibc.stdout.trim().split(" ")[1];
		assert.ok(Number(glibcVersion.split(".")[1])
			>= Number(floor.split(".")[1]));
		const runtime = {
			platform: process.platform, arch: process.arch, glibc
		};
		for(const [path, value] of Object.entries({
			"runtime.json": runtime
			, "expected.binding-ir.json": selection.expected
			, "configuration.json": selection.configuration
		})) await saveLakeFile(output, path, canonicalJson(value));
		const caller = await dependentCheckedRecordDotnetCaller(route);
		await saveLakeFile(output, "consumer.cs", caller);
		const resourceChecks = [];
		const resourceCheck = async () => {
			resourceChecks.push({
				maxLoad: selected.maxLoad
				, ...await waitNominalSubtypeDotnetResources(output, {
					notify: message => t.diagnostic(message)
					, maxLoad: selected.maxLoad
				})
			});
			await saveLakeFile(output, "resources.json"
				, canonicalJson(resourceChecks));
		};
		await resourceCheck();
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-dependent checked-record-dotnet-"
		));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(`Retained failed dependent checked-record C# inputs: ${root}`);
		});
		const toolRoot = join(root, "toolchain");
		await mkdir(toolRoot);
		const tools = await selectNominalSubtypeDotnetTools(
			toolRoot, environment.LEAN_BRIDGE_DOTNET
		);
		await saveLakeFile(output, "toolchain.json", canonicalJson(tools));
		const handoff = join(root, "handoff"), builds = [];
		let model;
		for(const attempt of [0, 1])
		{
			await resourceCheck();
			const author = join(root, `author-${attempt}`);
			const projectRoot = join(author, "project");
			const outputRoot = join(author, "release");
			const record = join(output, `build-${attempt}`);
			await cp(dependentCheckedRecordDotnetFixtureRoot, projectRoot
				, { recursive: true });
			await saveLakeFile(projectRoot, "lean-bridge.exports.json"
				, canonicalJson(selection.configuration));
			if(selection.reviewed)
				await saveLakeFile(projectRoot, "api.binding-ir.json"
					, canonicalJson(selection.expected));
			const sourceBefore = await lakeInputState(projectRoot);
			const stable = sourceBefore.map(item => {
				const { path, mode: inputMode, sha256: digest } = item;
				return { path, mode: inputMode, sha256: digest };
			});
			t.diagnostic(`${route} .NET author ${attempt}: reproducible NuGet`);
			const built = await buildCanonicalProject({
				projectRoot, outputRoot, targets: ["nuget"], environment
			}).catch(error => {
				error.message += `: ${JSON.stringify(error.details)}`;
				throw error;
			});
			assert.deepEqual(await lakeInputState(projectRoot), sourceBefore);
			const modelBytes = await readFile(join(
				outputRoot, "native/component/model.json"
			));
			model = JSON.parse(modelBytes);
			assert.equal(reviewedContractDifference(
				selection.expected, model.bindingIr), null);
			const receiptPath = join(outputRoot, "package-set-receipt.json");
			await verifyPackageSetReceipt({ receiptPath });
			const receiptBytes = await readFile(receiptPath);
			const receipt = JSON.parse(receiptBytes);
			assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role])
				, [["nuget", "component"]]);
			await saveLakeFile(record, "model.json", modelBytes);
			await saveLakeFile(record, "package-set-receipt.json", receiptBytes);
			await saveLakeFile(record, "author-inputs.json"
				, canonicalJson(sourceBefore));
			for(const name of [
				"DependentRecords.lean"
				, "lean-bridge.exports.json"
				, ...selection.reviewed ? ["api.binding-ir.json"] : []
			]) await saveLakeFile(record, name
				, await readFile(join(projectRoot, name)));
			if(attempt === 0)
			{
				await copyPackageSetHandoff(outputRoot, handoff);
				await copyPackageSetHandoff(handoff, join(output, "handoff"));
			}
			builds.push({
				authorInputsSha256: sha256(canonicalJson(stable))
				, bindingIrSha256: built.bindingIrSha256
				, modelSha256: sha256(modelBytes)
				, receiptSha256: sha256(receiptBytes)
				, archives: Object.fromEntries(
					receipt.packages.flatMap(pkg =>
						pkg.artifacts.map(artifact => [
							artifact.path, artifact.sha256
						])
					)
				)
			});
			await rm(author, { recursive: true });
			await assert.rejects(access(author), { code: "ENOENT" });
		}
		assert.deepEqual(builds[1], builds[0]);
		await verifyPackageSetReceipt({
			receiptPath: join(handoff, "package-set-receipt.json")
		});
		const receipt = JSON.parse(await readFile(join(
			handoff, "package-set-receipt.json"
		)));
		const pkg = receipt.packages[0];
		const archive = join(handoff, pkg.artifacts[0].path);
		const consumer = join(root, "consumer");
		await resourceCheck();
		await mkdir(consumer);
		await saveLakeFile(consumer, "consumer.cs", caller);
		const { context } = await installFinContainerEdgeDotnet({
			root: consumer, archive
			, archiveSha256: pkg.artifacts[0].sha256
			, command: tools.command
		});
		const observations = [];
		for(const [index, location] of [
			consumer, consumer + "-relocated"
		].entries()){
			if(index)
			{
				await rename(consumer, location);
				await assert.rejects(access(consumer), { code: "ENOENT" });
			}
			const current = { ...context, root: location };
			const closure = await verifyFinContainerEdgeDotnetEnvironment(current);
			const framework = await observeNominalSubtypeDotnetRuntime(
				location, "out/Consumer.dll", tools
			);
			const run = await runFinContainerEdgeDotnet(current);
			assert.equal(run.stderr, "");
			const counts = parseDependentCheckedRecordDotnetResult(run.stdout, route);
			assert.deepEqual(
				await verifyFinContainerEdgeDotnetEnvironment(current), closure
			);
			const observation = {
				stage: index ? "relocated" : "installed"
				, cwd: location, run, counts, closure, framework
			};
			observations.push(observation);
			await saveLakeFile(output, `${observation.stage}.json`
				, canonicalJson(observation));
		}
		const relocated = consumer + "-relocated";
		const sourceFree = join(root, "source-free");
		await rename(join(relocated, "out"), sourceFree);
		for(const path of [relocated, handoff, toolRoot])
		{
			await rm(path, { recursive: true });
			await assert.rejects(access(path), { code: "ENOENT" });
		}
		const closure = await verifyDeployment(sourceFree, context.outputs);
		const framework = await observeNominalSubtypeDotnetRuntime(
			sourceFree, "Consumer.dll", tools
		);
		const run = await runCopied(
			tools.command, ["Consumer.dll"], sourceFree
			, nominalSubtypeDotnetEnvironment(sourceFree, tools.command)
		);
		assert.equal(run.stderr, "");
		const counts = parseDependentCheckedRecordDotnetResult(run.stdout, route);
		assert.deepEqual(await verifyDeployment(sourceFree, context.outputs)
			, closure);
		observations.push({
			stage: "source-free", cwd: sourceFree, run, counts, closure, framework
			, sourcesRemoved: true
		});
		await saveLakeFile(output, "source-free.json"
			, canonicalJson(observations.at(-1)));
		for(const item of observations.slice(1))
		{
			assert.deepEqual(item.framework.facts
				, observations[0].framework.facts);
			assert.deepEqual(item.framework.runtimeFiles
				, observations[0].framework.runtimeFiles);
		}
		await verifyPackageSetReceipt({
			receiptPath: join(output, "handoff/package-set-receipt.json")
		});
		const report = {
			schemaVersion: 1, route, mode, producerCommit, consumerCommit
			, runtime, tools, builds, receipt, observations, resourceChecks
			, declaredGlibcFloor: floor
			, expectedBindingIrSha256: hashBindingIr(selection.expected)
			, reproducible: true, independentBuilds: 2
			, authorInputsUnchanged: true
			, sourceRemovedBeforeInstallation: true, offlineInstall: true
			, compilerFreeReplay: true, relocatedInstallation: true
			, sourceFreeDeployment: true
			, trustedToolchains: "Explicit .NET SDK and shared framework; their complete contents are not authenticated"
			, dispatch: {
				observed: false
				, reason: "No C# constructor/source entry counters in this installed acceptance"
			}
		};
		await saveLakeFile(output, "report.json", canonicalJson(report));
		complete = true;
	}
);
