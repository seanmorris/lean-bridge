/**
 * Original Maven variants installed into independent Java and Kotlin consumers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
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
import { cVariantReviewedIr, cVariantSignatures } from "./helpers/c-variant-fixture.mjs";
import { checkNativeVariantFaults } from "./helpers/native-variant-faults.mjs";
import { jvmVariantConsumer, jvmVariantPublicChecks, jvmVariantRejections } from "./helpers/jvm-variant-fixture.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { prepareJvmCorpusDependencies } from "./helpers/type-corpus-jvm-tools.mjs";
import { installedJvmCorpus } from "./helpers/type-corpus-jvm.mjs";
import { checkJvmVariantFaults } from "./helpers/jvm-variant-faults.mjs";

const contract = ir => ({
	declarations: ir.declarations.map(item => ({ id: item.id, parameters: item.parameters.map(p => p.type), result: item.result.type })).sort((a, b) => a.id.localeCompare(b.id))
	, types: ir.types.map(type => ({ id: type.id, name: type.name, kind: type.kind
		, fields: type.fields.map(({ name, type }) => ({ name, type }))
		, cases: type.cases.map(branch => ({ name: branch.name, fields: branch.fields.map(({ name, type }) => ({ name, type })) })) })).sort((a, b) => a.id.localeCompare(b.id))
});

test("installed Java and Kotlin variants preserve constructors and runtime-only execution", { skip: process.env.LEAN_BRIDGE_JVM_VARIANT_TEST !== "1", timeout: 1_800_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["java", "kotlin"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-variant-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-variant-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-variants", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "Variants/Extra.lean", await readFile("tests/fixtures/variant-consumers/Extra.lean", "utf8"));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Variants", "Variants.Extra"]
			, targets: { maven: { name: "org.leanbridge:variants", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: cVariantSignatures().map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(cVariantReviewedIr()));
		t.diagnostic(`${path}: compiling fourteen variant exports for Java and Kotlin`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["maven"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(contract(model.bindingIr), contract(cVariantReviewedIr()));
		const nativeFaults = await checkNativeVariantFaults(outputRoot, join(author, "faults"), environment);
		const jvm = join(outputRoot, "native/jvm"), metadata = JSON.parse(await readFile(join(jvm, "native-jvm.json")));
		await verifyNativeFiles(jvm, metadata.files);
		const kotlinFiles = JSON.parse(await readFile(join(jvm, "binding-manifest.json"))).kotlin.internalFiles;
		const sources = Object.fromEntries(await Promise.all(Object.keys(metadata.files).filter(path => path.endsWith(".java") && !kotlinFiles.includes(path)).map(async path => [path, await readFile(join(jvm, path), "utf8")])));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff), pkg = receipt.packages.find(entry => entry.role === "component");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		const dependencies = await prepareJvmCorpusDependencies({ directory: author, handoff, pkg, environment, clean: copiedCleanEnvironment });
		await rm(author, { recursive: true, force: true });
		const jar = join(handoff, pkg.artifacts.find(artifact => artifact.path.endsWith(".jar")).path);
		const installedReceipt = JSON.parse((await runCopied("/usr/bin/unzip", ["-p", jar, "META-INF/lean-bridge/package-receipt.json"], consumer, copiedCleanEnvironment)).stdout);
		const faults = await checkJvmVariantFaults({ consumer, environment, sources, jar, projection: compileCopiedJvmModel(model.bindingIr) });
		for(const profile of ["java", "kotlin"])
		{
			const profileConsumer = join(consumer, `consumer-${profile}`), profileHandoff = join(profileConsumer, "handoff");
			await mkdir(profileConsumer); await cp(handoff, profileHandoff, { recursive: true });
			t.diagnostic(`${path}/${profile}: offline Maven install, compiler rejections and runtime-only reruns`);
			const installed = await installedJvmCorpus({ library: { jvmModule: "org.leanbridge.variants" }
				, profile, consumer: profileConsumer, handoff: profileHandoff
				, pkg, dependencies, environment, clean: copiedCleanEnvironment
				, fixture: { source: jvmVariantConsumer, signatures: jvmVariantPublicChecks
					, rejections: jvmVariantRejections
					, removeHandoffBeforeExecution: true
					, kotlinMetadata: true } }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
			const observed = name => Number(installed.observation.results.find(entry => entry.id === `variants/${name}`).observed.integer);
			const checks = observed("assertions"), calls = observed("calls"), rejected = observed("rejections");
			assert.ok(checks > 100000); assert.ok(calls > 4000); assert.equal(rejected, 33);
			assert.equal(installed.observation.results.filter(entry => entry.status === "rejected-at-compile-time").length, 10);
			t.diagnostic(`${path}/${profile}: ${checks} assertions, ${calls} calls, ten compiler rejections and ${faults.checks} injected failures passed`);
			reports.push({ profile, path, checks, calls, rejected
				, ...installed, faults, nativeFaults
				, installedFiles: installedReceipt.files
				, packages: receipt.packages, receiptSha256
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
				, modelSha256: sha256(canonicalJson(model))
				, sourceRemovedBeforeInstallation: true });
			await rm(profileConsumer, { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	assert.ok(reports.every(report => canonicalJson(report.jvm.nativeLibraries) === canonicalJson(reports[0].jvm.nativeLibraries)));
	await saveLakeFile("build/variants", "jvm.json", canonicalJson({ schemaVersion: 1, reports }));
});
