/**
 * Require one complete hosted zero-payload Maven selection and independently
 * measured Java/Kotlin tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import {
	zeroPayloadJvmRoutes
} from "./zero-payload-checked-record-jvm-fixture.mjs";
import {
	checkZeroPayloadJvmReport
} from "./zero-payload-checked-record-jvm-report.mjs";

/**
 * Exact installed producer test name for one route.
 *
 * @param route - Exact source and API selection.
 */
export const zeroPayloadJvmCiTestName = route => {
	assert.ok(zeroPayloadJvmRoutes.includes(route));
	return `installed zero-payload checked-record JVM packages reproduce and relocate for ${route}`;
};
/**
 * Reject unknown, duplicate or incomplete checker arguments.
 *
 * @param args - Command-line arguments after the script name.
 */
export const parseZeroPayloadJvmCiArgs = args => {
	const usage = "Usage: check-zero-payload-checked-record-jvm-ci.mjs --route <route> --producer <commit> --consumer <commit> --directory <records> --tap <original-tap> --glibc 2.38 --java /absolute/java --javac /absolute/javac --kotlinc /absolute/kotlinc";
	const allowed = [
			"route", "producer", "consumer", "directory", "tap", "glibc"
			, "java", "javac", "kotlinc"
	], selected = {};
	assert.ok(Array.isArray(args) && args.length === allowed.length * 2, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--")
			&& allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length && !value.startsWith("--")
			&& !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
	zeroPayloadJvmCiTestName(selected.route);
	for(const key of ["producer", "consumer"])
		assert.match(selected[key], /^[a-f0-9]{40}$/u, usage);
	assert.equal(selected.glibc, "2.38", usage);
	for(const key of ["java", "javac", "kotlinc"])
		assert.ok(isAbsolute(selected[key]), usage);
	return selected;
};

/**
 * Require one complete terminal TAP stream with no skips.
 *
 * @param source - Original TAP output.
 * @param route - Exact source and API selection.
 */
export const assertZeroPayloadJvmCiTap = (source, route) => {
	const name = zeroPayloadJvmCiTestName(route);
	assert.equal(typeof source, "string");
	assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.doesNotMatch(source
		, /^[ \t]+(?:ok |not ok |# Subtest:|Bail out!)/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
		.map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)]
		.map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({
		tests: 1, suites: 0, pass: 1, fail: 0
		, cancelled: 0, skipped: 0, todo: 0
	})) {
		const matches = [...source.matchAll(
			new RegExp(`^# ${key} (\\d+)$`, "gmu")
		)];
		assert.equal(matches.length, 1, key);
		assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)]
		.map(match => match[0]), ["1..1"]);
	assert.match(source
		, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

/**
 * Bind retained reports to explicit hosted tool and runtime identities.
 *
 * @param options - Complete checked command-line selection.
 * @param retained - Retained records and independently measured identities.
 * @param retained.tap - Original test TAP.
 * @param retained.read - Original-byte reader supplemented by JAR members.
 * @param retained.runtime - Hosted operating-system identity.
 * @param retained.tools - Independently measured Java and Kotlin tools.
 * @param retained.archiveSha256 - Authenticated Maven JAR digest.
 */
export const checkZeroPayloadJvmCiRecords = async (
	options, { tap, read, runtime, tools, archiveSha256 }
) => {
	const selected = parseZeroPayloadJvmCiArgs(
		Object.entries(options).flatMap(([key, value]) => [`--${key}`, value]));
	assertZeroPayloadJvmCiTap(tap, selected.route);
	for(const key of ["java", "javac", "kotlinc"])
	{
		assert.equal(tools[key].command, selected[key]);
		assert.match(tools[key].sha256, /^[a-f0-9]{64}$/u);
	}
	assert.match(tools.java.version, /^(?:openjdk|java) 22\.0\.2[ +]/u);
	assert.equal(tools.javac.version, "javac 22.0.2");
	assert.match(tools.kotlinc.version
		, /^info: kotlinc-jvm 2\.2\.0 \(JRE 22\.0\.2[+)]/u);
	const report = JSON.parse(await read("report.json"));
	for(const index of [0, 1])
	{
		const compiled = JSON.parse(await read(
			`build-${index}/native-jvm.json`));
		assert.equal(compiled.compiler, tools.javac.version);
		assert.equal(compiled.kotlin.version, tools.kotlinc.version);
		assert.deepEqual(compiled.kotlin.compilerFiles
			, tools.kotlinc.compilerFiles);
	}
	for(const consumer of report.consumers)
	{
		assert.equal(consumer.context.command, tools.java.command);
		assert.equal(consumer.context.interpreterSha256, tools.java.sha256);
		assert.equal(consumer.apiProbe.command, tools[
			consumer.profile === "java" ? "javac" : "kotlinc"
		].command);
		for(const probe of consumer.nullability)
			assert.equal(probe.command, tools.kotlinc.command);
	}
	const result = await checkZeroPayloadJvmReport(read, {
		route: selected.route, producerCommit: selected.producer
		, consumerCommit: selected.consumer, runtime, floor: selected.glibc
		, javaVersion: tools.java.version
	});
	assert.equal(result.archiveSha256, archiveSha256);
	return { ...result, tools };
};
