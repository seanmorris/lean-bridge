/**
 * Offline installed .NET primitive callbacks and closures on both source paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { callableReviewedIr } from "./helpers/callable-fixture.mjs";
import { dotnetCallableArities, dotnetCallableSignatures, dotnetCallableConsumer } from "./helpers/dotnet-callable-fixture.mjs";
import { nativeFixtureEnvironment, installCopiedConsumer } from "./helpers/copied-fixture-install.mjs";
import { checkInstalledDotnetCallables } from "./helpers/dotnet-callable-install.mjs";

const enabled = process.env.LEAN_BRIDGE_DOTNET_CALLABLE_TEST === "1";
const type = value => value.kind === "primitive" ? value.name
	: { callback: { parameters: value.parameters.map(type), result: type(value.result) } };

test("installed .NET callables preserve all nineteen primitives on both source paths", { skip: !enabled, timeout: 900_000 }, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-callable-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-dotnet-callable-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/callables", projectRoot, { recursive: true });
		// These language-independent Lean fixtures also exercise the Python projection.
		for(const name of ["Lifetimes", "Python", "Dotnet"]) await saveLakeFile(projectRoot, `Callables/${name}.lean`, await readFile(`tests/fixtures/callable-consumers/${name}.lean`, "utf8"));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Callables", "Callables.Lifetimes", "Callables.Python", "Callables.Dotnet"]
			, targets: { nuget: { name: "Lean.Callables", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: dotnetCallableSignatures.map(entry => entry.name), arities: dotnetCallableArities } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "callables.binding-ir.json", canonicalJson(callableReviewedIr(dotnetCallableSignatures)));
		const environment = nativeFixtureEnvironment(["dotnet"]);
		t.diagnostic(`${path}: compiling the 62-export .NET callable library`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["nuget"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		const signatures = model.exports.map(entry => ({ name: entry.name, parameters: entry.parameters.map(parameter => type(parameter.type)), result: type(entry.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(dotnetCallableSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		await rm(directory, { recursive: true, force: true });
		t.diagnostic(`${path}: installing the relocated NuGet package offline`);
		const observation = await installCopiedConsumer({ profile: "dotnet"
			, consumer, handoff, packages: receipt.packages, environment
			, fixture: { source: dotnetCallableConsumer, success: "callable-dotnet-ok" } });
		const { command, ...observed } = observation; void command;
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		const installed = await checkInstalledDotnetCallables({ consumer, handoff, packages: receipt.packages, environment, checks: observation.checks });
		t.diagnostic(`${path}: ${observation.checks} assertions, ${installed.rejected.length} compile rejections and two runtime-only reruns passed`);
		reports.push({ profile: "dotnet", path, signatures
			, ...observed
			, packages: receipt.packages, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model)), receiptSha256, installed
			, sourceRemovedBeforeInstallation: true });
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_DOTNET_CALLABLE_REPORT ?? "build/callables/dotnet.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
