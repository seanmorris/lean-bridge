/**
 * Original installed Maven archives run Java and metadata-backed Kotlin callbacks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment } from "./helpers/copied-fixture-install.mjs";
import { structuredCallableArities, structuredCallableExports, structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { jvmStructuredCallableSignatures, jvmStructuredCallableConsumer, jvmStructuredCallableRejections, jvmStructuredCallableExamples } from "./helpers/jvm-structured-callable-fixture.mjs";
import { prepareJvmCorpusDependencies } from "./helpers/type-corpus-jvm-tools.mjs";
import { installedJvmCorpus } from "./helpers/type-corpus-jvm.mjs";
import { checkJvmStructuredFaults } from "./helpers/jvm-structured-callable-faults.mjs";

test("installed Java and Kotlin structured callables preserve typed values and ownership on both authoring paths", { skip: process.env.LEAN_BRIDGE_JVM_STRUCTURED_CALLABLE_TEST !== "1", timeout: 1_800_000 }, async t => {
	const reports = [], expected = jvmStructuredCallableSignatures(structuredCallableReviewedIr());
	const environment = nativeFixtureEnvironment(["java", "kotlin"]);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-structured-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-structured-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release");
		const incoming = join(consumer, "incoming"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/structured-callables", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Structured"]
			, targets: { maven: { name: "org.leanbridge:structured", version: "1.0.0" } }
			, ...path === "ordinary-source" ? { exports: structuredCallableExports()
				, arities: Object.fromEntries(Object.entries(structuredCallableArities).filter(([name]) => structuredCallableExports().includes(name))) } : {} }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "structured.binding-ir.json", canonicalJson(structuredCallableReviewedIr()));
		t.diagnostic(`${path}: compiling the structured Java/Kotlin Maven package`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["maven"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		assert.deepEqual(jvmStructuredCallableSignatures(model.bindingIr), expected);
		const projection = compileCopiedJvmModel(model.bindingIr);
		const receipt = await copyPackageSetHandoff(outputRoot, incoming), pkg = receipt.packages.find(entry => entry.role === "component");
		await verifyPackageSetReceipt({ receiptPath: join(incoming, "package-set-receipt.json") });
		await rename(incoming, handoff);
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		const dependencies = await prepareJvmCorpusDependencies({ directory: author, handoff, pkg, environment, clean: copiedCleanEnvironment });
		await rm(author, { recursive: true, force: true });
		const inspectInstalled = async ({ project, extracted, installedJar, receipt, classpath, tools }) => {
			const prefix = "META-INF/lean-bridge/jvm/", sources = {};
			for(const file of Object.keys(receipt.files).filter(path => path.startsWith(prefix)))
				sources[file.slice(prefix.length)] = await readFile(join(extracted, file), "utf8");
			return checkJvmStructuredFaults({ root: project, sources, jar: installedJar, environment, tools, classpath, projection });
		};
		for(const profile of ["java", "kotlin"])
		{
			t.diagnostic(`${path}/${profile}: installing the original JAR offline and executing twice with a runtime-only JVM`);
			const installed = await installedJvmCorpus({ library: { jvmModule: "org.leanbridge.structured" }
				, profile, consumer, handoff, pkg, dependencies, environment
				, clean: copiedCleanEnvironment
				, fixture: {
					source: jvmStructuredCallableConsumer
					, signatures: jvmStructuredCallableConsumer
					, rejections: jvmStructuredCallableRejections
					, examples: jvmStructuredCallableExamples
					, removeHandoffBeforeExecution: profile === "kotlin"
					, ...profile === "java" ? { inspectInstalled } : {}
				}
			}).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
			const checks = Number(installed.observation.results.find(entry => entry.id === "structured/assertions").observed.integer);
			assert.ok(checks > 50000);
			assert.equal(installed.observation.results.filter(entry => entry.status === "rejected-at-compile-time").length, jvmStructuredCallableRejections(profile).length);
			t.diagnostic(`${path}/${profile}: ${checks} checks and ${jvmStructuredCallableRejections(profile).length} compiler rejections`);
			reports.push({ path, profile, checks, signatures: expected
				, ...installed
				, packages: receipt.packages, receiptSha256
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, sourceRemovedBeforeInstallation: true
				, relocatedBeforeInstallation: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	const reportPath = resolve(process.env.LEAN_BRIDGE_JVM_STRUCTURED_CALLABLE_REPORT ?? "build/structured-callables/jvm.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports }));
});
