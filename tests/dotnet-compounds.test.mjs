/**
 * Installed .NET compounds on ordinary-source and independent reviewed-IR paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { compileCopiedDotnetModel } from "../src/backends/dotnet/copied-model.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { compoundReviewedIr, compoundSignatures } from "./helpers/compound-source-fixture.mjs";
import { installCopiedConsumer, nativeFixtureEnvironment } from "./helpers/copied-fixture-install.mjs";
import { checkInstalledDotnetCompounds } from "./helpers/dotnet-compound-install.mjs";
import { checkDotnetCompoundFaults } from "./helpers/dotnet-compound-faults.mjs";

const enabled = process.env.LEAN_BRIDGE_DOTNET_COMPOUND_TEST === "1";
const type = value => value.kind === "primitive" ? value.name : ["array", "option"].includes(value.kind)
	? { [value.kind]: type(value.element) } : ["result", "tuple"].includes(value.kind)
		? { [value.kind]: value.arguments.map(type) } : { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };

test("installed .NET compounds preserve copied values on both source paths", { skip: !enabled, timeout: 900_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["dotnet"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-compound-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-compound-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/npm-compounds", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Compounds"]
			, targets: { nuget: { name: "Lean.Compounds", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: compoundSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(compoundReviewedIr()));
		t.diagnostic(`${path}: compiling .NET compounds`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["nuget"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const signatures = model.exports.map(item => ({ name: item.name, parameters: item.parameters.map(parameter => type(parameter.type)), result: type(item.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(compoundSignatures));
		const managed = join(outputRoot, "native/dotnet"), metadata = JSON.parse(await readFile(join(managed, "native-dotnet.json")));
		await verifyNativeFiles(managed, metadata.files);
		const sources = { api: await readFile(join(managed, "src/LeanBridge.Compounds/Api.cs"), "utf8"), runtime: await readFile(join(managed, "src/LeanBridge.Compounds/Runtime.cs"), "utf8") };
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		await rm(author, { recursive: true, force: true });
		t.diagnostic(`${path}: installing the relocated NuGet package offline without producer inputs`);
		const { command, ...observation } = await installCopiedConsumer({ profile: "dotnet"
			, consumer, handoff, packages: receipt.packages, environment
			, fixture: { source: () => readFile("tests/fixtures/compound-consumers/dotnet.cs", "utf8")
				, success: "compound-dotnet-ok" } }); void command;
		const faults = await checkDotnetCompoundFaults({ consumer, environment, sources, projection: compileCopiedDotnetModel(model.bindingIr) });
		const installed = await checkInstalledDotnetCompounds({ consumer, handoff, packages: receipt.packages, environment, checks: observation.checks });
		reports.push({ profile: "dotnet"
			, path, signatures, ...observation, faults, installed
			, packages: receipt.packages
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256, sourceRemovedBeforeInstallation: true });
		t.diagnostic(`${path}: ${observation.checks} assertions, ${installed.rejected.length} compiler rejections, ${faults.checks} injected failures and two runtime-only reruns passed`);
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/compounds", "dotnet.json", canonicalJson({ schemaVersion: 1, reports }));
});
