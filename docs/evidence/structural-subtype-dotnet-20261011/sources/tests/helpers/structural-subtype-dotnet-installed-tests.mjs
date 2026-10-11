/**
 * Real ordinary/reviewed .NET packages with two-root reproduction and relocated execution.
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
import { structuralSubtypeFixture, structuralSubtypeReview } from "./structural-subtype-installed-fixture.mjs";
import { structuralSubtypeDotnetConfiguration, structuralSubtypeDotnetCaller, structuralSubtypeDotnetCounts, parseStructuralSubtypeDotnetResult } from "./structural-subtype-dotnet-fixture.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment } from "./copied-fixture-install.mjs";
import { installFinContainerEdgeDotnet, runFinContainerEdgeDotnet, verifyFinContainerEdgeDotnetEnvironment } from "./fin-container-edge-dotnet-closure.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_DOTNET_TEST === "1";
const routes = process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_DOTNET_ROUTES?.split(",") ?? ["ordinary", "reviewed"];
assert.ok(routes.length && routes.every(route => ["ordinary", "reviewed"].includes(route)));
assert.equal(new Set(routes).size, routes.length);

for(const route of routes) test(`installed structural Subtypes Dotnet ${route} reproduce and relocate`, { skip: !enabled, timeout: 2_400_000 }, async t => {
	const output = resolve(process.env.LEAN_BRIDGE_STRUCTURAL_SUBTYPE_DOTNET_OUTPUT ?? "build/structural-subtype-dotnet", route);
	await assert.rejects(access(output), { code: "ENOENT" }); await mkdir(output, { recursive: true });
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-structural-dotnet-installed-"));
	let complete = false;
	t.after(async () => {
		if(complete) await rm(directory, { recursive: true });
		else t.diagnostic(`Retained structural Dotnet inputs: ${directory}`);
	});
	const expected = structuralSubtypeReview(), configuration = structuralSubtypeDotnetConfiguration(route);
	const environment = nativeFixtureEnvironment(["dotnet"]), handoff = join(directory, "handoff"), consumer = join(directory, "consumer");
	assert.ok(environment.LEAN_BRIDGE_DOTNET.startsWith("/"), "Select an absolute Dotnet toolchain");
	const producerCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	await saveLakeFile(output, "expected.binding-ir.json", canonicalJson(expected));
	await saveLakeFile(output, "configuration.json", canonicalJson(configuration));
	const builds = [];
	for(const attempt of [0, 1])
	{
		const author = join(directory, `author-${attempt}`), projectRoot = join(author, "project"), outputRoot = join(author, "release");
		await cp(structuralSubtypeFixture, projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson(configuration));
		if(route === "reviewed") await saveLakeFile(projectRoot, "api.binding-ir.json", canonicalJson(expected));
		t.diagnostic(`Dotnet ${route}: author ${attempt}`);
		await buildCanonicalProject({ projectRoot, outputRoot, environment, targets: ["nuget"] })
			.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const modelBytes = await readFile(join(outputRoot, "native/component/model.json")), model = JSON.parse(modelBytes);
		assert.equal(reviewedContractDifference(expected, model.bindingIr), null);
		if(route === "reviewed") assert.equal(model.sourceIdentity.reviewedBindingIr.source, canonicalJson(expected));
		else assert.ok(!model.sourceIdentity.reviewedBindingIr);
		const receiptBytes = await readFile(join(outputRoot, "package-set-receipt.json")), receipt = JSON.parse(receiptBytes);
		await verifyPackageSetReceipt({ receiptPath: join(outputRoot, "package-set-receipt.json") });
		await saveLakeFile(output, `build-${attempt}/model.json`, modelBytes);
		await saveLakeFile(output, `build-${attempt}/package-set-receipt.json`, receiptBytes);
		await saveLakeFile(output, `build-${attempt}/StructuralSubtypes.lean`, await readFile(join(projectRoot, "StructuralSubtypes.lean")));
		builds.push({ modelSha256: sha256(modelBytes)
			, receiptSha256: sha256(receiptBytes)
			, archives: Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(item => [item.path, item.sha256]))) });
		if(attempt === 0) await copyPackageSetHandoff(outputRoot, handoff);
		await rm(author, { recursive: true }); await assert.rejects(access(author), { code: "ENOENT" });
	}
	assert.deepEqual(builds[1], builds[0]);
	const receipt = JSON.parse(await readFile(join(handoff, "package-set-receipt.json")));
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	const packages = receipt.packages.filter(pkg => pkg.target === "nuget"), source = await structuralSubtypeDotnetCaller(route);
	await saveLakeFile(output, "consumer.cs", source);
	const installed = await installCopiedConsumer({
		profile: "dotnet", consumer, handoff, packages, environment
		, fixture: {
			source: () => source, expectedChecks: structuralSubtypeDotnetCounts.checks
			, parseResult: parseStructuralSubtypeDotnetResult
			, installDotnet: installFinContainerEdgeDotnet
		}
	});
	delete installed.command;
	const root = join(consumer, "dotnet"), observations = [];
	const retained = ["global.json", "Consumer.csproj", "NuGet.Config"
		, ...Object.keys(installed.dotnetEnvironment.buildInputs).map(path => `obj/${path}`)
		, "out/Consumer.deps.json", "out/Consumer.runtimeconfig.json"];
	for(const path of retained) await saveLakeFile(output, `consumer-environment/${path}`, await readFile(join(root, path)));
	const cache = join(root, "packages", installed.dotnetEnvironment.packageDirectory);
	for(const path of [".nupkg.metadata", "structuralsubtypes.api.1.0.0.nupkg.sha512", "structuralsubtypes.api.nuspec"])
		await saveLakeFile(output, `consumer-environment/cache/${path}`, await readFile(join(cache, path)));
	const sdk = JSON.parse(await readFile(join(root, "global.json"))).sdk.version;
	assert.match(sdk, /^8\.0\.[0-9]+$/u);
	for(const [position, location] of [root, root + "-relocated"].entries())
	{
		if(position)
		{ await rename(root, location); await assert.rejects(access(root), { code: "ENOENT" }); }
		const context = { ...installed.dotnetEnvironment, root: location };
		const before = await verifyFinContainerEdgeDotnetEnvironment(context);
		const run = await runFinContainerEdgeDotnet(context);
		assert.equal(run.stderr, ""); const counts = parseStructuralSubtypeDotnetResult(run.stdout);
		assert.deepEqual(await verifyFinContainerEdgeDotnetEnvironment(context), before);
		assert.equal(await readFile(join(location, "consumer.cs"), "utf8"), source);
		observations.push({ relocated: Boolean(position), run, counts, closure: before });
		await saveLakeFile(output, `${position ? "relocated" : "installed"}.json`, canonicalJson(observations.at(-1)));
	}
	await saveLakeFile(output, "report.json", canonicalJson({
		schemaVersion: 1, route, dotnetSdk: sdk, producerCommit
		, configuration, expectedBindingIrSha256: hashBindingIr(expected)
		, builds, receipt, installed, observations
		, reproducible: true, independentBuilds: 2
		, sourceRemovedBeforeInstallation: true
		, offlineInstall: true, compilerFreeReplay: true, relocatedInstallation: true
		, declaredGlibcFloor: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38"
		, dispatch: { observed: false, reason: "No Dotnet entry counters in this installed acceptance" } }));
	complete = true;
});
