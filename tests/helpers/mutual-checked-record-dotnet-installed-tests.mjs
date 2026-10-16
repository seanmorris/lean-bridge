/**
 * Reproduce, install, relocate and replay mutual checked-record NuGet packages.
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
import { generateCopiedDotnetGraphPackage } from "../../src/backends/dotnet/copied-graph-package.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import {
	installFinContainerEdgeDotnet, runFinContainerEdgeDotnet
	, verifyFinContainerEdgeDotnetEnvironment
} from "./fin-container-edge-dotnet-closure.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";
import {
	mutualCheckedRecordDotnetAssembly, mutualCheckedRecordDotnetConfiguration
	, mutualCheckedRecordDotnetPackage, mutualCheckedRecordDotnetReview
	, mutualCheckedRecordDotnetSelection, parseMutualCheckedRecordDotnetResult
} from "./mutual-checked-record-dotnet-fixture.mjs";
import {
	mutualCheckedRecordFixtureRoot, mutualCheckedRecordModule
} from "./mutual-checked-record-fixture.mjs";
import {
	nominalSubtypeDotnetEnvironment, observeNominalSubtypeDotnetRuntime
	, selectNominalSubtypeDotnetTools
} from "./nominal-subtype-dotnet-tools.mjs";
import { waitNominalSubtypeDotnetResources } from "./nominal-subtype-dotnet-resources.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";

const selection = mutualCheckedRecordDotnetSelection(process.env);
const identity = bytes => ({ bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
const json = async path => {
	const bytes = await readFile(path), value = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(value), `canonical JSON: ${path}`);
	return value;
};

const verifyDeployment = async (root, outputs) => {
	assert.equal(await realpath(root), resolve(root));
	assert.deepEqual(await nativeArtifactPaths(root), Object.keys(outputs).sort());
	for(const [path, expected] of Object.entries(outputs))
	{
		assert.ok((await lstat(join(root, path))).isFile());
		assert.equal(await realpath(join(root, path)), join(resolve(root), path));
		assert.deepEqual(identity(await readFile(join(root, path))), expected, path);
	}
	return { deployedFilesSha256: sha256(canonicalJson(outputs)) };
};

const inspectPackage = async ({ context, pkg, model, tools, floor, output }) => {
	const root = join(context.root, "inspection"), receipt = JSON.parse(context.receiptBytes);
	assert.equal(context.receiptBytes, canonicalJson(receipt));
	assert.equal(pkg.target, "nuget"); assert.equal(pkg.ecosystem, "nuget");
	assert.equal(pkg.role, "component"); assert.equal(pkg.profile, "native-library-v1");
	assert.equal(pkg.name, mutualCheckedRecordDotnetPackage); assert.equal(pkg.version, "1.0.0");
	assert.equal(receipt.kind, "lean-bridge-ordinary-nuget-package");
	assert.equal(receipt.namespace, mutualCheckedRecordDotnetAssembly);
	assert.equal(receipt.assembly, mutualCheckedRecordDotnetAssembly);
	assert.equal(receipt.name, pkg.name); assert.equal(receipt.version, pkg.version);
	assert.equal(receipt.glibcMinimumVersion, floor);
	assert.equal(receipt.bindingIrSha256, model.bindingIrSha256);
	assert.deepEqual(await json(join(root, "lean-bridge/component/model.json")), model);
	const component = await json(join(root, "lean-bridge/component/native-component.json"));
	const adapter = await json(join(root, "lean-bridge/native-c-adapter.json"));
	const runtime = await json(join(root, "lean-bridge/runtime.json"));
	assert.equal(sha256(canonicalJson(runtime)), receipt.runtimeIdentity);
	assert.equal(component.runtimeIdentity, receipt.runtimeIdentity);
	assert.equal(adapter.runtimeIdentity, receipt.runtimeIdentity);
	assert.equal(component.bindingIrSha256, receipt.bindingIrSha256);
	assert.equal(adapter.bindingIrSha256, receipt.bindingIrSha256);
	assert.equal(adapter.componentReceiptSha256, sha256(canonicalJson(component)));
	assert.deepEqual(adapter.copiedGraph, model.copiedGraph);
	const libraries = {
		[adapter.library]: adapter.files[`lib/${adapter.library}`].sha256
		, [component.library]: component.nativeLibrary.sha256
		, ...Object.fromEntries(Object.entries(runtime.files)
			.filter(([path]) => path.startsWith("lib/"))
			.map(([path, file]) => [path.slice(4), file.sha256]))
	};
	const evidence = {
		runtimeIdentity: receipt.runtimeIdentity, componentId: receipt.component.id
		, componentReceiptSha256: sha256(canonicalJson(component))
		, copiedGraph: structuredClone(adapter.copiedGraph)
		, library: adapter.library, libraries
	};
	const compiled = await json(join(root, "lean-bridge/native-dotnet.json"));
	assert.equal(sha256(canonicalJson(compiled)), receipt.compiledProjectionSha256);
	assert.equal(compiled.schemaVersion, 1); assert.equal(compiled.profile, "native-library-v1");
	assert.equal(compiled.bindingIrSha256, model.bindingIrSha256);
	assert.equal(compiled.assembly, mutualCheckedRecordDotnetAssembly);
	assert.equal(compiled.sdk, tools.sdk.version); assert.deepEqual(compiled.evidence, evidence);
	const generated = generateCopiedDotnetGraphPackage(model.bindingIr, evidence);
	for(const [path, source] of Object.entries(generated))
	{
		assert.deepEqual(compiled.files[path], identity(source), path);
		if(path.startsWith("src/") || path === "binding-manifest.json")
		{
			assert.equal(await readFile(join(root, "lean-bridge/dotnet", path), "utf8"), source, path);
			await saveLakeFile(output, `package-sources/${path}`, source);
		}
	}
	const manifest = JSON.parse(generated["binding-manifest.json"]);
	assert.ok(manifest.supportedFeatures.includes("checked-refinement-diagnostics"));
	assert.deepEqual(manifest.aliases.map(alias => [alias.name, alias.managedType])
		, [["EnvelopeAlias", "Envelope"]]);
	const calls = generated[`src/${mutualCheckedRecordDotnetAssembly}/Calls.cs`];
	assert.match(calls, /mutualcheckedrecords_graph_error/u);
	const closure = await verifyFinContainerEdgeDotnetEnvironment(context);
	const record = {
		archive: pkg.artifacts[0], receiptSha256: sha256(context.receiptBytes)
		, packageFileSetSha256: closure.packageFileSetSha256
		, bindingIrSha256: model.bindingIrSha256
		, layoutSha256: model.copiedGraph.layoutSha256
		, generatedFiles: Object.fromEntries(Object.entries(generated)
			.map(([path, source]) => [path, identity(source)]))
		, compiledProjectionSha256: receipt.compiledProjectionSha256
		, diagnosticSymbolAuthenticated: true, aliases: manifest.aliases
	};
	await saveLakeFile(output, "package-verification.json", canonicalJson(record));
	return record;
};

for(const route of selection.routes) test(
	`installed mutual checked-record C# package reproduces and relocates ${route}`,
	{ skip: !selection.enabled, timeout: 3_600_000 }, async t => {
		const output = resolve(
			process.env.LEAN_BRIDGE_MUTUAL_CHECKED_RECORD_DOTNET_OUTPUT
				?? "build/mutual-checked-record-dotnet", route
		);
		await assert.rejects(access(output), { code: "ENOENT" });
		await mkdir(output, { recursive: true });
		const producerCommit = execFileSync(
			"git", ["rev-parse", "HEAD"], { encoding: "utf8" }
		).trim();
		for(const path of [
			"tests/helpers/mutual-checked-record-dotnet-fixture.mjs"
			, "tests/helpers/mutual-checked-record-dotnet-installed-tests.mjs"
			, "tests/fixtures/mutual-checked-record-consumers/dotnet.cs"
		]) execFileSync("git", ["ls-files", "--error-unmatch", path]);
		execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"]);
		const expected = mutualCheckedRecordDotnetReview();
		const configuration = mutualCheckedRecordDotnetConfiguration(route);
		const environment = {
			...nativeFixtureEnvironment(["dotnet"]), LEAN_NUM_THREADS: "1"
			, MSBUILDDISABLENODEREUSE: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
		};
		const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR;
		assert.match(floor ?? "", /^2\.[0-9]+$/u);
		const caller = await readFile(
			"tests/fixtures/mutual-checked-record-consumers/dotnet.cs", "utf8"
		);
		await saveLakeFile(output, "consumer.cs", caller);
		await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
		await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
		const resources = [];
		const resourceCheck = async () => {
			const observed = await waitNominalSubtypeDotnetResources(output, {
				maxLoad: selection.maxLoad, notify: message => t.diagnostic(message)
			});
			resources.push({ maxLoad: selection.maxLoad, ...observed });
			await saveLakeFile(output, "resources.json", canonicalJson(resources));
		};
		await resourceCheck();
		const root = await mkdtemp(join(tmpdir(), "lean-bridge-mutual-checked-record-dotnet-"));
		let complete = false;
		t.after(async () => {
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(`Retained failed mutual checked-record C# inputs: ${root}`);
		});
		const toolRoot = join(root, "toolchain"); await mkdir(toolRoot);
		const tools = await selectNominalSubtypeDotnetTools(
			toolRoot, environment.LEAN_BRIDGE_DOTNET
		);
		await saveLakeFile(output, "toolchain.json", canonicalJson(tools));
		const handoff = join(root, "handoff"), builds = [];
		let model;
		for(const attempt of [0, 1])
		{
			await resourceCheck();
			const author = join(root, `author-${attempt}`), projectRoot = join(author, "project");
			const outputRoot = join(author, "release"), record = join(output, `build-${attempt}`);
			await cp(mutualCheckedRecordFixtureRoot, projectRoot, { recursive: true });
			await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
			if(route === "reviewed")
				await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
			const before = await lakeInputState(projectRoot);
			t.diagnostic(`${route} author ${attempt}: reproducible recursive NuGet package`);
			const built = await buildCanonicalProject({
				projectRoot, outputRoot, targets: ["nuget"], environment
			}).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
			assert.deepEqual(await lakeInputState(projectRoot), before);
			const modelBytes = await readFile(join(outputRoot, "native/component/model.json"));
			model = JSON.parse(modelBytes);
			assert.equal(model.schemaVersion, route === "reviewed" ? 5 : 4);
			assert.ok(model.copiedGraph); assert.equal(model.exports.length, 6);
			assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
			if(route === "reviewed")
				assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
			else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
			const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json"));
			const receipt = JSON.parse(receiptBytes);
			await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
			assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role])
				, [["nuget", "component"]]);
			const build = {
				bindingIrSha256: built.bindingIrSha256, modelSha256: sha256(modelBytes)
				, receiptSha256: sha256(receiptBytes)
				, archives: Object.fromEntries(receipt.packages.flatMap(pkg =>
					pkg.artifacts.map(artifact => [artifact.path, artifact.sha256])))
			};
			builds.push(build);
			await saveLakeFile(record, "model.json", modelBytes);
			await saveLakeFile(record, "package-set-receipt.json", receiptBytes);
			await saveLakeFile(record, "author-inputs.json", canonicalJson(before));
			for(const name of [
				`${mutualCheckedRecordModule}.lean`, "lean-bridge.exports.json"
				, ...route === "reviewed" ? ["api.binding-ir.json"] : []
			]) await saveLakeFile(record, name, await readFile(join(projectRoot, name)));
			if(attempt === 0)
			{
				await copyPackageSetHandoff(outputRoot, handoff);
				await copyPackageSetHandoff(handoff, join(output, "handoff"));
			}
			await rm(author, { recursive: true });
			await assert.rejects(access(author), { code: "ENOENT" });
		}
		assert.deepEqual(builds[1], builds[0]
			, "independent author roots reproduce the complete package");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
		const pkg = receipt.packages[0], archive = join(handoff, pkg.artifacts[0].path);
		const consumer = join(root, "consumer"); await mkdir(consumer);
		await saveLakeFile(consumer, "consumer.cs", caller);
		await resourceCheck();
		const { context } = await installFinContainerEdgeDotnet({
			root: consumer, archive, archiveSha256: pkg.artifacts[0].sha256
			, command: tools.command
		});
		const installation = await inspectPackage({
			context, pkg, model, tools, floor, output
		});
		const observations = [];
		for(const [index, location] of [consumer, consumer + "-relocated"].entries())
		{
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
			const result = parseMutualCheckedRecordDotnetResult(run.stdout);
			assert.deepEqual(await verifyFinContainerEdgeDotnetEnvironment(current), closure);
			const observation = {
				stage: index ? "relocated" : "installed", cwd: location
				, run, result, closure, framework
			};
			observations.push(observation);
			await saveLakeFile(output, `${observation.stage}.json`, canonicalJson(observation));
		}
		assert.deepEqual(observations[1].result, observations[0].result);
		const sourceFree = join(root, "source-free");
		await rename(join(consumer + "-relocated", "out"), sourceFree);
		for(const path of [consumer + "-relocated", handoff, toolRoot])
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
		const result = parseMutualCheckedRecordDotnetResult(run.stdout);
		assert.deepEqual(result, observations[0].result);
		assert.deepEqual(await verifyDeployment(sourceFree, context.outputs), closure);
		const sourceFreeObservation = {
			stage: "source-free", cwd: sourceFree, run, result, closure, framework
			, sourcesRemoved: true, sdkNotPresentInDeployment: true
		};
		observations.push(sourceFreeObservation);
		await saveLakeFile(output, "source-free.json", canonicalJson(sourceFreeObservation));
		for(const item of observations.slice(1))
		{
			assert.deepEqual(item.framework.facts, observations[0].framework.facts);
			assert.deepEqual(item.framework.runtimeFiles, observations[0].framework.runtimeFiles);
		}
		await saveLakeFile(output, "report.json", canonicalJson({
			schemaVersion: 1, route, producerCommit, builds, receipt, observations
			, installation, tools, resourceChecks: resources, declaredGlibcFloor: floor
			, expectedBindingIrSha256: hashBindingIr(expected)
			, reproducible: true, independentBuilds: 2, authorInputsUnchanged: true
			, sourceRemovedBeforeInstallation: true, offlineInstall: true
			, compilerFreeReplay: true, relocatedInstallation: true
			, sourceFreeDeployment: true, immutableCallerAssertions: true
			, exactExceptionArtifacts: true, malformedDepthCycleRecovery: true
			, typedRecursiveCarriers: true, aliasesPreserved: true
			, activeBranchesCovered: true, constructorFreeResultsCovered: true
			, trustedToolchains: "Explicit .NET SDK and shared framework; their complete contents are not authenticated"
		}));
		complete = true;
	}
);
