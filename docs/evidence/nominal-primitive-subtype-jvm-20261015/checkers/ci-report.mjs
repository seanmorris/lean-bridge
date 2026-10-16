/**
 * Require one complete installed nineteen-base JVM selection and independently measured tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { nominalPrimitiveSubtypeJvmRoutes, nominalPrimitiveSubtypeJvmModes } from "./nominal-primitive-subtype-jvm-fixture.mjs";
import { checkNominalPrimitiveSubtypeJvmReport } from "./nominal-primitive-subtype-jvm-report.mjs";

/**
 * Select an installed producer, excluding compiler and archive unit tests.
 *
 * @param route - Ordinary source or independent review.
 * @param mode - Full or constructor-free result-only package.
 */
export const nominalPrimitiveSubtypeJvmCiTestName = (route, mode) => {
	assert.ok(nominalPrimitiveSubtypeJvmRoutes.includes(route));
	assert.ok(nominalPrimitiveSubtypeJvmModes.includes(mode));
	return `installed primitive-base nominal JVM packages reproduce and relocate ${route} ${mode}`;
};

/**
 * Reject unknown, duplicate and incomplete arguments before opening records.
 *
 * @param args - Arguments following the checker script name.
 */
export const parseNominalPrimitiveSubtypeJvmCiArgs = args => {
	const usage = "Usage: check-nominal-primitive-subtype-jvm-ci.mjs --route ordinary|reviewed --mode full|result-only --producer <commit> --directory <records> --tap <original-tap> --glibc 2.36|2.38 --java /absolute/java --javac /absolute/javac --kotlinc /absolute/kotlinc";
	const allowed = ["route", "mode", "producer", "directory", "tap", "glibc", "java", "javac", "kotlinc"], selected = {};
	assert.ok(Array.isArray(args) && args.length % 2 === 0, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length > 0 && !value.startsWith("--") && !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
	nominalPrimitiveSubtypeJvmCiTestName(selected.route, selected.mode);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	assert.ok(["2.36", "2.38"].includes(selected.glibc), usage);
	for(const key of ["java", "javac", "kotlinc"]) assert.ok(isAbsolute(selected[key]), usage);
	return selected;
};

/**
 * Require exactly one successful result and complete zero-skip TAP totals.
 *
 * @param source - Original combined producer output.
 * @param route - Required author route.
 * @param mode - Required package API.
 */
export const assertNominalPrimitiveSubtypeJvmCiTap = (source, route, mode) => {
	const name = nominalPrimitiveSubtypeJvmCiTestName(route, mode);
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.doesNotMatch(source, /^[ \t]+(?:ok |not ok |# Subtest:|Bail out!)/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..1"]);
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

/**
 * Bind complete package and execution records to the explicit current toolchain.
 *
 * @param options - Closed producer, route, mode, floor and executable selection.
 * @param original - Original records and independently observed host facts.
 * @param original.tap - Complete original producer output.
 * @param original.read - Selection-relative byte reader, supplemented from the JAR.
 * @param original.runtime - Actual checker platform, architecture and glibc.
 * @param original.tools - Fresh Java, javac and Kotlin observations.
 * @param original.archiveSha256 - Digest derived from the original verified JAR.
 */
export const checkNominalPrimitiveSubtypeJvmCiRecords = async (options, { tap, read, runtime, tools, archiveSha256 }) => {
	const selected = parseNominalPrimitiveSubtypeJvmCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertNominalPrimitiveSubtypeJvmCiTap(tap, selected.route, selected.mode);
	for(const key of ["java", "javac", "kotlinc"])
	{
		assert.equal(tools[key].command, selected[key]);
		assert.match(tools[key].sha256, /^[a-f0-9]{64}$/u);
	}
	assert.match(tools.java.version, /^(?:openjdk|java) 22\.0\.2[ +]/u);
	assert.equal(tools.javac.version, "javac 22.0.2");
	assert.match(tools.kotlinc.version, /^info: kotlinc-jvm 2\.2\.0 \(JRE 22\.0\.2[+)]/u);
	const report = JSON.parse(await read("report.json"));
	for(const index of [0, 1])
	{
		const compiled = JSON.parse(await read(`build-${index}/native-jvm.json`));
		assert.equal(compiled.compiler, tools.javac.version);
		assert.equal(compiled.kotlin.version, tools.kotlinc.version);
		assert.deepEqual(compiled.kotlin.compilerFiles, tools.kotlinc.compilerFiles);
	}
	for(const consumer of report.consumers)
	{
		assert.equal(consumer.context.command, tools.java.command);
		assert.equal(consumer.context.interpreterSha256, tools.java.sha256);
		assert.equal(consumer.apiProbe.command, tools[consumer.profile === "java" ? "javac" : "kotlinc"].command);
		for(const probe of consumer.nullability) assert.equal(probe.command, tools.kotlinc.command);
	}
	const result = await checkNominalPrimitiveSubtypeJvmReport(read, { route: selected.route
		, mode: selected.mode, producerCommit: selected.producer, runtime
		, floor: selected.glibc, javaVersion: tools.java.version });
	assert.equal(result.archiveSha256, archiveSha256);
	return { ...result, tools };
};
