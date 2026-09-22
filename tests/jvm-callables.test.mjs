/**
 * Offline Maven installation and runtime-only Java/Kotlin primitive callable acceptance.
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
import { jvmCallableArities, jvmCallableSignatures, jvmCallableConsumer, jvmCallablePublicChecks, jvmCallableRejections } from "./helpers/jvm-callable-fixture.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";
import { prepareJvmCorpusDependencies } from "./helpers/type-corpus-jvm-tools.mjs";
import { installedJvmCorpus } from "./helpers/type-corpus-jvm.mjs";

const enabled = process.env.LEAN_BRIDGE_JVM_CALLABLE_TEST === "1";
const type = value => value.kind === "primitive" ? value.name : { callback: { parameters: value.parameters.map(type), result: type(value.result) } };

test("installed Java and Kotlin callables preserve nineteen primitives on both source paths", { skip: !enabled, timeout: 1_800_000 }, async t => {
	const reports = [];
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-callable-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-callable-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/callables", projectRoot, { recursive: true });
		// Reuse language-independent Lean lifetime, mixed-signature and 16-argument fixtures.
		for(const name of ["Lifetimes", "Python", "Dotnet", "Jvm"]) await saveLakeFile(projectRoot, `Callables/${name}.lean`, await readFile(`tests/fixtures/callable-consumers/${name}.lean`, "utf8"));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Callables", "Callables.Lifetimes", "Callables.Python", "Callables.Dotnet", "Callables.Jvm"]
			, targets: { maven: { name: "org.leanbridge:callables", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: jvmCallableSignatures.map(entry => entry.name), arities: jvmCallableArities } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "callables.binding-ir.json", canonicalJson(callableReviewedIr(jvmCallableSignatures)));
		const environment = nativeFixtureEnvironment(["java", "kotlin"]);
		t.diagnostic(`${path}: compiling the 63-export JVM callable library`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["maven"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		const signatures = model.exports.map(entry => ({ name: entry.name, parameters: entry.parameters.map(parameter => type(parameter.type)), result: type(entry.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(jvmCallableSignatures));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff), pkg = receipt.packages.find(entry => entry.role === "component");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		const dependencies = await prepareJvmCorpusDependencies({ directory, handoff, pkg, environment, clean: copiedCleanEnvironment });
		await rm(directory, { recursive: true, force: true });
		for(const profile of ["java", "kotlin"])
		{
			t.diagnostic(`${path}/${profile}: installing Maven archives offline and running twice without compilers`);
			const installed = await installedJvmCorpus({ library: { jvmModule: "org.leanbridge.callables" }
				, profile, consumer, handoff, pkg, dependencies, environment
				, clean: copiedCleanEnvironment
				, fixture: { source: jvmCallableConsumer, signatures: jvmCallablePublicChecks, rejections: jvmCallableRejections, kotlinMetadata: true } }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
			const checks = Number(installed.observation.results.find(entry => entry.id === "callables/assertions").observed.integer);
			assert.ok(checks > 60000); assert.equal(installed.observation.results.filter(entry => entry.status === "rejected-at-compile-time").length, 6);
			t.diagnostic(`${path}/${profile}: ${checks} assertions and six compile rejections passed twice with a runtime-only installation`);
			reports.push({ path, profile, checks, signatures
				, ...installed
				, packages: receipt.packages, receiptSha256
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, sourceRemovedBeforeInstallation: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_JVM_CALLABLE_REPORT ?? "build/callables/jvm.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
