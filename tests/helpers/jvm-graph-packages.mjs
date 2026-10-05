/**
 * Consume original recursive Maven archives from both compiler source paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, rm, statfs } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { buildCanonicalProject } from "../../src/build/canonical-build.mjs";
import { ordinaryJvmEvidence } from "../../src/build/native-jvm-artifacts.mjs";
import { packageOrdinaryMaven } from "../../src/release/native-maven.mjs";
import { verifyPackageSetReceipt } from "../../src/release/package-set-receipt.mjs";
import { createDeterministicZip } from "../../src/release/deterministic-zip.mjs";
import { nativeRecursiveReviewedIr } from "./native-recursive-reviewed.mjs";
import { nativeRecursiveSource } from "./native-recursive-transport.mjs";
import { saveLakeFile, lakeInputState } from "./lake-workspace.mjs";
import { copyPackageSetHandoff } from "./package-set.mjs";
import { copiedCleanEnvironment, nativeFixtureEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { prepareJvmCorpusDependencies } from "./type-corpus-jvm-tools.mjs";
import { installedJvmCorpus } from "./type-corpus-jvm.mjs";

const prepare = async ({ author, handoff, environment, reviewed, diagnostic }) => {
	const projectRoot = join(author, "project"), outputRoot = join(author, "release"), ir = nativeRecursiveReviewedIr();
	await saveLakeFile(projectRoot, "Recursive.lean", await nativeRecursiveSource());
	await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(projectRoot, "lakefile.toml", 'name = "recursive"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Recursive"\n');
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({
		schemaVersion: 1, modules: ["Recursive"]
		, ...reviewed ? {} : { exports: ir.declarations.map(item => item.source.declaration) }
		, targets: { maven: { name: "org.leanbridge:recursive", version: "1.0.0" } } }));
	if(reviewed) await saveLakeFile(projectRoot, "recursive.binding-ir.json", canonicalJson(ir));
	const before = await lakeInputState(projectRoot);
	diagnostic(`${reviewed ? "reviewed" : "ordinary"}: building Maven-only recursive release`);
	const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["maven"], environment })
		.catch(error => { error.message += `: ${JSON.stringify(error.details)}`; throw error; });
	assert.deepEqual(await lakeInputState(projectRoot), before);
	const handoffReceipt = await copyPackageSetHandoff(outputRoot, handoff);
	await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
	assert.equal(handoffReceipt.packages.length, 1); assert.equal(handoffReceipt.packages[0].target, "maven");
	const nativeRoot = join(outputRoot, "native/component"), runtimeRoot = join(outputRoot, "native/runtime");
	const adapterRoot = join(outputRoot, "native/c-binding"), jvmRoot = join(outputRoot, "native/jvm");
	const { model, receipt, adapter } = await ordinaryJvmEvidence({ nativeRoot, runtimeRoot, adapterRoot });
	assert.equal(model.schemaVersion, reviewed ? 5 : 4); assert.equal(model.exports.length, 18);
	assert.equal(adapter.gmp, undefined); assert.equal(adapter.files["include/recursive.h"], undefined);
	assert.ok(Object.keys(adapter.files).every(path => !/gmp|boost/.test(path)));
	assert.ok(adapter.files["src/jvm-graph-clear.c"]);
	const releaseOptions = { working: join(author, "repackaged")
		, jvmRoot, nativeRoot, runtimeRoot, adapterRoot
		, leanPrefix: environment.LEAN_BRIDGE_LEAN_PREFIX
		, settings: { name: "org.leanbridge:recursive", version: "1.0.0" }
		, glibcMinimumVersion: environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR ?? "2.38" };
	const repeated = await packageOrdinaryMaven(releaseOptions); assert.deepEqual(repeated.packages, built.packages);
	await rm(releaseOptions.working, { recursive: true, force: true });
	for(const copiedGraph of [undefined, { schemaVersion: 1, layoutSha256: "0".repeat(64) }, { ...adapter.copiedGraph, extra: true }])
	{
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson({ ...adapter, copiedGraph }));
		await assert.rejects(() => ordinaryJvmEvidence({ nativeRoot, runtimeRoot, adapterRoot }), /JVM C adapter differs/);
	}
	await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	for(const path of ["src/native.c", "include/detail/recursive-graph.h", "include/detail/recursive-graph-types.h", "src/jvm-graph-clear.c"])
	{
		const original = await readFile(join(adapterRoot, path), "utf8"), changed = `${original}\n/* re-signed source drift */\n`;
		await saveLakeFile(adapterRoot, path, changed);
		await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson({ ...adapter, files: { ...adapter.files
			, [path]: { bytes: Buffer.byteLength(changed), sha256: sha256(changed) } } }));
		await assert.rejects(() => packageOrdinaryMaven(releaseOptions), /Generated JVM graph adapter source differs/);
		await saveLakeFile(adapterRoot, path, original); await saveLakeFile(adapterRoot, "native-c-adapter.json", canonicalJson(adapter));
	}
	const pkg = handoffReceipt.packages[0];
	const dependencies = await prepareJvmCorpusDependencies({ directory: author, handoff, pkg, environment, clean: copiedCleanEnvironment });
	return { pkg, dependencies
		, provenance: { exports: 18, bindingIrSha256: built.bindingIrSha256
			, binarySha256: receipt.nativeLibrary.sha256
			, layoutSha256: adapter.copiedGraph.layoutSha256
			, modelSha256: sha256(canonicalJson(model))
			, checkedSourceUnchanged: true, mavenOnly: true
			, deterministicReassembly: true
			, rejectsGraphReceiptDrift: 3, rejectsRegeneratedSourceDrift: 4 } };
};

const signatures = [
	["tree", "Tree", "Tree"], ["forest", "Tree[]", "Tree[]"]
	, ["envelope", "Envelope", "Envelope"], ["scalars", "Scalars", "Scalars"]
	, ["left", "LeftTree", "LeftTree"], ["right", "RightTree", "RightTree"]
	, ["never", "Never", "Never"], ["spine", "Spine", "Spine"]
	, ["grow", "Spine", "Spine"], ["empty", "Tree"]
	, ["joinTrees", "Tree", "Tree", "Tree"], ["inspect", "boolean", "Scalars"]
	, ["wide", "Wide", "Wide"], ["units", "Unit[]", "Unit[]"]
	, ["wordMax", "boolean", "BigInteger"], ["signedMin", "boolean", "long"]
	, ["marker", "Marker", "Marker"], ["emptyRecord", "EmptyRecord", "EmptyRecord"]
];
const publicSignatures = profile => signatures.map(([name, ...types]) => {
	const type = name => profile === "java" ? `${name}.class` : name === "boolean" ? "Boolean::class.javaPrimitiveType!!"
		: name === "long" ? "Long::class.javaPrimitiveType!!" : `${name.endsWith("[]") ? `Array<${name.slice(0, -2)}>` : name}::class.java`;
	return `Wire.method(${profile === "java" ? "Api.class" : "Api::class.java"}, ${JSON.stringify(name)}, ${types.map(type).join(", ")})${profile === "java" ? ";" : ""}`;
}).join("\n");

const rejections = profile => [
	["tree-scalar", "Api.tree(1);", "Api.tree(1)"]
	, ["forest-depth", "Api.forest(new Tree[1][0]);", "Api.forest(arrayOf(emptyArray<Tree>()))"]
	, ["word-narrowing", "Api.wordMax(1L);", "Api.wordMax(1L)"]
	, ["wrong-constructor", "new SpineNext(1);", "SpineNext(1)"]
].map(([name, java, kotlin]) => ({ id: `recursive/${name}`
	, expectation: { kind: "compile-rejection", diagnostic: profile === "java" ? "compiler.err.cant.apply.symbol" : "ARGUMENT_TYPE_MISMATCH" }
	, source: `import org.leanbridge.recursive${profile === "java" ? "" : ".kotlin"}.*;\n${profile === "java" ? `class Invalid { void invalid() { ${java} } }` : `fun invalid() { ${kotlin} }`}\n` }));

const documentation = async (profile, source) => {
	const guide = await readFile(`docs/consume/${profile}.md`, "utf8");
	const section = guide.split("### Recursive values\n")[1]?.split("\n### ")[0];
	const example = section?.match(new RegExp("```" + profile + "\\n([^]*?)\\n```"))?.[1];
	assert.ok(example, `${profile} recursive documentation example`);
	const body = example.replace(/^import .+\n/gm, ""), stdout = "true\nfalse\ntrue\ntrue\n";
	assert.equal(source.split("// DOCUMENTATION").length, 2);
	if(profile === "java")
	{
		source = source.replace("public final class Consumer", `${body}\n\npublic final class Consumer`)
			.replace("// DOCUMENTATION", `var documentationBytes = new java.io.ByteArrayOutputStream();
        var originalOutput = System.out;
        try (var captured = new java.io.PrintStream(documentationBytes, true, java.nio.charset.StandardCharsets.UTF_8)) {
            System.setOut(captured);
            try { Example.main(new String[0]); } finally { System.setOut(originalOutput); }
        }
        var documentationOutput = documentationBytes.toString(java.nio.charset.StandardCharsets.UTF_8);
        verify(documentationOutput.equals(${JSON.stringify(stdout)}));
        Wire.result("recursive/documentation", Wire.text(documentationOutput), true);`);
	} else
	{
		assert.equal(body.split("fun main()").length, 2);
		source += `\n${body.replace("fun main()", "private fun documentationExample()")}\n`;
		source = source.replace("// DOCUMENTATION", `val documentationBytes = java.io.ByteArrayOutputStream()
    val originalOutput = System.out
    java.io.PrintStream(documentationBytes, true, java.nio.charset.StandardCharsets.UTF_8).use { captured ->
        System.setOut(captured)
        try { documentationExample() } finally { System.setOut(originalOutput) }
    }
    val documentationOutput = documentationBytes.toString(java.nio.charset.StandardCharsets.UTF_8)
    verify(documentationOutput == ${JSON.stringify(stdout)})
    Wire.result("recursive/documentation", Wire.text(documentationOutput), true)`);
	}
	return { source
		, evidence: { sourceSha256: sha256(example + "\n"), stdout
			, sourceFreeExecution: true, compilerFreeExecution: true
			, repeatExecution: true } };
};

const tamper = async ({ root, directory, nativeLibraries }) => {
	const deployed = join(root, "relocated"), original = await readFile(join(deployed, "package.jar"));
	await mkdir(directory);
	await runCopied("/usr/bin/unzip", ["-q", join(deployed, "package.jar"), "-d", directory], directory);
	const rejections = [];
	for(const name of Object.keys(nativeLibraries))
	{
		const path = `META-INF/lean-bridge/native/linux-x64/${name}`, bytes = await readFile(join(directory, path));
		const changed = Buffer.from(bytes); changed[0] ^= 1;
		await saveLakeFile(directory, path, changed);
		await saveLakeFile(root, "tampered.jar", await createDeterministicZip({ directory, sourceDateEpoch: 315532800 }));
		const dependencies = (await readdir(join(deployed, "dependencies"))).map(name => join(deployed, "dependencies", name));
		const result = await runCopied(join(root, "runtime-only/bin/java"), ["--enable-native-access=ALL-UNNAMED"
			, `-Djava.io.tmpdir=${root}`, "-cp"
			, [join(deployed, "classes"), join(root, "tampered.jar"), ...dependencies].join(":")
			, "Tamper"], root);
		assert.equal(result.stdout, "rejected-before-native-loading\n"); assert.equal(result.stderr, "");
		rejections.push({ name, tamperedJarSha256: sha256(await readFile(join(root, "tampered.jar"))) });
		await saveLakeFile(directory, path, bytes); await rm(join(root, "tampered.jar"));
	}
	assert.equal(sha256(await readFile(join(deployed, "package.jar"))), sha256(original));
	await rm(directory, { recursive: true, force: true }); return rejections;
};

/**
 * Build serially, remove author inputs, install offline and relocate both APIs.
 *
 * @param directory - Test-owned temporary root.
 * @param diagnostic - Progress callback for long native builds.
 */
export const checkJvmGraphPackages = async (directory, diagnostic = () => {}) => {
	const environment = nativeFixtureEnvironment(["java", "kotlin"]), observations = [];
	for(const reviewed of [false, true])
	{
		const space = await statfs(directory); assert.ok(Number(space.bavail) * Number(space.bsize) >= 2 * 1024 ** 3, "Recursive Maven acceptance needs 2 GiB free at each source-path start");
		const root = join(directory, reviewed ? "reviewed" : "ordinary"), author = join(root, "author"), handoff = join(root, "handoff");
		const { pkg, dependencies, provenance } = await prepare({ author, handoff, environment, reviewed, diagnostic });
		await rm(author, { recursive: true, force: true }); await assert.rejects(() => readdir(author), { code: "ENOENT" });
		for(const profile of ["java", "kotlin"])
		{
			const profileHandoff = join(root, `handoff-${profile}`); await cp(handoff, profileHandoff, { recursive: true });
			const path = `tests/fixtures/structured-types/recursive-${profile === "java" ? "jvm-installed.java" : "kotlin-installed.kt"}`;
			const original = await readFile(path, "utf8");
			const prepared = original.replace("// WIDE_SETTERS", Array.from({ length: 255 }, (_, index) => `        builder.field${index}(${index})${profile === "java" ? ";" : ""}`).join("\n"))
				.replace("// SIGNATURES", publicSignatures(profile));
			const { source, evidence: documented } = await documentation(profile, prepared);
			diagnostic(`${reviewed ? "reviewed" : "ordinary"}/${profile}: offline Maven install and runtime-only relocation`);
			const { observation, jvm } = await installedJvmCorpus({ library: { jvmModule: "org.leanbridge.recursive" }
				, profile, consumer: join(root, "consumer"), handoff: profileHandoff
				, pkg, dependencies, environment, clean: copiedCleanEnvironment
				, fixture: { source: () => source, signatures: publicSignatures, rejections, removeHandoffBeforeExecution: true } });
			assert.equal(observation.errors.length, 0); assert.equal(observation.results.length, 7);
			assert.equal(observation.results.find(item => item.id === "recursive/documentation").observed.string, documented.stdout);
			const checks = Number(observation.results.find(item => item.id === "recursive/checks").observed.integer);
			assert.ok(checks > 900); assert.equal(observation.results.filter(item => item.status === "rejected-at-compile-time").length, 4);
			const tamperRejections = profile === "java" ? await tamper({ root: join(root, "consumer/java"), directory: join(root, "tamper"), nativeLibraries: jvm.nativeLibraries }) : [];
			observations.push({ reviewed, profile, package: pkg
				, ...provenance
				, checks, observation, jvm, tamperRejections
				, documentation: documented
				, sourceRemovedBeforeInstallation: true
				, probeSha256: sha256(source) });
			await rm(join(root, "consumer", profile), { recursive: true, force: true });
		}
		await rm(root, { recursive: true, force: true });
	}
	return { schemaVersion: 1, compiledLean: true, installedPackage: true, observations };
};

/**
 * Rebuild ordinary and reviewed packages in fresh directories and compare both
 * Maven artifacts with the exact originals exercised by installed consumers.
 *
 * @param directory - New test-owned scratch root.
 * @param original - Completed installed-package report.
 * @param diagnostic - Progress reporter.
 */
export const checkJvmGraphReproducibility = async (directory, original, diagnostic = () => {}) => {
	assert.equal(original.schemaVersion, 1); assert.equal(original.compiledLean, true);
	assert.equal(original.installedPackage, true);
	assert.deepEqual(original.observations.map(run => [run.reviewed, run.profile]), [[false, "java"], [false, "kotlin"], [true, "java"], [true, "kotlin"]]);
	const environment = nativeFixtureEnvironment(["java", "kotlin"]), observations = [];
	for(const reviewed of [false, true])
	{
		const prior = original.observations.filter(run => run.reviewed === reviewed);
		assert.deepEqual(prior[0].package, prior[1].package);
		const root = join(directory, reviewed ? "reviewed" : "ordinary");
		const { pkg, provenance } = await prepare({ author: join(root, "author")
			, handoff: join(root, "handoff"), environment, reviewed, diagnostic });
		assert.deepEqual(pkg, prior[0].package, "Independent recursive Maven artifacts differ");
		for(const [key, value] of Object.entries(provenance))
			for(const run of prior) assert.deepEqual(value, run[key], `Independent Maven provenance differs: ${key}`);
		observations.push({ reviewed, package: pkg, ...provenance, exactOriginalArtifacts: true });
		await rm(root, { recursive: true, force: true });
	}
	return { schemaVersion: 1, originalReportSha256: sha256(canonicalJson(original)), observations };
};
