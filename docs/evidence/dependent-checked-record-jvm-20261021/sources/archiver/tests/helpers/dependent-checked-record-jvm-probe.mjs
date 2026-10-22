/**
 * Compile-time API-shape and Kotlin nullability probes for dependent checked-record Maven
 * packages. Full APIs expose checked inputs; result-only APIs expose none.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	inspectFinContainerEdgeJvmArchive
} from "./fin-container-edge-jvm-closure.mjs";
import { copiedCleanEnvironment } from "./copied-fixture-install.mjs";
import {
	dependentCheckedRecordJvmProfiles, dependentCheckedRecordJvmRoutes, dependentCheckedRecordJvmSelection
} from "./dependent-checked-record-jvm-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";
import { captureCorpusCompiler } from "./type-corpus-compiler.mjs";

export const dependentCheckedRecordJvmInputNames = Object.freeze([
	"dependentTotal", "dependentRoundtrip"
]);

/**
 * Reference every checked-input API without coupling to carrier names.
 *
 * @param profile - Java or Kotlin public API.
 */
export const dependentCheckedRecordJvmProbeSource = profile => {
	assert.ok(dependentCheckedRecordJvmProfiles.includes(profile));
	if(profile === "java")
		return "import org.leanbridge.dependentrecords.*;\nfinal class Probe {\n"
			+ dependentCheckedRecordJvmInputNames.map(name =>
				`    static Object ${name}() { return Api.${name}(null); }\n`
			).join("") + "}\n";
	return "import org.leanbridge.dependentrecords.kotlin.*\n"
		+ dependentCheckedRecordJvmInputNames.map(name =>
			`val probe${name[0].toUpperCase()}${name.slice(1)} = Api::${name}\n`
		).join("");
};

/**
 * Require full success or exactly two missing input members.
 *
 * @param record - Captured compiler invocation and outputs.
 * @param profile - Java or Kotlin public API.
 * @param route - Exact author/API route.
 */
export const checkDependentCheckedRecordJvmProbe = (record, profile, route) => {
	assert.ok(dependentCheckedRecordJvmProfiles.includes(profile));
	assert.ok(dependentCheckedRecordJvmRoutes.includes(route));
	const resultOnly = dependentCheckedRecordJvmSelection(route).resultOnly;
	const source = dependentCheckedRecordJvmProbeSource(profile);
	assert.equal(record.profile, profile);
	assert.equal(record.route, route);
	assert.equal(record.source, source);
	assert.equal(record.sourceSha256, sha256(source));
	assert.match(record.archiveSha256, /^[a-f0-9]{64}$/u);
	assert.equal(record.run.stdout, "");
	if(!resultOnly)
	{
		assert.equal(record.run.code, 0, record.run.stderr);
		assert.equal(record.run.stderr, "");
		assert.ok(Object.keys(record.outputs).length > 0);
		return;
	}
	assert.equal(record.run.code, 1);
	assert.deepEqual(record.outputs, {});
	const diagnostics = profile === "java"
		? [...record.run.stderr.matchAll(
			/^probe\.java:(\d+):(\d+): (compiler\.err\.[^\n]+)$/gmu)]
		: [...record.run.stderr.matchAll(
			/^probe\.kt:(\d+):(\d+): error: \[([^\]]+)\] ([^\n]+)$/gmu)];
	assert.equal(diagnostics.length, dependentCheckedRecordJvmInputNames.length
		, record.run.stderr);
	assert.doesNotMatch(record.run.stderr, /compiler\.warn\.|warning:/u);
	const found = [];
	for(const [, lineText, columnText, code, message] of diagnostics)
	{
		const line = Number(lineText), column = Number(columnText);
		assert.ok(Number.isSafeInteger(column) && column > 0);
		if(profile === "kotlin") assert.equal(code, "UNRESOLVED_REFERENCE");
		else assert.match(code
			, /^compiler\.err\.cant\.resolve\.location(?:\.args)?:/u);
		const text = profile === "java" ? code : message;
		const name = dependentCheckedRecordJvmInputNames.find(item =>
			new RegExp(`\\b${item}\\b`, "u").test(text));
		assert.ok(name, text); found.push(name);
		assert.equal(line, source.split("\n").findIndex(value => value.includes(
			profile === "java" ? `Api.${name}(` : `Api::${name}`
		)) + 1);
	}
	assert.deepEqual(found.sort(), [...dependentCheckedRecordJvmInputNames].sort());
};

/**
 * Compile an API-shape probe against the exact authenticated package.
 *
 * @param options - Closed package and explicit compiler selection.
 * @param options.root - Fresh probe directory.
 * @param options.archive - Original authenticated JAR bytes.
 * @param options.archiveSha256 - Original JAR digest.
 * @param options.environment - Explicit Java and Kotlin tool environment.
 * @param options.profile - Java or Kotlin public API.
 * @param options.route - Exact author/API route.
 * @param options.output - Retained record directory.
 */
export const runDependentCheckedRecordJvmProbe = async options => {
	const {
		root, archive, archiveSha256, environment, profile, route, output
	} = options;
	assert.ok(dependentCheckedRecordJvmProfiles.includes(profile));
	assert.ok(dependentCheckedRecordJvmRoutes.includes(route));
	inspectFinContainerEdgeJvmArchive(archive, archiveSha256);
	await assert.rejects(access(root), { code: "ENOENT" });
	await mkdir(root, { recursive: true });
	const source = dependentCheckedRecordJvmProbeSource(profile);
	const name = profile === "java" ? "probe.java" : "probe.kt";
	await saveLakeFile(root, "component.jar", archive);
	await saveLakeFile(root, name, source);
	await mkdir(join(root, "classes"));
	const command = profile === "java"
		? environment.LEAN_BRIDGE_JAVAC : environment.LEAN_BRIDGE_KOTLINC;
	const args = profile === "java" ? [
		"--release", "22", "-Werror", "-proc:none", "-XDrawDiagnostics"
		, "-cp", "component.jar", "-d", "classes", name
	] : [
		"-Werror", "-jvm-target", "22", "-Xrender-internal-diagnostic-names"
		, "-cp", "component.jar", name, "-d", "classes"
	];
	const environmentVariables = profile === "java" ? copiedCleanEnvironment : {
		...copiedCleanEnvironment, PATH: "/usr/bin:/bin"
		, JAVA_HOME: dirname(dirname(environment.LEAN_BRIDGE_JAVA))
	};
	const run = await captureCorpusCompiler(
		command, args, root, environmentVariables);
	const outputs = {};
	for(const path of await nativeArtifactPaths(join(root, "classes")))
	{
		const bytes = await readFile(join(root, "classes", path));
		outputs[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		await saveLakeFile(output, "classes/" + path, bytes);
	}
	const record = {
		profile, route, command, args, cwd: root
		, environment: environmentVariables, source
		, sourceSha256: sha256(source), archiveSha256, run, outputs
	};
	await saveLakeFile(output, name, source);
	await saveLakeFile(output, "record.json", canonicalJson(record));
	assert.deepEqual(await readFile(join(root, "component.jar")), archive);
	checkDependentCheckedRecordJvmProbe(record, profile, route);
	return record;
};

const kotlinCalls = Object.freeze({
	dependentTotal: "Api.dependentTotal(Dependent(java.math.BigInteger.TWO, java.math.BigInteger.ONE))"
	, dependentRoundtrip: "Api.dependentRoundtrip(Dependent(java.math.BigInteger.TWO, java.math.BigInteger.ONE))"
	, dependentResult: "Api.dependentResult(java.math.BigInteger.ZERO)"
});
const inputCount = dependentCheckedRecordJvmInputNames.length;

/**
 * Change only argument expressions between valid and null Kotlin probes.
 *
 * @param route - Exact author/API route.
 * @param invalid - Whether every argument is deliberately null.
 */
export const dependentCheckedRecordKotlinNullSource = (route, invalid) => {
	const selection = dependentCheckedRecordJvmSelection(route);
	assert.equal(typeof invalid, "boolean");
	const names = selection.resultOnly
		? Object.keys(kotlinCalls).slice(inputCount) : Object.keys(kotlinCalls);
	return "import org.leanbridge.dependentrecords.kotlin.*\n"
		+ names.map(name => `fun ${name}Null() = ${invalid
			? `Api.${name}(null)` : kotlinCalls[name]}\n`).join("");
};

/**
 * Require a successful control or only non-null Kotlin diagnostics.
 *
 * @param record - Captured Kotlin compiler invocation and outputs.
 * @param route - Exact author/API route.
 * @param invalid - Whether this is the deliberate null negative probe.
 */
export const checkDependentCheckedRecordKotlinNullProbe = (record, route, invalid) => {
	const source = dependentCheckedRecordKotlinNullSource(route, invalid);
	assert.equal(record.route, route);
	assert.equal(record.invalid, invalid);
	assert.equal(record.source, source);
	assert.equal(record.sourceSha256, sha256(source));
	assert.match(record.archiveSha256, /^[a-f0-9]{64}$/u);
	assert.equal(record.run.stdout, "");
	if(!invalid)
	{
		assert.equal(record.run.code, 0, record.run.stderr);
		assert.equal(record.run.stderr, "");
		assert.ok(Object.keys(record.outputs).length > 0);
		return;
	}
	assert.equal(record.run.code, 1);
	assert.deepEqual(record.outputs, {});
	const diagnostics = [...record.run.stderr.matchAll(
		/^NullProbe\.kt:(\d+):(\d+): error: \[([^\]]+)\] ([^\n]+)$/gmu)];
	const names = dependentCheckedRecordJvmSelection(route).resultOnly
		? Object.keys(kotlinCalls).slice(inputCount) : Object.keys(kotlinCalls);
	assert.equal(diagnostics.length, names.length, record.run.stderr);
	assert.doesNotMatch(record.run.stderr, /warning:/u);
	assert.deepEqual(diagnostics.map(([, line]) => Number(line))
		, names.map((_, index) => index + 2));
	for(const [, , column, code] of diagnostics)
	{
		assert.ok(Number(column) > 0);
		assert.equal(code, "NULL_FOR_NONNULL_TYPE");
	}
};

/**
 * Compile one Kotlin nullability control or deliberate negative probe.
 *
 * @param options - Closed package and explicit compiler selection.
 * @param options.root - Fresh probe directory.
 * @param options.archive - Original authenticated JAR bytes.
 * @param options.archiveSha256 - Original JAR digest.
 * @param options.environment - Explicit Java and Kotlin tool environment.
 * @param options.route - Exact author/API route.
 * @param options.invalid - Whether every argument is deliberately null.
 * @param options.output - Retained record directory.
 */
export const runDependentCheckedRecordKotlinNullProbe = async options => {
	const {
		root, archive, archiveSha256, environment, route, invalid, output
	} = options;
	inspectFinContainerEdgeJvmArchive(archive, archiveSha256);
	await assert.rejects(access(root), { code: "ENOENT" });
	await mkdir(root, { recursive: true });
	const source = dependentCheckedRecordKotlinNullSource(route, invalid);
	await saveLakeFile(root, "component.jar", archive);
	await saveLakeFile(root, "NullProbe.kt", source);
	await mkdir(join(root, "classes"));
	const command = environment.LEAN_BRIDGE_KOTLINC;
	const args = [
		"-Werror", "-jvm-target", "22", "-Xrender-internal-diagnostic-names"
		, "-cp", "component.jar", "NullProbe.kt", "-d", "classes"
	];
	const environmentVariables = {
		...copiedCleanEnvironment, PATH: "/usr/bin:/bin"
		, JAVA_HOME: dirname(dirname(environment.LEAN_BRIDGE_JAVA))
	};
	const run = await captureCorpusCompiler(
		command, args, root, environmentVariables);
	const outputs = {};
	for(const path of await nativeArtifactPaths(join(root, "classes")))
	{
		const bytes = await readFile(join(root, "classes", path));
		outputs[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		await saveLakeFile(output, "classes/" + path, bytes);
	}
	const record = {
		route, invalid, command, args, cwd: root
		, environment: environmentVariables, source
		, sourceSha256: sha256(source), archiveSha256, run, outputs
	};
	await saveLakeFile(output, "NullProbe.kt", source);
	await saveLakeFile(output, "record.json", canonicalJson(record));
	assert.deepEqual(await readFile(join(root, "component.jar")), archive);
	checkDependentCheckedRecordKotlinNullProbe(record, route, invalid);
	return record;
};
