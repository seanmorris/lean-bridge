/**
 * Test the recurring JVM checker against authenticated original executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { assertNominalSubtypeJvmCiTap, checkNominalSubtypeJvmCiRecords, parseNominalSubtypeJvmCiArgs } from "./nominal-subtype-jvm-ci-report.mjs";

const root = "docs/evidence/nominal-subtype-jvm-20261013";
const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);
const originals = async () => {
	const bytes = await readFile(`${root}/index.json`);
	assert.equal(sha256(bytes), "ee5dfe4809453595b3d662d2624a0c50c4e93c908d63195176bbd0f9dc56e0e1");
	const index = JSON.parse(bytes), files = new Map();
	for(const file of index.files)
	{
		const value = await readFile(`${root}/${file.path}`);
		assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};
const selection = (files, run) => {
	const prefix = `${run.label}/records/`;
	const read = async path => { assert.ok(files.has(prefix + path), path); return files.get(prefix + path); };
	const report = JSON.parse(files.get(prefix + "report.json"));
	const compiled = JSON.parse(files.get(prefix + "build-0/native-jvm.json"));
	const java = report.consumers[0], kotlin = report.consumers[1];
	// Historical records did not hash these two launchers. These unit-test values
	// satisfy the measured-input shape, not a claim about their original bytes.
	const tools = { java: { command: java.context.command, sha256: java.context.interpreterSha256, version: run.javaVersion }
		, javac: { command: java.apiProbe.command, sha256: "a".repeat(64), version: compiled.compiler }
		, kotlinc: { command: kotlin.apiProbe.command, sha256: "b".repeat(64), version: compiled.kotlin.version, compilerFiles: compiled.kotlin.compilerFiles } };
	const options = { route: run.route, mode: run.mode
		, producer: run.producerCommit
		, directory: `${root}/${run.label}/records`
		, tap: `${root}/${run.label}/run.tap`, glibc: run.floor
		, java: tools.java.command, javac: tools.javac.command
		, kotlinc: tools.kotlinc.command };
	return { options, input: { tap: files.get(`${run.label}/run.tap`).toString(), read, runtime: run.runtime, tools, archiveSha256: run.archiveSha256 } };
};

test("nominal JVM CI rejects unknown, repeated and incomplete selections", () => {
	const options = { route: "ordinary", mode: "full"
		, producer: "a".repeat(40), directory: "records", tap: "run.tap"
		, glibc: "2.38", java: "/jdk/bin/java", javac: "/jdk/bin/javac"
		, kotlinc: "/kotlin/bin/kotlinc" };
	const args = argsOf(options); assert.deepEqual(parseNominalSubtypeJvmCiArgs(args), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseNominalSubtypeJvmCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseNominalSubtypeJvmCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value", "bad\nvalue", "bad\rvalue"])
			assert.throws(() => parseNominalSubtypeJvmCiArgs(argsOf({ ...options, [key]: value })));
	}
	const changes = [{ route: "ordinary,reviewed" }
		, { mode: "full,result-only" }, { route: "unknown" }, { mode: "unknown" }
		, { producer: "a".repeat(39) }, { producer: "G".repeat(40) }
		, { glibc: "2.35" }, { glibc: "2.39" }, { java: "java" }
		, { javac: "javac" }, { kotlinc: "kotlinc" }, { unknown: "value" }];
	for(const changed of changes)
		assert.throws(() => parseNominalSubtypeJvmCiArgs(argsOf({ ...options, ...changed })));
	for(const invalid of [undefined, {}, [], [...args, "--route"], ["route", ...args.slice(1)]])
		assert.throws(() => parseNominalSubtypeJvmCiArgs(invalid));
});

test("nominal JVM CI requires complete zero-skip TAP for each exact selection", async t => {
	const { index, files } = await originals(); let controls = 0;
	for(const run of index.runs)
	{
		const tap = files.get(`${run.label}/run.tap`).toString();
		assertNominalSubtypeJvmCiTap(tap, run.route, run.mode);
		const changes = [tap.replace("TAP version 13\n", "")
			, tap.replace("ok 1 -", "not ok 1 -")
			, tap.replace("ok 1 -", "ok 2 -")
			, tap + "Bail out! stopped\n", tap + "# SKIP excluded\n"
			, tap + "# TODO later\n", tap.replace("1..1\n", "")
			, tap.replace("1..1\n", "1..2\n"), tap + "1..1\n"
			, tap.replace("# Subtest:", "# Wrong:")
			, tap + "ok 2 - unrelated\n", tap + tap, tap + "incomplete\n"
			, tap.replace(/^# duration_ms [^\n]+\n$/mu, "")
			, ...["not ok 1 - hidden failure", "ok 1 - hidden pass", "# Subtest: hidden", "Bail out! stopped"]
				.map(line => tap.replace("\n1..1\n", `\n    ${line}\n1..1\n`))
			, ...["tests", "suites", "pass", "fail", "cancelled", "skipped", "todo"].flatMap(key => [
				tap.replace(new RegExp(`^# ${key} \\d+\\n`, "mu"), "")
				, tap.replace(new RegExp(`^# ${key} \\d+$`, "mu"), `# ${key} 7`)
				, tap + `# ${key} 0\n`
			])
		];
		for(const source of changes)
		{
			assert.notEqual(source, tap); assert.throws(() => assertNominalSubtypeJvmCiTap(source, run.route, run.mode)); controls++;
		}
		assert.throws(() => assertNominalSubtypeJvmCiTap(tap, run.route === "ordinary" ? "reviewed" : "ordinary", run.mode));
		assert.throws(() => assertNominalSubtypeJvmCiTap(tap, run.route, run.mode === "full" ? "result-only" : "full")); controls += 2;
	}
	t.diagnostic(`${controls} incomplete, mismatched, skipped or failed TAP controls`);
});

test("nominal JVM CI binds complete records to selected tools, compiler JARs and original package", async t => {
	const { index, files } = await originals(); let controls = 0;
	for(const run of index.runs)
	{
		const { options, input } = selection(files, run);
		const result = await checkNominalSubtypeJvmCiRecords(options, input);
		assert.equal(result.executions, 6); assert.deepEqual(result.tools, input.tools);
		const toolChanges = [value => { value.java.command = "/different/java"; }
			, value => { value.java.sha256 = "0".repeat(64); }
			, value => { value.java.version = value.java.version.replace("22.0.2", "22.0.3"); }
			, value => { value.javac.command = "/different/javac"; }
			, value => { value.javac.version = "javac 22.0.3"; }
			, value => { value.javac.sha256 = "invalid"; }
			, value => { value.kotlinc.command = "/different/kotlinc"; }
			, value => { value.kotlinc.version = "info: kotlinc-jvm 2.2.1 (JRE 22.0.2+9)"; }
			, value => { value.kotlinc.compilerFiles["kotlin-stdlib.jar"] = "0".repeat(64); }
			, value => { delete value.kotlinc.compilerFiles["kotlin-compiler.jar"]; }
			, value => { value.kotlinc.compilerFiles["extra.jar"] = "0".repeat(64); }];
		for(const change of toolChanges)
		{
			const tools = structuredClone(input.tools); change(tools);
			await assert.rejects(checkNominalSubtypeJvmCiRecords(options, { ...input, tools })); controls++;
		}
		const optionChanges = [{ producer: "0".repeat(40) }
			, { glibc: "2.38" }, { java: "/different/java" }
			, { javac: "/different/javac" }, { kotlinc: "/different/kotlinc" }
			, { route: run.route === "ordinary" ? "reviewed" : "ordinary" }
			, { mode: run.mode === "full" ? "result-only" : "full" }];
		for(const changed of optionChanges)
		{
			await assert.rejects(checkNominalSubtypeJvmCiRecords({ ...options, ...changed }, input)); controls++;
		}
		for(const runtime of [{ ...run.runtime, arch: "arm64" }, { ...run.runtime, platform: "win32" }, { ...run.runtime, glibc: "2.39" }])
		{ await assert.rejects(checkNominalSubtypeJvmCiRecords(options, { ...input, runtime })); controls++; }
		await assert.rejects(checkNominalSubtypeJvmCiRecords(options, { ...input, archiveSha256: "0".repeat(64) })); controls++;
		const original = JSON.parse(await input.read("report.json"));
		const reportChanges = [value => { value.consumers.pop(); }
			, value => { value.offlineInstall = false; }
			, value => { value.consumers[0].observations.pop(); }
			, value => { value.consumers[1].nullability.pop(); }
			, value => { value.sourceRemovedBeforeInstallation = false; }
			, value => { value.reproducible = false; }
			, value => { value.consumers[0].observations[0].run.code = 1; }];
		for(const change of reportChanges)
		{
			const changed = structuredClone(original); change(changed);
			await assert.rejects(checkNominalSubtypeJvmCiRecords(options, { ...input
				, read: path => path === "report.json" ? Buffer.from(canonicalJson(changed)) : input.read(path) })); controls++;
		}
		const missingRecords = ["build-1/native-jvm.json", "java/relocated.json"
			, "kotlin/source-free.json", "java/api-probe/record.json"
			, "kotlin/nullability-true/record.json"];
		for(const missing of missingRecords)
		{
			await assert.rejects(checkNominalSubtypeJvmCiRecords(options, { ...input, read: path => {
				if(path === missing) throw new Error("missing original"); return input.read(path);
			} })); controls++;
		}
	}
	t.diagnostic(`${controls} selected tool, original package and complete record controls`);
});
