/**
 * Original collection Maven packages installed independently by Java and Kotlin.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, statfs } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { sourceApiIdentity } from "../src/analyze/semantic-model.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { compileCopiedJvmModel } from "../src/backends/jvm/copied-model.mjs";
import { compileCopiedKotlinModel } from "../src/backends/jvm/copied-kotlin.mjs";
import { collectionReviewedIr, collectionSignatures, writeCollectionProject } from "./helpers/collection-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { nativeFixtureEnvironment, copiedCleanEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import { prepareJvmCorpusDependencies } from "./helpers/type-corpus-jvm-tools.mjs";
import { installedJvmCorpus } from "./helpers/type-corpus-jvm.mjs";
import { jvmCollectionConsumer, jvmCollectionDocumentation, jvmCollectionPublicChecks, jvmCollectionRejections } from "./helpers/jvm-collection-fixture.mjs";
import { checkJvmCollectionFaults } from "./helpers/jvm-collection-faults.mjs";

const type = value => value.kind === "primitive" ? value.name : value.kind === "array"
	? { array: type(value.element) } : { record: value.name, fields: Object.fromEntries(value.fields.map(field => [field.name, type(field.type)])) };

test("installed Java and Kotlin collections preserve copied values on both source paths", { skip: process.env.LEAN_BRIDGE_JVM_COLLECTION_TEST !== "1", timeout: 1_800_000 }, async t => {
	const reports = [], environment = nativeFixtureEnvironment(["java", "kotlin"]);
	const profiles = (process.env.LEAN_BRIDGE_JVM_COLLECTION_PROFILES ?? "java,kotlin").split(",");
	assert.ok(profiles.length > 0 && new Set(profiles).size === profiles.length);
	assert.ok(profiles.every(profile => ["java", "kotlin"].includes(profile)));
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const space = await statfs(tmpdir());
		assert.ok(space.bavail * space.bsize >= 4 * 1024 ** 3, "Need 4 GiB available before starting a native collection build");
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-collection-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-collection-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await writeCollectionProject(projectRoot);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["Collections"]
			, targets: { maven: { name: "org.leanbridge:collections", version: "1.0.0" } }
			, ...(path === "ordinary-source" ? { exports: collectionSignatures.map(item => item.name) } : {}) }));
		if(path === "reviewed-ir") await saveLakeFile(projectRoot, "reviewed.binding-ir.json", canonicalJson(collectionReviewedIr()));
		t.diagnostic(`${path}: compiling 35 collection exports for Java and Kotlin`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["maven"], environment }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json")));
		const signatures = model.exports.map(item => ({ name: item.name, parameters: item.parameters.map(parameter => type(parameter.type)), result: type(item.result) }));
		const sort = values => [...values].sort((a, b) => a.name.localeCompare(b.name));
		assert.deepEqual(sort(signatures), sort(collectionSignatures));
		const jvm = join(outputRoot, "native/jvm"), metadata = JSON.parse(await readFile(join(jvm, "native-jvm.json")));
		await verifyNativeFiles(jvm, metadata.files);
		const kotlinFiles = JSON.parse(await readFile(join(jvm, "binding-manifest.json"))).kotlin.internalFiles;
		const allSources = Object.fromEntries(await Promise.all(Object.keys(metadata.files).filter(path => path.endsWith(".java")).map(async path => [path, await readFile(join(jvm, path), "utf8")])));
		const sources = Object.fromEntries(Object.entries(allSources).filter(([path]) => !kotlinFiles.includes(path)));
		const receipt = await copyPackageSetHandoff(outputRoot, handoff), pkg = receipt.packages.find(entry => entry.role === "component");
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		const receiptSha256 = sha256(await readFile(join(handoff, "package-set-receipt.json")));
		const dependencies = await prepareJvmCorpusDependencies({ directory: author, handoff, pkg, environment, clean: copiedCleanEnvironment });
		await rm(author, { recursive: true, force: true });
		const jar = join(handoff, pkg.artifacts.find(artifact => artifact.path.endsWith(".jar")).path);
		const installedReceipt = JSON.parse((await runCopied("/usr/bin/unzip", ["-p", jar, "META-INF/lean-bridge/package-receipt.json"], consumer)).stdout);
		const faults = await checkJvmCollectionFaults({ consumer, environment, sources, jar, projection: compileCopiedJvmModel(model.bindingIr) });
		const kotlinFaults = profiles.includes("kotlin") ? await checkJvmCollectionFaults({ consumer, environment, sources: allSources, jar, projection: compileCopiedKotlinModel(model.bindingIr), profile: "kotlin", dependencies, handoff }) : null;
		assert.equal(sha256(await readFile(jar)), pkg.artifacts.find(artifact => artifact.path.endsWith(".jar")).sha256);
		for(const profile of profiles)
		{
			const profileConsumer = join(consumer, `consumer-${profile}`), profileHandoff = join(profileConsumer, "handoff");
			await mkdir(profileConsumer); await cp(handoff, profileHandoff, { recursive: true });
			t.diagnostic(`${path}/${profile}: offline Maven installation, negative compilers and runtime-only relocation`);
			const installed = await installedJvmCorpus({ library: { jvmModule: "org.leanbridge.collections" }
				, profile
				, consumer: profileConsumer
				, handoff: profileHandoff
				, pkg, dependencies, environment
				, clean: copiedCleanEnvironment
				, fixture: { source: jvmCollectionConsumer
					, signatures: jvmCollectionPublicChecks
					, rejections: jvmCollectionRejections
					, removeHandoffBeforeExecution: true } }).catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
			const observed = name => Number(installed.observation.results.find(entry => entry.id === `collections/${name}`).observed.integer);
			const checks = observed("assertions"), calls = observed("calls"), rejected = observed("rejections");
			assert.ok(checks > 100000); assert.ok(calls > 4000); assert.ok(rejected >= 30);
			assert.equal(installed.observation.results.filter(entry => entry.status === "rejected-at-compile-time").length, 8);
			const example = jvmCollectionDocumentation(profile);
			const stdout = installed.observation.results.find(entry => entry.id === "collections/documentation").observed.string;
			assert.equal(stdout, example.stdout);
			const documentation = { sourceSha256: sha256(example.source), stdout, sourceFreeExecution: true, compilerFreeExecution: true, repeatExecution: true };
			reports.push({ profile, path, checks, calls, rejected, signatures
				, ...installed, faults: profile === "kotlin" ? kotlinFaults : faults
				, ...documentation ? { documentation } : {}
				, installedFiles: installedReceipt.files
				, packages: receipt.packages, receiptSha256
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, sourceApiSha256: sourceApiIdentity(model.bindingIr).sha256
				, modelSha256: sha256(canonicalJson(model))
				, sourceRemovedBeforeInstallation: true });
			t.diagnostic(`${path}/${profile}: ${checks} assertions, ${calls} calls, ${rejected} rejected inputs, ${(profile === "kotlin" ? kotlinFaults : faults).checkpoints} injected failures`);
			await rm(profileConsumer, { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	assert.ok(reports.every(report => canonicalJson(report.jvm.nativeLibraries) === canonicalJson(reports[0].jvm.nativeLibraries)));
	const reportFile = profiles.length === 2 ? "jvm.json" : `jvm-${profiles[0]}.json`;
	const reportPath = resolve(process.env.LEAN_BRIDGE_JVM_COLLECTION_REPORT ?? join("build/collections", reportFile));
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, profiles, reports }));
});
