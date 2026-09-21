/**
 * Installed Java and Kotlin compound values on ordinary and reviewed source paths.
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
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { compoundReviewedIr, compoundSignatures } from "./helpers/compound-source-fixture.mjs";
import { jvmCompoundConsumer, jvmCompoundPublicChecks, jvmCompoundRejections } from "./helpers/jvm-compound-fixture.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";
import { prepareJvmCorpusDependencies } from "./helpers/type-corpus-jvm-tools.mjs";
import { installedJvmCorpus } from "./helpers/type-corpus-jvm.mjs";
import { checkJvmCompoundFaults } from "./helpers/jvm-compound-faults.mjs";

const enabled = process.env.LEAN_BRIDGE_JVM_COMPOUND_TEST === "1";
const type = value => value.kind === "primitive" ? value.name : ["array", "option"].includes(value.kind)
	? { [value.kind]: type(value.element) } : ["result", "tuple"].includes(value.kind)
		? { [value.kind]: value.arguments.map(type) } : { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };

test("installed Java and Kotlin compounds preserve copied values on both source paths", { skip: !enabled, timeout: 1_800_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["java", "kotlin"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-compound-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-compound-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/npm-compounds", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Compounds"]
			, targets: { maven: { name: "org.leanbridge:compounds", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: compoundSignatures.map(entry => entry.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(compoundReviewedIr()));
		t.diagnostic(`${path}: compiling the 64-export JVM compound library`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["maven"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const signatures = model.exports.map(entry => ({ name: entry.name, parameters: entry.parameters.map(parameter => type(parameter.type)), result: type(entry.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(compoundSignatures));
		const jvm = join(outputRoot, "native/jvm"), metadata = JSON.parse(await readFile(join(jvm, "native-jvm.json")));
		await verifyNativeFiles(jvm, metadata.files);
		const sources = Object.fromEntries(await Promise.all(Object.keys(metadata.files).filter(path => path.endsWith(".java")).map(async path => [path, await readFile(join(jvm, path), "utf8")])));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff), pkg = receipt.packages.find(entry => entry.role === "component");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		const dependencies = await prepareJvmCorpusDependencies({ directory, handoff, pkg, environment, clean: copiedCleanEnvironment });
		await rm(directory, { recursive: true, force: true });
		const jar = join(handoff, pkg.artifacts.find(artifact => artifact.path.endsWith(".jar")).path);
		const faults = await checkJvmCompoundFaults({ consumer, environment, sources, jar, projection: compileCopiedJvmModel(model.bindingIr) });
		for(const profile of ["java", "kotlin"])
		{
			t.diagnostic(`${path}/${profile}: installing Maven archives offline and running twice without compilers`);
			const installed = await installedJvmCorpus({ library: { jvmModule: "org.leanbridge.compounds" }
				, profile, consumer, handoff, pkg, dependencies, environment
				, clean: copiedCleanEnvironment
				, fixture: { source: jvmCompoundConsumer, signatures: jvmCompoundPublicChecks, rejections: jvmCompoundRejections } }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
			const checks = Number(installed.observation.results.find(entry => entry.id === "compounds/assertions").observed.integer);
			assert.ok(checks > 20000); assert.equal(installed.observation.results.filter(entry => entry.status === "rejected-at-compile-time").length, profile === "java" ? 10 : 11);
			t.diagnostic(`${path}/${profile}: ${checks} assertions, compiler rejections and two runtime-only reruns passed`);
			reports.push({ path, profile, checks, signatures, ...installed, faults
				, packages: receipt.packages, receiptSha256
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, sourceRemovedBeforeInstallation: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	await saveLakeFile("build/compounds", "jvm.json", canonicalJson({ schemaVersion: 1, reports }));
});
