/**
 * Compiler-authenticated copied aliases in installed NuGet packages on both paths.
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
import { nativeAliasReviewedIr, nativeAliasSignatures } from "./helpers/native-alias-fixture.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { checkInstalledDotnetAliases } from "./helpers/dotnet-alias-install.mjs";
import { checkDotnetAliasFaults } from "./helpers/dotnet-alias-faults.mjs";

const contract = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, representation: type.representation, mutability: type.mutability
		, typeParameters: type.typeParameters, target: type.target
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases })).sort((a, b) => a.id.localeCompare(b.id))
});

test("installed .NET aliases preserve named contracts and transparent relocated values", { skip: process.env.LEAN_BRIDGE_DOTNET_ALIAS_TEST !== "1", timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["dotnet"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-alias-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-alias-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-aliases", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Aliases"]
			, targets: { nuget: { name: "Lean.Aliases", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: nativeAliasSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(nativeAliasReviewedIr()));
		t.diagnostic(`${path}: compiling .NET alias metadata, documentation and values`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["nuget"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(contract(model.bindingIr), contract(nativeAliasReviewedIr()));
		const managed = join(outputRoot, "native/dotnet"), metadata = JSON.parse(await readFile(join(managed, "native-dotnet.json")));
		await verifyNativeFiles(managed, metadata.files);
		const sources = { api: await readFile(join(managed, "src/LeanBridge.Aliases/Api.cs"), "utf8"), runtime: await readFile(join(managed, "src/LeanBridge.Aliases/Runtime.cs"), "utf8") };
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: offline installation without producer files or Lean/C compilers`);
		const { command, ...observation } = await installCopiedConsumer({ profile: "dotnet"
			, consumer, handoff, packages: receipt.packages, environment
			, fixture: { source: () => readFile("tests/fixtures/alias-consumers/dotnet.cs", "utf8"), success: "alias-dotnet-ok" } }); void command;
		const faults = await checkDotnetAliasFaults({ consumer, environment, sources, projection: compileCopiedDotnetModel(model.bindingIr) });
		const installed = await checkInstalledDotnetAliases({ consumer, handoff, packages: receipt.packages, environment, checks: observation.checks });
		reports.push({ profile: "dotnet", path, ...observation, faults, installed
			, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256, sourceRemovedBeforeInstallation: true });
		t.diagnostic(`${path}: ${observation.checks} assertions, ${installed.rejected.length} compiler rejections, ${faults.checks} injected failures and two runtime-only reruns passed`);
		await rm(consumer, { recursive: true, force: true });
	}
	const libraries = report => Object.fromEntries(Object.entries(report.installed.deployment).filter(([path]) => path.startsWith("runtimes/")));
	assert.deepEqual(libraries(reports[0]), libraries(reports[1]));
	await saveLakeFile("build/aliases", "dotnet.json", canonicalJson({ schemaVersion: 1, reports }));
});
