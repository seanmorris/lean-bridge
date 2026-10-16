/**
 * Produce and independently control all four local nested-record JVM evidence cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { access, mkdir, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { nativeArtifactPaths } from "../src/build/native-artifacts.mjs";
import { inspectNestedCheckedRecordJvmCiHandoff } from "../tests/helpers/nested-checked-record-jvm-ci-handoff.mjs";
import { checkNestedCheckedRecordJvmControls } from "../tests/helpers/nested-checked-record-jvm-controls.mjs";
import {
	assertNestedCheckedRecordJvmCiTap, nestedCheckedRecordJvmCiTestName
} from "../tests/helpers/nested-checked-record-jvm-ci-report.mjs";
import { saveLakeFile } from "../tests/helpers/lake-workspace.mjs";

const producer = execFileSync("git", ["rev-parse", "HEAD"], {
	cwd: "/app", encoding: "utf8"
}).trim();
assert.equal(producer, "ef8876ba067e29197b32a21eb708b394f4df3568");
execFileSync("git", ["diff", "--quiet", "HEAD", "--", ".github", "scripts", "src", "tests"], {
	cwd: "/app"
});
const root = "/app/build/vo1506-nested-record-jvm-ef8876b";
await assert.rejects(access(root), { code: "ENOENT" });
await mkdir(root, { recursive: true });
const tools = {
	java: await realpath("/app/.toolchains/jdk22/bin/java")
	, javac: await realpath("/app/.toolchains/jdk22/bin/javac")
	, kotlinc: await realpath("/app/.toolchains/kotlin-2.2.0/kotlinc/bin/kotlinc")
	, maven: await realpath("/app/.toolchains/apache-maven-3.9.11/bin/mvn")
};
const lean = await realpath(
	"/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2"
);
const runtimeText = execFileSync("/usr/bin/getconf", ["GNU_LIBC_VERSION"], {
	encoding: "utf8", env: { PATH: "/unavailable" }
});
assert.equal(runtimeText, "glibc 2.36\n");
const runtime = { platform: process.platform, arch: process.arch, glibc: "2.36" };
const wrapper = [
	"-n", "19", "/usr/bin/ionice", "-c", "3", "/usr/bin/taskset", "-c", "3"
	, process.execPath
];
const environment = {
	...process.env, NO_COLOR: "1", FORCE_COLOR: undefined
	, LEAN_BRIDGE_LEAN_PREFIX: lean
	, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: "2.36"
	, LEAN_BRIDGE_JAVA: tools.java, LEAN_BRIDGE_JAVAC: tools.javac
	, LEAN_BRIDGE_KOTLINC: tools.kotlinc, LEAN_BRIDGE_MAVEN: tools.maven
	, LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_TEST: "1"
	, LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_MAX_LOAD: "12"
	, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
	, CMAKE_BUILD_PARALLEL_LEVEL: "1"
};
delete environment.FORCE_COLOR;

const run = (command, args, options = {}) => new Promise((resolve, reject) => {
	const child = spawn(command, args, {
		cwd: options.cwd ?? "/app"
		, env: options.env ?? process.env
		, stdio: ["ignore", "pipe", "pipe"]
	});
	const stdout = [], stderr = [];
	child.stdout.on("data", chunk => {
		stdout.push(chunk); if(options.forward) process.stdout.write(chunk);
	});
	child.stderr.on("data", chunk => {
		stderr.push(chunk); if(options.forward) process.stderr.write(chunk);
	});
	child.on("error", reject);
	child.on("close", (code, signal) => resolve({
		code, signal, stdout: Buffer.concat(stdout).toString()
		, stderr: Buffer.concat(stderr).toString()
	}));
});
const identities = async directory => Object.fromEntries(await Promise.all(
	(await nativeArtifactPaths(directory)).map(async path => {
		const bytes = await readFile(join(directory, path));
		return [path, { bytes: bytes.length, sha256: sha256(bytes) }];
	})
));
const selections = [
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
];
for(const [route, mode] of selections)
{
	const directory = join(root, `${route}-${mode}`);
	const records = join(directory, "records", route, mode);
	await mkdir(directory, { recursive: true });
	const name = nestedCheckedRecordJvmCiTestName(route, mode);
	const args = [
		...wrapper.slice(7), "--max-old-space-size=3072", "--test"
		, "--test-concurrency=1", "--test-reporter=tap"
		, `--test-name-pattern=^${name}$`
		, "tests/helpers/nested-checked-record-jvm-installed-tests.mjs"
	];
	const childEnvironment = {
		...environment
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_ROUTES: route
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_MODES: mode
		, LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_OUTPUT: join(directory, "records")
	};
	const started = new Date().toISOString();
	await saveLakeFile(directory, "start.json", canonicalJson({
		schemaVersion: 1, producer, route, mode, started, runtime, tools
		, command: "/usr/bin/nice", args: [...wrapper.slice(0, 7), ...args]
		, environment: Object.fromEntries(Object.entries(childEnvironment)
			.filter(([key]) => key.startsWith("LEAN_BRIDGE_") || [
				"NO_COLOR", "LEAN_NUM_THREADS", "OMP_NUM_THREADS", "MAKEFLAGS"
				, "CMAKE_BUILD_PARALLEL_LEVEL"
			].includes(key)))
	}));
	const result = await run("/usr/bin/nice", [...wrapper.slice(0, 7), ...args], {
		cwd: "/app", env: childEnvironment, forward: true
	});
	await saveLakeFile(directory, "run.tap", result.stdout);
	await saveLakeFile(directory, "run.stderr", result.stderr);
	await saveLakeFile(directory, "end.json", canonicalJson({
		schemaVersion: 1, producer, route, mode, started
		, finished: new Date().toISOString(), code: result.code, signal: result.signal
		, tapSha256: sha256(result.stdout), stderrSha256: sha256(result.stderr)
	}));
	assert.equal(result.code, 0); assert.equal(result.signal, null);
	assert.equal(result.stderr, "");
	assertNestedCheckedRecordJvmCiTap(result.stdout, route, mode);
	const verification = await run(process.execPath, [
		"scripts/check-nested-checked-record-jvm-ci.mjs"
		, "--route", route, "--mode", mode, "--producer", producer
		, "--directory", records, "--tap", join(directory, "run.tap")
		, "--glibc", "2.36", "--java", tools.java, "--javac", tools.javac
		, "--kotlinc", tools.kotlinc
	], { cwd: "/app", env: environment, forward: true });
	assert.equal(verification.code, 0); assert.equal(verification.stderr, "");
	const checked = JSON.parse(verification.stdout);
	assert.equal(verification.stdout, canonicalJson(checked));
	await saveLakeFile(directory, "verification.json", verification.stdout);
	const before = await identities(records);
	const direct = path => readFile(join(records, path));
	const handoff = await inspectNestedCheckedRecordJvmCiHandoff(direct, {
		floor: "2.36", mode
	});
	const report = JSON.parse(await direct("report.json"));
	const options = {
		route, mode, producerCommit: producer, runtime, floor: "2.36"
		, javaVersion: report.consumers[0].javaVersion.stdout
	};
	const controlsStarted = new Date().toISOString();
	const controls = await checkNestedCheckedRecordJvmControls(handoff.read, options);
	const after = await identities(records);
	assert.deepEqual(after, before);
	await saveLakeFile(directory, "controls.json", canonicalJson({
		schemaVersion: 1, producer, route, mode, started: controlsStarted
		, finished: new Date().toISOString(), originalsUnchanged: true
		, originalFiles: Object.keys(before).length, controls, checked
	}));
}
await saveLakeFile(root, "complete.json", canonicalJson({
	schemaVersion: 1, producer, runtime, tools, selections
	, finished: new Date().toISOString()
}));
