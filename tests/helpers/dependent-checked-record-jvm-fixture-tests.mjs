/**
 * Static Maven selection, projection and immutable-caller controls for
 * dependent checked records, plus a contract oracle: the immutable Java caller
 * (and, with the caller gate, the Kotlin caller) compiles against a stand-in
 * of the generated API and its exact totals and fault sensitivity are measured
 * without any Lean component.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import {
	generateCopiedJvmKotlinPackage
} from "../../src/backends/jvm/copied-kotlin.mjs";
import {
	parseDependentCheckedRecordJvmResult, dependentCheckedRecordJvmCaller
	, dependentCheckedRecordJvmCounts, dependentCheckedRecordJvmEnvironment
	, dependentCheckedRecordJvmFixtureRoot, dependentCheckedRecordJvmLeanModule
	, dependentCheckedRecordJvmProfiles, dependentCheckedRecordJvmRoutes
	, dependentCheckedRecordJvmSelection, dependentCheckedRecordJvmTarget
} from "./dependent-checked-record-jvm-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const callerRoot = "tests/fixtures/dependent-checked-record-consumers";
const modelRoot = resolve("tests/helpers/dependent-checked-record-jvm-model");
const javac = resolve(process.env.LEAN_BRIDGE_JAVAC ?? ".toolchains/jdk22/bin/javac");
const java = join(dirname(javac), "java");
const kotlinc = resolve(process.env.LEAN_BRIDGE_KOTLINC
	?? ".toolchains/kotlin-2.2.0/kotlinc/bin/kotlinc");
const callerFlag = process.env.LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_CALLER_TEST;
assert.ok(callerFlag === undefined || callerFlag === "0" || callerFlag === "1");
const inputs = ["dependentTotal", "dependentRoundtrip"];
const results = ["dependentResult"];
const fullOnly = /^[ \t]*\/\/ BEGIN FULL_ONLY\n([\s\S]*?)^[ \t]*\/\/ END FULL_ONLY\n/gmu;

test("dependent JVM selection is closed and explicit", () => {
	assert.deepEqual(dependentCheckedRecordJvmProfiles, ["java", "kotlin"]);
	assert.deepEqual(dependentCheckedRecordJvmEnvironment({}), {
		enabled: false, routes: [...dependentCheckedRecordJvmRoutes], maxLoad: 10
	});
	assert.deepEqual(dependentCheckedRecordJvmEnvironment({ CI: "true" }), {
		enabled: false, routes: [...dependentCheckedRecordJvmRoutes], maxLoad: 6
	});
	assert.deepEqual(dependentCheckedRecordJvmEnvironment({
		LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_TEST: "1"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_ROUTES: "result-only-reviewed-ir"
		, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_MAX_LOAD: "12"
	}), { enabled: true, routes: ["result-only-reviewed-ir"], maxLoad: 12 });
	for(const environment of [
		{ LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_TEST: "yes" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_ROUTES: "ordinary-source" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_TEST: "1"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_ROUTES: "unknown" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_TEST: "1"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_ROUTES: "reviewed-ir,reviewed-ir" }
		, { LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_TEST: "1"
			, LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_MAX_LOAD: "14" }
	]) assert.throws(() => dependentCheckedRecordJvmEnvironment(environment));
});

test("dependent JVM configuration retains four independent routes", () => {
	assert.deepEqual(dependentCheckedRecordJvmTarget
		, { name: "org.leanbridge:dependentrecords", version: "1.0.0" });
	assert.equal(dependentCheckedRecordJvmFixtureRoot
		, "tests/fixtures/onboarding/dependent-checked-records");
	assert.equal(dependentCheckedRecordJvmLeanModule, "DependentRecords");
	for(const route of dependentCheckedRecordJvmRoutes)
	{
		const selection = dependentCheckedRecordJvmSelection(route);
		assert.deepEqual(selection.configuration.targets, {
			maven: dependentCheckedRecordJvmTarget
		});
		assert.deepEqual(selection.configuration.modules, ["DependentRecords"]);
		assert.equal(selection.configuration.exports?.length
			, selection.reviewed ? undefined : selection.resultOnly ? 1 : 3);
		assert.equal(Object.hasOwn(selection.configuration, "contracts")
			, !selection.reviewed);
		assert.deepEqual(selection.expected.declarations.map(item => item.name)
			, selection.resultOnly ? results : [...inputs, ...results]);
		assert.deepEqual(selection.expected.types.map(type => type.name)
			, ["Dependent"]);
		assert.deepEqual(selection.expected.types[0].source.extensions, {
			"lean-lang.org/erased-proofs": { fields: ["valid"] }
			, "lean-lang.org/nominal-refinements": {
				kind: "record", fields: [null, { kind: "fin-field", field: "bound" }]
			}
		});
	}
});

test("dependent JVM carriers keep both retained naturals and the checked constructor", () => {
	for(const route of ["reviewed-ir", "result-only-reviewed-ir"])
	{
		const selection = dependentCheckedRecordJvmSelection(route);
		const files = generateCopiedJvmKotlinPackage(selection.expected);
		const javaRoot = "src/main/java/org/leanbridge/dependentrecords/";
		const kotlinRoot = "src/main/kotlin/org/leanbridge/dependentrecords/kotlin/";
		assert.match(files[javaRoot + "Dependent.java"]
			, /record Dependent\(java\.math\.BigInteger bound, java\.math\.BigInteger below\)/u);
		assert.match(files[javaRoot + "Dependent.java"]
			, /public Dependent \{\s+java\.util\.Objects\.requireNonNull\(bound\);\s+java\.util\.Objects\.requireNonNull\(below\);/u);
		assert.match(files[kotlinRoot + "Dependent.kt"]
			, /class `Dependent`\(@kotlin\.jvm\.JvmField val `bound`: java\.math\.BigInteger, @kotlin\.jvm\.JvmField val `below`: java\.math\.BigInteger\)/u);
		assert.match(files[kotlinRoot + "Dependent.kt"]
			, /init \{\s+java\.util\.Objects\.requireNonNull\(`bound`\)\s+java\.util\.Objects\.requireNonNull\(`below`\)/u);
		for(const path of [javaRoot + "Dependent.java", kotlinRoot + "Dependent.kt"])
			assert.doesNotMatch(files[path], /\bvalid\b/u);
		const runtime = files[javaRoot + "Runtime.java"];
		assert.match(runtime, /if \(status == 1\) throw new IllegalArgumentException\(message\);/u);
		assert.match(runtime, /Nat cannot be negative/u);
		for(const [prefix, extension] of [[javaRoot, "java"], [kotlinRoot, "kt"]])
		{
			const api = files[prefix + `Api.${extension}`];
			for(const name of inputs) assert.equal(
				new RegExp(`\\b${name}\\b`, "u").test(api)
				, !selection.resultOnly, `${route}/${extension}/${name}`);
			for(const name of results)
				assert.match(api, new RegExp(`\\b${name}\\b`, "u"));
		}
		if(!selection.resultOnly)
		{
			const api = files[javaRoot + "Api.java"];
			assert.match(api, /arg0 checked by DependentRecords\.mkDependent; arg0\.below &lt; arg0\.bound/u);
			assert.match(api, /result projects proof-backed record payload fields; result\.below &lt; result\.bound/u);
		}
	}
});

test("dependent JVM callers preserve exact route and receipt counts", async () => {
	for(const profile of dependentCheckedRecordJvmProfiles)
	{
		const extension = profile === "java" ? "java" : "kt";
		const source = await readFile(join(callerRoot, `${profile}.${extension}`), "utf8");
		assert.match(source, /ONE\.shiftLeft\(130\)/u);
		assert.match(source, / was rejected by DependentRecords\.mkDependent"/u);
		assert.match(source, /IllegalArgumentException::class\.java|IllegalArgumentException\.class/u);
		assert.match(source, /"equal fields"/u);
		assert.match(source, /"zero bound"/u);
		assert.match(source, /"dependentTotal export selection"/u);
		assert.match(source, /"dependentRoundtrip export selection"/u);
		assert.match(source, /"dependentResult export selection"/u);
		assert.match(source, profile === "java"
			? /for \(var index = 0; index < 512; index\+\+\) produced\(n\(index\), "result " \+ index\);/u
			: /for \(index in 0 until 512\) produced\(n\(index\.toLong\(\)\), "result \$index"\)/u);
		assert.match(source, profile === "java"
			? /for \(var index = 0; index < 256; index\+\+\) \{/u
			: /for \(index in 0 until 256\) \{/u);
		assert.equal([...source.matchAll(fullOnly)].length, 3);
		for(const route of dependentCheckedRecordJvmRoutes)
		{
			const selection = dependentCheckedRecordJvmSelection(route);
			const caller = await dependentCheckedRecordJvmCaller(profile, route);
			assert.doesNotMatch(caller, /ROUTE_PREFIX|FULL_ONLY/u);
			assert.ok(caller.includes(selection.reviewed ? "value0" : "arg0"));
			for(const name of inputs) assert.equal(
				new RegExp(`Api\\.${name}\\b`, "u").test(caller)
				, !selection.resultOnly, `${profile}/${route}/${name}`);
			for(const name of results)
				assert.match(caller, new RegExp(`Api\\.${name}\\b`, "u"));
			assert.equal(/\brefuse\(/u.test(caller), !selection.resultOnly);
			assert.equal(/\brecover\(\)/u.test(caller), !selection.resultOnly);
			assert.equal(caller.includes("full = true"), !selection.resultOnly);
			const mode = selection.resultOnly ? "result-only" : "full";
			const expected = dependentCheckedRecordJvmCounts[mode];
			assert.deepEqual(parseDependentCheckedRecordJvmResult(
				JSON.stringify(expected), route), expected);
			for(const field of Object.keys(expected))
				assert.throws(() => parseDependentCheckedRecordJvmResult(
					JSON.stringify({ ...expected, [field]: expected[field] + 1 })
					, route));
		}
	}
});

/**
 * Select the oracle's exported members for one route or deliberate fault.
 *
 * @param route - Exact author/API route.
 * @param options - Compile-time oracle faults.
 * @param options.inputsExported - Keep checked inputs in a result-only API.
 * @param options.missingProducer - Drop the producer export entirely.
 * @param options.kotlin - Serve the Kotlin public package instead of Java.
 */
const oracleApi = async (route, { inputsExported = false, missingProducer = false, kotlin = false } = {}) => {
	const selection = dependentCheckedRecordJvmSelection(route);
	let source = await readFile(join(modelRoot, "Api.java"), "utf8");
	assert.match(source, /contract oracle/u);
	assert.equal((source.match(/ROUTE_PREFIX/gu) ?? []).length, 1);
	source = source.replace("ROUTE_PREFIX", selection.reviewed ? "value0" : "arg0");
	assert.equal([...source.matchAll(fullOnly)].length, 1);
	source = source.replace(fullOnly, (_, content) =>
		selection.resultOnly && !inputsExported ? "" : content);
	const producer = /^[ \t]*\/\/ BEGIN PRODUCER\n([\s\S]*?)^[ \t]*\/\/ END PRODUCER\n/gmu;
	assert.equal([...source.matchAll(producer)].length, 1);
	source = source.replace(producer, (_, content) => missingProducer ? "" : content);
	if(kotlin) source = source.replace("package org.leanbridge.dependentrecords;"
		, "package org.leanbridge.dependentrecords.kotlin;");
	return source;
};

test("dependent JVM callers measure exact totals against a stand-in oracle and refuse faults", {
	skip: !existsSync(javac) && "Select LEAN_BRIDGE_JAVAC for the JVM contract oracle"
	, timeout: 1_800_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-dependent-checked-record-jvm-model-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = { PATH: "/usr/bin:/bin", LC_ALL: "C", JAVA_HOME: dirname(dirname(java)) };
	const spawn = (command, args, cwd, extra = {}) => {
		const result = spawnSync(command, args, {
			cwd, encoding: "utf8", env: { ...environment, ...extra }, timeout: 600_000
		});
		assert.equal(result.error, undefined);
		return result;
	};
	// The Java oracle is compiled once per route and fault into the package the
	// profile imports; the Kotlin caller consumes the same records through the
	// `.kotlin` package, so one javac pass serves both profiles.
	const compileOracle = async (name, profile, route, faults) => {
		const directory = join(root, name, profile);
		const kotlin = profile === "kotlin";
		const pkg = "org/leanbridge/dependentrecords" + (kotlin ? "/kotlin" : "");
		await saveLakeFile(directory, `${pkg}/Api.java`, await oracleApi(route, { ...faults, kotlin }));
		for(const file of ["Dependent.java", "LeanBridgeException.java"])
		{
			let source = await readFile(join(modelRoot, file), "utf8");
			if(kotlin) source = source.replace("package org.leanbridge.dependentrecords;"
				, "package org.leanbridge.dependentrecords.kotlin;");
			await saveLakeFile(directory, `${pkg}/${file}`, source);
		}
		await mkdir(join(directory, "oracle"));
		const result = spawn(javac, [
			"--release", "22", "-Werror", "-proc:none", "-d", "oracle"
			, `${pkg}/Api.java`, `${pkg}/Dependent.java`
			, `${pkg}/LeanBridgeException.java`
		], directory);
		assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
		return directory;
	};
	const compileCaller = async (directory, profile, route) => {
		const caller = await dependentCheckedRecordJvmCaller(profile, route);
		if(profile === "java")
		{
			await saveLakeFile(directory, "consumer.java", caller);
			await mkdir(join(directory, "classes"));
			const result = spawn(javac, [
				"--release", "22", "-Werror", "-proc:none", "-cp", "oracle"
				, "-d", "classes", "consumer.java"
			], directory);
			return { status: result.status, output: result.stdout + result.stderr
				, classpath: "oracle:classes", main: "Consumer" };
		}
		await saveLakeFile(directory, "consumer.kt", caller);
		const result = spawn(kotlinc, [
			"-Werror", "-jvm-target", "22", "-cp", "oracle", "consumer.kt"
			, "-include-runtime", "-d", "consumer.jar"
		], directory);
		return { status: result.status, output: result.stdout + result.stderr
			, classpath: "oracle:consumer.jar", main: "ConsumerKt" };
	};
	const execute = (directory, built, fault) => spawn(java, [
		"-cp", built.classpath, built.main
	], directory, fault ? { LEAN_BRIDGE_DEPENDENT_FAULT: fault } : {});
	// Each kotlinc pass costs about eight seconds, so the Kotlin caller is
	// measured only with the generated-API compile gate; Java always runs.
	const kotlin = callerFlag === "1" && existsSync(kotlinc);
	const profiles = kotlin ? dependentCheckedRecordJvmProfiles : ["java"];
	if(!kotlin) t.diagnostic("Kotlin oracle measured only with LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_CALLER_TEST=1");
	const builds = new Map();
	for(const profile of profiles) for(const route of dependentCheckedRecordJvmRoutes)
	{
		const selection = dependentCheckedRecordJvmSelection(route);
		const directory = await compileOracle(route, profile, route, {});
		const built = await compileCaller(directory, profile, route);
		assert.equal(built.status, 0, built.output);
		builds.set(`${profile}/${route}`, { directory, built });
		const run = execute(directory, built);
		assert.equal(run.status, 0, run.stderr); assert.equal(run.stderr, "");
		const mode = selection.resultOnly ? "result-only" : "full";
		assert.deepEqual(parseDependentCheckedRecordJvmResult(run.stdout, route)
			, dependentCheckedRecordJvmCounts[mode]);
		t.diagnostic(`${profile}/${route}: stand-in oracle passed with ${dependentCheckedRecordJvmCounts[mode].checks} checks`);
	}
	for(const profile of profiles) for(const [route, faults] of [
		["ordinary-source", [
			"accept-invalid", "wrong-status", "wrong-message", "wrong-produced"
			, "wrong-roundtrip"
		]]
		, ["result-only-ordinary-source", ["wrong-produced"]]
	]) for(const fault of faults)
	{
		const { directory, built } = builds.get(`${profile}/${route}`);
		const run = execute(directory, built, fault);
		assert.equal(run.status, 1, `${profile} ${route} ${fault}`);
		// A wrong status surfaces as the foreign LeanBridgeException the callers
		// deliberately do not catch; every other fault fails an exact check.
		assert.match(run.stderr
			, /dependent-record assertion failed|Accepted invalid dependent record|exact caller totals|LeanBridgeException/u);
	}
	// A missing producer cannot even compile the callers; input exports that
	// leak into the result-only API are refused by the callers at run time.
	for(const profile of profiles)
	{
		const missing = await compileOracle("missing", profile, "ordinary-source", { missingProducer: true });
		const built = await compileCaller(missing, profile, "ordinary-source");
		assert.notEqual(built.status, 0); assert.match(built.output, /dependentResult/u);
		const leaked = await compileOracle("leaked", profile, "result-only-ordinary-source", { inputsExported: true });
		const leakedBuilt = await compileCaller(leaked, profile, "result-only-ordinary-source");
		assert.equal(leakedBuilt.status, 0, leakedBuilt.output);
		const run = execute(leaked, leakedBuilt);
		assert.equal(run.status, 1); assert.match(run.stderr, /export selection/u);
	}
});
