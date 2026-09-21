/**
 * Installed Java/Kotlin aliases from ordinary Lean and independent reviewed IR.
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
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeAliasReviewedIr, nativeAliasSignatures } from "./helpers/native-alias-fixture.mjs";
import { jvmAliasConsumer, jvmAliasPublicChecks, jvmAliasRejections } from "./helpers/jvm-alias-fixture.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";
import { prepareJvmCorpusDependencies } from "./helpers/type-corpus-jvm-tools.mjs";
import { installedJvmCorpus } from "./helpers/type-corpus-jvm.mjs";
import { checkJvmAliasFaults } from "./helpers/jvm-alias-faults.mjs";
import { checkJvmAliasPackage } from "./helpers/jvm-alias-install.mjs";

const contract = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, representation: type.representation, mutability: type.mutability
		, typeParameters: type.typeParameters, target: type.target
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases })).sort((a, b) => a.id.localeCompare(b.id))
});

test("installed Java and Kotlin aliases retain named contracts and target semantics on both source paths", { skip: process.env.LEAN_BRIDGE_JVM_ALIAS_TEST !== "1", timeout: 1_800_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["java", "kotlin"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-alias-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-alias-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-aliases", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Aliases"]
			, targets: { maven: { name: "org.leanbridge:aliases", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: nativeAliasSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(nativeAliasReviewedIr()));
		t.diagnostic(`${path}: compiling the 31-export JVM alias package`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["maven"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(contract(model.bindingIr), contract(nativeAliasReviewedIr()));
		const jvm = join(outputRoot, "native/jvm"), metadata = JSON.parse(await readFile(join(jvm, "native-jvm.json")));
		await verifyNativeFiles(jvm, metadata.files);
		const sources = Object.fromEntries(await Promise.all(Object.keys(metadata.files).filter(path => path.endsWith(".java")).map(async path => [path, await readFile(join(jvm, path), "utf8")])));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff), pkg = receipt.packages.find(entry => entry.role === "component");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		const dependencies = await prepareJvmCorpusDependencies({ directory, handoff, pkg, environment, clean: copiedCleanEnvironment });
		await rm(directory, { recursive: true, force: true });
		const jar = join(handoff, pkg.artifacts.find(artifact => artifact.path.endsWith(".jar")).path);
		const catalog = await checkJvmAliasPackage({ jar, consumer });
		const faults = await checkJvmAliasFaults({ consumer, environment, sources, jar, projection: compileCopiedJvmModel(model.bindingIr) });
		for(const profile of ["java", "kotlin"])
		{
			t.diagnostic(`${path}/${profile}: offline Maven install, source-local compiler rejections and two runtime-only reruns`);
			const installed = await installedJvmCorpus({ library: { jvmModule: "org.leanbridge.aliases" }
				, profile, consumer, handoff, pkg, dependencies, environment
				, clean: copiedCleanEnvironment
				, fixture: { source: jvmAliasConsumer, signatures: jvmAliasPublicChecks, rejections: jvmAliasRejections } }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
			const checks = Number(installed.observation.results.find(entry => entry.id === "aliases/assertions").observed.integer);
			assert.ok(checks > 3000); assert.equal(installed.observation.results.filter(entry => entry.status === "rejected-at-compile-time").length, 12);
			t.diagnostic(`${path}/${profile}: ${checks} public checks, 12 compiler rejections, ${faults.checks} injected failures passed`);
			reports.push({ path, profile, checks, contract: contract(model.bindingIr)
				, ...installed, faults, catalog
				, packages: receipt.packages, receiptSha256
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
				, modelSha256: sha256(canonicalJson(model))
				, sourceRemovedBeforeInstallation: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	assert.ok(reports.every(report => canonicalJson(report.jvm.nativeLibraries) === canonicalJson(reports[0].jvm.nativeLibraries)));
	await saveLakeFile("build/aliases", "jvm.json", canonicalJson({ schemaVersion: 1, reports }));
});
