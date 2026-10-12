/**
 * Reproduce NuGet packages and execute installed, relocated and source-free C# callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { hashBindingIr } from "../../src/binding-ir/canonical.mjs";
import { reviewedContractDifference } from "../../src/analyze/reviewed-source.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { nominalSubtypeFixture, nominalSubtypeModule, nominalSubtypeInstalledReview } from "./nominal-subtype-installed-fixture.mjs";
import { nominalSubtypeDotnetCaller, nominalSubtypeDotnetConfiguration, nominalSubtypeDotnetSelection, parseNominalSubtypeDotnetResult } from "./nominal-subtype-dotnet-fixture.mjs";
import { nominalSubtypeDotnetAssembly, inspectNominalSubtypeDotnetPackage, verifyNominalSubtypeDotnetDeployment } from "./nominal-subtype-dotnet-package.mjs";
import { nominalSubtypeDotnetEnvironment, observeNominalSubtypeDotnetRuntime, selectNominalSubtypeDotnetTools } from "./nominal-subtype-dotnet-tools.mjs";
import { runNominalSubtypeDotnetProbe } from "./nominal-subtype-dotnet-probe.mjs";
import { waitNominalSubtypeDotnetResources } from "./nominal-subtype-dotnet-resources.mjs";
import { installFinContainerEdgeDotnet, runFinContainerEdgeDotnet, verifyFinContainerEdgeDotnetEnvironment } from "./fin-container-edge-dotnet-closure.mjs";
import { nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { lakeInputState, saveLakeFile } from "./lake-workspace.mjs";

const { enabled, routes, modes } = nominalSubtypeDotnetSelection(process.env);

for(const route of routes) for(const mode of modes) test(`installed nominal C# packages reproduce and relocate ${route} ${mode}`, {
	skip: !enabled, timeout: 3_600_000
}, async t => {
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	for(const path of ["fixture.mjs", "package.mjs", "tools.mjs", "probe.mjs", "resources.mjs", "installed-tests.mjs"])
		execFileSync("git", ["ls-files", "--error-unmatch", `tests/helpers/nominal-subtype-dotnet-${path}`]);
	execFileSync("git", ["ls-files", "--error-unmatch", "tests/fixtures/nominal-subtype-consumers/dotnet.cs"]);
	execFileSync("git", ["diff", "--quiet", "HEAD", "--", "src", "tests", "scripts"]);
	const expected = nominalSubtypeInstalledReview(mode === "result-only"), configuration = nominalSubtypeDotnetConfiguration(route, mode);
	const output = resolve(process.env.LEAN_BRIDGE_NOMINAL_SUBTYPE_DOTNET_OUTPUT ?? "build/nominal-subtype-dotnet", route, mode);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const environment = { ...nativeFixtureEnvironment(["dotnet"]), LEAN_NUM_THREADS: "1", MSBUILDDISABLENODEREUSE: "1" };
	const floor = environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR;
	assert.match(floor ?? "", /^2\.[0-9]+$/u, "Select the native glibc floor explicitly");
	assert.equal(process.platform, "linux"); assert.equal(process.arch, "x64");
	const runtime = { platform: process.platform, arch: process.arch, glibc: await runCopied("/usr/bin/getconf", ["GNU_LIBC_VERSION"], output) };
	assert.equal(runtime.glibc.stderr, ""); assert.match(runtime.glibc.stdout, /^glibc 2\.[0-9]+\n$/u);
	assert.ok(Number(runtime.glibc.stdout.match(/2\.([0-9]+)/u)[1]) >= Number(floor.split(".")[1]));
	for(const [path, value] of Object.entries({ "runtime.json": runtime, "expected.binding-ir.json": expected, "configuration.json": configuration }))
		await saveLakeFile(output, path, canonicalJson(value));
	const caller = await nominalSubtypeDotnetCaller(route, mode); await saveLakeFile(output, "consumer.cs", caller);
	const resourceChecks = [];
	const resourceCheck = async () => {
		resourceChecks.push(await waitNominalSubtypeDotnetResources(output, { notify: message => t.diagnostic(message) }));
		await saveLakeFile(output, "resources.json", canonicalJson(resourceChecks));
	};
	await resourceCheck();
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-nominal-subtype-dotnet-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(root, { recursive: true });
		else t.diagnostic(`Retained failed nominal C# inputs: ${root}`);
	});
	const toolRoot = join(root, "toolchain"); await mkdir(toolRoot);
	const tools = await selectNominalSubtypeDotnetTools(toolRoot, environment.LEAN_BRIDGE_DOTNET);
	await saveLakeFile(output, "toolchain.json", canonicalJson(tools));
	const handoff = join(root, "handoff"), builds = [];
	let model;
	for(const attempt of [0, 1])
	{
		await resourceCheck();
		const author = join(root, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release"), record = join(output, `build-${attempt}`);
		await cp(nominalSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		const sourceBefore = await lakeInputState(projectRoot);
		t.diagnostic(`${route} ${mode} author ${attempt}: reproducible NuGet package`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["nuget"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		assert.deepEqual(await lakeInputState(projectRoot), sourceBefore, "Author inputs remain unchanged");
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json")); model = JSON.parse(modelBytes);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.equal(model.sourceIdentity.reviewedBindingIr, undefined);
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		assert.deepEqual(receipt.packages.map(pkg => [pkg.target, pkg.role]), [["nuget", "component"]]);
		await saveLakeFile(record, "model.json", modelBytes);
		await saveLakeFile(record, "package-set-receipt.json", receiptBytes);
		await saveLakeFile(record, "author-inputs.json", canonicalJson(sourceBefore));
		for(const name of [`${nominalSubtypeModule}.lean`, "lean-bridge.exports.json"])
			await saveLakeFile(record, name, await readFile(join(projectRoot, name)));
		if(route === "reviewed") await saveLakeFile(record, "api.binding-ir.json", canonicalJson(expected));
		if(attempt === 0)
		{
			await copyPackageSetHandoff(outputRoot, handoff);
			await copyPackageSetHandoff(handoff, join(output, "handoff"));
		}
		builds.push({ bindingIrSha256: built.bindingIrSha256
			, modelSha256: sha256(modelBytes), receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))) });
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0], "Both author roots reproduce the complete NuGet package");
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json"))), pkg = receipt.packages[0];
	const archive = join(handoff, pkg.artifacts[0].path), consumer = join(root, "consumer");
	await resourceCheck(); await saveLakeFile(consumer, "consumer.cs", caller);
	const { context } = await installFinContainerEdgeDotnet({ root: consumer, archive, archiveSha256: pkg.artifacts[0].sha256, command: tools.command });
	const installation = await inspectNominalSubtypeDotnetPackage({ context, pkg, model, floor, tools, output });
	const probeRoot = join(root, "api-probe");
	const apiProbe = await runNominalSubtypeDotnetProbe({ root: probeRoot
		, assembly: await readFile(join(consumer, "out", `${nominalSubtypeDotnetAssembly}.dll`))
		, tools, mode, output });
	await verifyFinContainerEdgeDotnetEnvironment(context);
	const observations = [];
	for(const [index, location] of [consumer, consumer + "-relocated"].entries())
	{
		if(index)
		{ await rename(consumer, location); await assert.rejects(access(consumer), { code: "ENOENT" }); }
		const current = { ...context, root: location }, closure = await verifyFinContainerEdgeDotnetEnvironment(current);
		const framework = await observeNominalSubtypeDotnetRuntime(location, "out/Consumer.dll", tools);
		const run = await runFinContainerEdgeDotnet(current);
		assert.equal(run.stderr, ""); const counts = parseNominalSubtypeDotnetResult(run.stdout, mode);
		assert.deepEqual(await verifyFinContainerEdgeDotnetEnvironment(current), closure);
		const observation = { stage: index ? "relocated" : "installed", cwd: location, run, counts, closure, framework };
		observations.push(observation); await saveLakeFile(output, `${observation.stage}.json`, canonicalJson(observation));
	}
	const sourceFree = join(root, "source-free");
	await rename(join(consumer + "-relocated", "out"), sourceFree);
	for(const path of [consumer + "-relocated", probeRoot, handoff, toolRoot])
	{
		await rm(path, { recursive: true }); await assert.rejects(access(path), { code: "ENOENT" });
	}
	const closure = await verifyNominalSubtypeDotnetDeployment(sourceFree, context.outputs);
	const framework = await observeNominalSubtypeDotnetRuntime(sourceFree, "Consumer.dll", tools);
	const run = await runCopied(tools.command, ["Consumer.dll"], sourceFree, nominalSubtypeDotnetEnvironment(sourceFree, tools.command));
	assert.equal(run.stderr, ""); const counts = parseNominalSubtypeDotnetResult(run.stdout, mode);
	assert.deepEqual(await verifyNominalSubtypeDotnetDeployment(sourceFree, context.outputs), closure);
	const observation = { stage: "source-free", cwd: sourceFree, run, counts, closure, framework, sourcesRemoved: true };
	observations.push(observation); await saveLakeFile(output, "source-free.json", canonicalJson(observation));
	for(const item of observations.slice(1))
	{
		assert.deepEqual(item.framework.facts, observations[0].framework.facts);
		assert.deepEqual(item.framework.runtimeFiles, observations[0].framework.runtimeFiles);
	}
	await verifyPackageSetReceipt({ receiptPath: join(output, "handoff/package-set-receipt.json") });
	await saveLakeFile(output, "report.json", canonicalJson({
		schemaVersion: 1, route, mode, producerCommit, runtime, tools, builds
		, receipt, observations, installation, apiProbe, resourceChecks
		, declaredGlibcFloor: floor, expectedBindingIrSha256: hashBindingIr(expected)
		, reproducible: true, independentBuilds: 2, authorInputsUnchanged: true
		, sourceRemovedBeforeInstallation: true, offlineInstall: true
		, compilerFreeReplay: true, relocatedInstallation: true
		, sourceFreeDeployment: true
		, trustedToolchains: "Explicit .NET SDK and shared framework; their complete contents are not authenticated"
		, installerCommandLogs: "Closed installer retains input/build-input/output identities, not restore/build stdout"
		, dispatch: { observed: false, reason: "No C# constructor/source entry counters in this installed acceptance" } }));
	complete = true;
});
