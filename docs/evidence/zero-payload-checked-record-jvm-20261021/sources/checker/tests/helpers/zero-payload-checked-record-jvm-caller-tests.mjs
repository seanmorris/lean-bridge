/**
 * Compile independent Java and Kotlin zero-payload callers against genuine
 * generated APIs. Installed execution remains a separately gated producer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
	generateCopiedJvmKotlinPackage
} from "../../src/backends/jvm/copied-kotlin.mjs";
import { compileJvmSources } from "../../src/build/compile-jvm-sources.mjs";
import {
	zeroPayloadJvmCaller, zeroPayloadJvmProfiles, zeroPayloadJvmSelection
} from "./zero-payload-checked-record-jvm-fixture.mjs";
import {
	copiedCleanEnvironment, nativeFixtureEnvironment, runCopied
} from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const flag = process.env.LEAN_BRIDGE_ZERO_PAYLOAD_JVM_CALLER_TEST;
assert.ok(flag === undefined || flag === "0" || flag === "1");

const compileCaller = async (root, profile, route, source, environment) => {
	const extension = profile === "java" ? "java" : "kt";
	await saveLakeFile(root, `consumer.${extension}`, source);
	const target = `consumer-${profile}-${route}`;
	await mkdir(join(root, target));
	if(profile === "java") return runCopied(environment.LEAN_BRIDGE_JAVAC, [
		"--release", "22", "-Werror", "-proc:none", "-cp", "classes"
		, "-d", target, "consumer.java"
	], root);
	return runCopied(environment.LEAN_BRIDGE_KOTLINC, [
		"-Werror", "-jvm-target", "22", "-cp", "classes", "consumer.kt"
		, "-d", `${target}/consumer.jar`
	], root, {
		...copiedCleanEnvironment, PATH: "/usr/bin:/bin"
		, JAVA_HOME: dirname(dirname(environment.LEAN_BRIDGE_JAVA))
	});
};

test("zero-payload JVM callers compile against both API modes", {
	skip: flag !== "1", timeout: 1_200_000
}, async t => {
	const environment = nativeFixtureEnvironment(zeroPayloadJvmProfiles);
	let compilations = 0;
	for(const route of ["reviewed-ir", "result-only-reviewed-ir"])
	{
		const root = await mkdtemp(join(
			tmpdir(), `lean-bridge-zero-payload-jvm-${route}-`));
		let complete = false;
		try
		{
			const selection = zeroPayloadJvmSelection(route);
			const files = generateCopiedJvmKotlinPackage(selection.expected);
			for(const [path, source] of Object.entries(files))
				await saveLakeFile(root, path, source);
			await compileJvmSources({ root, files, environment });
			const authors = selection.resultOnly
				? ["result-only-ordinary-source", "result-only-reviewed-ir"]
				: ["ordinary-source", "reviewed-ir"];
			for(const profile of zeroPayloadJvmProfiles)
				for(const author of authors)
				{
					const source = await zeroPayloadJvmCaller(profile, author);
					const run = await compileCaller(
						root, profile, author, source, environment);
					assert.equal(run.stderr, "", `${profile}/${author}`);
					compilations++;
				}
			complete = true;
		}
		finally
		{
			if(complete) await rm(root, { recursive: true });
			else t.diagnostic(`Retained failed zero-payload JVM inputs: ${root}`);
		}
	}
	assert.equal(compilations, 8);
});
