/**
 * Original NuGet variant packages on ordinary and independently reviewed paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { cVariantReviewedIr, cVariantSignatures } from "./helpers/c-variant-fixture.mjs";
import { checkNativeVariantFaults } from "./helpers/native-variant-faults.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { checkInstalledDotnetValues } from "./helpers/dotnet-copied-install.mjs";
import { checkDotnetVariantFaults } from "./helpers/dotnet-variant-faults.mjs";

const shape = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(({ name, type }) => ({ name, type })) })) })).sort((a, b) => a.id.localeCompare(b.id))
});

test("installed .NET variants preserve named constructors and runtime-only deployment", { skip: process.env.LEAN_BRIDGE_DOTNET_VARIANT_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["dotnet"]);
	const negatives = JSON.parse(await readFile("tests/fixtures/variant-consumers/dotnet-invalid.json"));
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-variant-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-variant-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-variants", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Variants/Extra.lean", await readFile("tests/fixtures/variant-consumers/Extra.lean", "utf8"));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Variants", "Variants.Extra"]
			, targets: { nuget: { name: "Lean.Variants", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: cVariantSignatures().map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(cVariantReviewedIr()));
		t.diagnostic(`${path}: compiling named .NET variants`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["nuget"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(shape(model.bindingIr), shape(cVariantReviewedIr()));
		const nativeFaults = await checkNativeVariantFaults(outputRoot, join(author, "faults"), environment);
		const managed = join(outputRoot, "native/dotnet"), metadata = JSON.parse(await readFile(join(managed, "native-dotnet.json")));
		await verifyNativeFiles(managed, metadata.files);
		const sources = { api: await readFile(join(managed, "src/LeanBridge.Variants/Api.cs"), "utf8"), runtime: await readFile(join(managed, "src/LeanBridge.Variants/Runtime.cs"), "utf8") };
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(canonicalJson(receipt));
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: offline install without producer files or Lean/C compilers`);
		const { command, ...observation } = await installCopiedConsumer({ profile: "dotnet"
			, consumer, handoff, packages: receipt.packages, environment
			, fixture: { source: () => readFile("tests/fixtures/variant-consumers/dotnet.cs", "utf8"), success: "variant-dotnet-ok" } }); void command;
		const pkg = receipt.packages.find(item => item.role === "component");
		const installedRoot = join(consumer, "dotnet/packages", pkg.name.toLowerCase(), pkg.version);
		const installedReceipt = JSON.parse(await readFile(join(installedRoot, "lean-bridge/package-receipt.json")));
		const faults = await checkDotnetVariantFaults({ consumer, environment, sources, projection: compileCopiedDotnetModel(model.bindingIr) });
		const installed = await checkInstalledDotnetValues({ consumer, handoff
			, packages: receipt.packages, environment, checks: observation.checks
			, fixture: { namespace: "LeanBridge.Variants", success: "variant-dotnet-ok"
				, rejectedSources: Object.fromEntries(negatives.map(item => [item.name, item.statement]))
				, expectedDiagnostics: Object.fromEntries(negatives.map(item => [item.name, [item.code]])) } });
		reports.push({ profile: "dotnet"
			, path, ...observation, faults, nativeFaults, installed
			, installedFiles: installedReceipt.files
			, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256
			, sourceRemovedBeforeInstallation: true
			, rejectionSourceSha256: sha256(await readFile("tests/fixtures/variant-consumers/dotnet-invalid.json")) });
		t.diagnostic(`${path}: ${observation.checks} public assertions, ${faults.checks} injected failures and two runtime-only reruns passed`);
		await rm(consumer, { recursive: true, force: true });
	}
	const libraries = report => Object.fromEntries(Object.entries(report.installed.deployment).filter(([path]) => path.startsWith("runtimes/")));
	assert.deepEqual(libraries(reports[0]), libraries(reports[1]));
	await saveLakeFile("build/variants", "dotnet.json", canonicalJson({ schemaVersion: 1, reports }));
});
