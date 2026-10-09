/**
 * Keep the local installed native Fin container entry counters bound to every attempt, their exact transcripts and
 * producer sources, each host's instrument and caller, and the separately attributed C rows (VO #1438).
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertContainerEntryArchive, assertContainerEntryAttempt, assertContainerEntryReproducer, containerEntryAttempts, containerEntryDirectory, containerEntryPaths, writeContainerEntryArtifact } from "./helpers/fin-container-entry-evidence.mjs";

const receiptSha256 = "bcbeb9324cd54306353d572502bd8b97d11bf96f524fe2f9c9ccd54263f91067";
const receipt = async () => {
	const bytes = await readFile(`${containerEntryDirectory}/receipt.json`);
	assert.equal(sha256(bytes), receiptSha256);
	return JSON.parse(bytes);
};
// Byte and record controls only; live sources are authenticated by the first test.
const bytesOnly = { currentSources: false };
const attempt = id => containerEntryAttempts.find(item => item.id === id);
const records = async id => {
	const file = name => readFile(`${containerEntryDirectory}/${id}/${name}`, "utf8");
	const reports = {};
	for(const name of Object.keys(attempt(id).reports)) reports[name] = JSON.parse(await file(name));
	return { queue: JSON.parse(await file("queue.json")), end: JSON.parse(await file("end.json")), tap: await file("run.tap"), reports };
};
const refuses = async (id, mutations) => {
	const original = await records(id); assertContainerEntryAttempt(attempt(id), original);
	for(const [index, mutate] of mutations.entries())
	{
		const value = structuredClone(original); mutate(value);
		assert.throws(() => assertContainerEntryAttempt(attempt(id), value), assert.AssertionError, `${id} mutation ${index}`);
	}
};
// The first report of an attempt and route, and its host sections.
const ordinary = value => Object.values(value.reports)[0];
const reviewed = value => Object.values(value.reports)[1];
const host = (value, profile, route = ordinary) => route(value).reports.find(item => item.profile === profile);

test("the container entry archive binds every attempt to exact originals and sources at its revision", async () => {
	const value = await receipt();
	await assertContainerEntryArchive(value);
	assert.deepEqual(value.artifacts.map(file => file.path), containerEntryPaths);
	assert.deepEqual(value.attempts.map(item => [item.id, item.outcome]), containerEntryAttempts.map(item => [item.id, item.outcome]));
	assert.deepEqual([value.scope.hostedCi, value.scope.installedTreeRelocation, value.scope.supportPromotion, value.scope.localGlibc], [false, false, false, "2.36"]);
	assert.deepEqual(value.scope.hosts, ["cpp", "php-native", "wit-wasi", "ruby", "dotnet", "java", "kotlin"]);
	assert.deepEqual(containerEntryAttempts.filter(item => item.outcome === "passed").flatMap(item => item.profiles).sort(), [...value.scope.hosts].sort());
});

test("LD_PRELOAD host reports refuse altered callers, rows, digests, libraries, counts and routes", () => refuses("cpp-php", [
	value => { host(value, "php-native").dispatch.public.caller = "public PHP functions through PHP FFI"; }
	, value => { host(value, "php-native").dispatch.public.instrument = "gdb-breakpoints"; }
	, value => { host(value, "php-native").dispatch.public.probeSha256 = "0".repeat(64); }
	, value => { host(value, "cpp").dispatch.public.interposerSha256 = "0".repeat(64); }
	, value => { host(value, "cpp").dispatch.public.observed[1][1] = "rejected:arg1:10"; }
	, value => { host(value, "cpp").dispatch.public.observed[3][2][5] = 1; }
	, value => { host(value, "cpp").dispatch.public.observed.pop(); }
	, value => { host(value, "cpp").dispatch.public.missingInstrumentRefused = false; }
	, value => { host(value, "cpp").dispatch.public.repeatedColdProcess = false; }
	, value => { host(value, "cpp").dispatch.public.parameterNames.label = ["value0", "value1"]; }
	, value => { host(value, "cpp").dispatch.public.definers[0] = "libother.so"; }
	, value => { host(value, "cpp").dispatch.libraries.files["lib/libcomponent_3acdf22f1550490d7b06.so"].sha256 = "0".repeat(64); }
	, value => { host(value, "php-native").dispatch.libraries.sha256["libcomponent_3acdf22f1550490d7b06.so"] = "0".repeat(64); }
	, value => { host(value, "php-native").dispatch.columns.reverse(); }
	, value => { host(value, "php-native").dispatch.kind = "fin-dispatch-v1"; }
	, value => { host(value, "php-native").dispatch.componentId = "fincontainers@1.0.1"; }
	, value => { host(value, "php-native").checks--; }
	, value => { host(value, "php-native").relocatedInstallation = true; }
	, value => { host(value, "php-native").offlineInstall = false; }
	, value => { host(value, "php-native", reviewed).path = "ordinary-source"; }
	, value => { host(value, "php-native", reviewed).reviewedSourceSha256 = "reviewed"; }
	, value => { ordinary(value).reports.reverse(); }
	, value => { value.reports[Object.keys(value.reports)[1]] = ordinary(value); }
	, value => { ordinary(value).archives[Object.keys(ordinary(value).archives)[0]] = "0".repeat(64); }
]));

test("raw C rows stay a separate C caller and never a host-language call", () => refuses("ruby-wit", [
	value => { host(value, "ruby").dispatch.rawAdapter.caller = host(value, "ruby").dispatch.public.caller; }
	, value => { host(value, "ruby").dispatch.rawAdapter.instrument = "gdb-breakpoints"; }
	, value => { host(value, "wit-wasi").dispatch.rawAdapter.observed[2][1] = "ok"; }
	, value => { host(value, "wit-wasi").dispatch.rawAdapter.observed[4][2][0] = 2; }
	, value => { host(value, "wit-wasi").dispatch.rawAdapter.probeSha256 = "0".repeat(64); }
	, value => { host(value, "wit-wasi").dispatch.rawAdapter.definers.pop(); }
	, value => { delete host(value, "wit-wasi").dispatch.rawAdapter; }
]));

test("GDB host reports require their pinned debugger, script, breakpoints, refusals and load trigger", async () => {
	await refuses("ruby-wit", [
		value => { host(value, "ruby").dispatch.public.gdb.version = "GNU gdb 14.1"; }
		, value => { host(value, "ruby").dispatch.public.scriptSha256 = "0".repeat(64); }
		, value => { host(value, "ruby").dispatch.public.breakpoints.reverse(); }
		, value => { host(value, "ruby").dispatch.public.breakpoints[0].library = "libruby.so"; }
		, value => { host(value, "ruby").dispatch.public.breakpoints[0].offset = "39b0"; }
		, value => { host(value, "ruby").dispatch.public.staleRecordRefused = false; }
		, value => { host(value, "ruby").dispatch.public.foreignRootRefused = false; }
		, value => { host(value, "ruby").dispatch.public.misplacedDefinersRefused = false; }
		, value => { host(value, "ruby").dispatch.public.instrument = "LD_PRELOAD"; }
		, value => { host(value, "ruby").dispatch.public.loadTrigger = "first call"; }
	]);
	await refuses("jvm", [
		value => { host(value, "java").dispatch.public.outsideRootRefused = false; }
		, value => { host(value, "kotlin").dispatch.public.plantedParentRefused = false; }
		, value => { host(value, "kotlin", reviewed).dispatch.public.preloadedCopiesRefused = false; }
		, value => { host(value, "java").dispatch.public.hashes["libcomponent_3acdf22f1550490d7b06.so"] = "0".repeat(64); }
		, value => { host(value, "java").dispatch.public.scriptSha256 = host(value, "java").dispatch.public.configSha256; }
		, value => { host(value, "java").dispatch.public.instrument = "gdb-breakpoints"; }
		, value => { host(value, "kotlin").dispatch.public.caller = host(value, "java").dispatch.public.caller; }
		, value => { host(value, "kotlin").checks = 2026; }
		, value => { delete host(value, "java", reviewed).dispatch.public.loadTrigger; }
		, value => { ordinary(value).reports.reverse(); }
	]);
	await refuses("dotnet", [
		value => { host(value, "dotnet").dispatch.public.loadTrigger = "countNone([]) == 0"; }
		, value => { delete host(value, "dotnet", reviewed).dispatch.public.loadTrigger; }
		, value => { host(value, "dotnet").dispatch.public.caller = "public .NET methods through DllImport"; }
		, value => { host(value, "dotnet").checks = 2025; }
	]);
});

test("attempt records require each producer's exact queue, environment and terminal state", async () => {
	const queueMutations = [
		value => { value.queue.revision = attempt("failed-e91543d-cpp-php").revision; }
		, value => { value.queue.parent = "23d5948"; }
		, value => { value.queue.rootDiffSha256 = "0".repeat(64); }
		, value => { value.queue.sources["tests/helpers/fin-container-entry-dispatch.mjs"] = "0".repeat(64); }
		, value => { value.queue.runnerSha256 = attempt("cpp-php").files["runner.mjs.txt"].sha256; }
		, value => { value.queue.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR = "2.38"; }
		, value => { value.queue.environment.LEAN_BRIDGE_FIN_CONTAINER_PROFILES = "dotnet,cpp"; }
		, value => { value.queue.environment.LEAN_BRIDGE_FIN_CONTAINER_ENTRY_COUNTERS = "0"; }
		, value => { value.queue.command = ["node", "--test"]; }
		, value => { value.queue.gdbSha256 = "0".repeat(64); }
		, value => { value.queue.freeMiB = 2000; }
		, value => { value.queue.scope = "Hosted release-floor acceptance"; }
		, value => { value.end.code = 1; }
		, value => { value.end.stoppedForDisk = true; }
		, value => { value.end.signal = "SIGTERM"; }
		, value => { value.end.minimumFreeMiB = 900; }
	];
	await refuses("dotnet", queueMutations);
	await refuses("failed-e91543d-cpp-php", [
		value => { value.end.code = 0; }
		, value => { value.queue.revision = attempt("cpp-php").revision; }
		, value => { value.queue.parent = "4021820"; }
		, value => { value.queue.fixDiffSha256 = "0".repeat(64); }
	]);
	await refuses("failed-fd51318-jvm", [
		value => { value.end.code = 0; }
		, value => { value.queue.environment.LEAN_BRIDGE_FIN_CONTAINER_PROFILES = "java"; }
		, value => { value.queue.revision = "f737b2b00808f16a03025a2fe2d8ca6780b372a2"; }
		, value => { value.reports["java-kotlin.json"] = {}; }
	]);
});

test("transcripts keep each passing route and the original initializer failure", async () => {
	for(const [id, before, after] of [
		["dotnet", "# pass 2", "# pass 1"]
		, ["dotnet", "# skipped 0", "# skipped 1"]
		, ["dotnet", "ok 2 - independently reviewed", "not ok 2 - independently reviewed"]
		, ["failed-e91543d-cpp-php", "component initializer is not visible", "component initializer is missing"]
		, ["failed-e91543d-cpp-php", "# fail 2", "# fail 1"]
		, ["failed-e91543d-cpp-php", "not ok 1 - relocated", "ok 1 - relocated"]
		, ["failed-fd51318-jvm", "/usr/bin/gdb exited with status null", "/usr/bin/gdb exited with status 0"]
		, ["failed-fd51318-jvm", "terminate called after throwing an instance of 'gdb_exception_error'", "terminate called"]
		, ["failed-fd51318-jvm", "# pass 0", "# pass 1"]
	]) {
		const value = await records(id); value.tap = value.tap.replace(before, after);
		value.end.tapSha256 = sha256(value.tap);
		assert.throws(() => assertContainerEntryAttempt(attempt(id), value), assert.AssertionError, before);
	}
});

test("the root-cause reproducer keeps the debugger abort beside plain and inferior-only runs that exit normally", async () => {
	const names = Object.keys(attempt("failed-fd51318-jvm").files).filter(name => name.startsWith("reproducer/"));
	const original = {};
	for(const name of names) original[name.slice("reproducer/".length)] = await readFile(`${containerEntryDirectory}/failed-fd51318-jvm/${name}`, "utf8");
	assertContainerEntryReproducer(original);
	// Rehash SHA256SUMS so these controls exercise content, not only the checksum list.
	const resum = value => { value.SHA256SUMS = value.SHA256SUMS.replace(/^([a-f0-9]{64}) {2}(\S+)$/gmu, (line, digest, name) => `${sha256(value[name])}  ${name}`); };
	for(const mutate of [
		value => { value["pre.txt"] = value["pre.txt"].replace("terminate called after throwing", "exited after throwing"); }
		, value => { value["pre.txt"] += "exit 0\n"; }
		, value => { value["iex.txt"] = value["iex.txt"].replace(/^lean objfiles in inferior: .*$/mu, "lean objfiles in inferior: []"); }
		, value => { value["log2.txt"] = value["log2.txt"].replace(/^exit 0$/mu, "exit 1"); }
		, value => { value["t1.txt"] += "terminate called recursively\n"; }
		, value => { value["tools.txt"] = value["tools.txt"].replace("GNU gdb (Debian 13.1-3) 13.1", "GNU gdb 15.1"); }
		, value => { delete value["t2.txt"]; }
	]) {
		const value = structuredClone(original); mutate(value); if(value["t2.txt"] !== undefined) resum(value);
		assert.throws(() => assertContainerEntryReproducer(value), assert.AssertionError);
	}
	const forged = structuredClone(original); forged["r.py"] += "\n";
	assert.throws(() => assertContainerEntryReproducer(forged), assert.AssertionError, "SHA256SUMS binds every file");
});

test("the container entry archive rejects foreign, missing or extra paths and widened scope before opening any artifact", async () => {
	const original = await receipt();
	for(const mutate of [
		value => { value.artifacts[0].path = "../../outside.json"; }
		, value => { value.artifacts[0].path = "/tmp/foreign.json"; }
		, value => { value.artifacts.push(value.artifacts[0]); }
		, value => { value.artifacts.pop(); }
		, value => { value.artifacts.reverse(); }
		, value => { value.scope.hostedCi = true; }
		, value => { value.scope.installedTreeRelocation = true; }
		, value => { value.scope.localGlibc = "2.38"; }
		, value => { value.scope.failedAttempts = []; }
		, value => { value.scope.failedAttempts.pop(); }
		, value => { value.scope.failedAttempts[0].reason = "a transient failure"; }
		, value => { value.scope.instruments.LD_PRELOAD.push("ruby"); }
		, value => { value.attempts[0].outcome = "passed"; }
		, value => { value.sources.pop(); }
	]) {
		const value = structuredClone(original); mutate(value); let reads = 0;
		await assert.rejects(() => assertContainerEntryArchive(value, async path => { reads++; return readFile(path); }), assert.AssertionError);
		assert.equal(reads, 0);
	}
});

test("the container entry archive rejects altered and rehashed bytes and relabelled provenance", async () => {
	const original = await receipt();
	for(const selected of [original.artifacts[0], original.artifacts[2], original.artifacts[8], original.artifacts.at(-1)])
	{
		const changed = Buffer.from(await readFile(selected.path)); changed[0] ^= 1;
		await assert.rejects(() => assertContainerEntryArchive(original, path => (path === selected.path ? Promise.resolve(changed) : readFile(path)), bytesOnly), assert.AssertionError);
		const value = structuredClone(original); value.artifacts.find(file => file.path === selected.path).sha256 = sha256(changed);
		await assert.rejects(() => assertContainerEntryArchive(value, path => (path === selected.path ? Promise.resolve(changed) : readFile(path)), bytesOnly), assert.AssertionError);
	}
	for(const mutate of [
		value => { value.artifacts[0].originalPath = "made-up/queue.json"; }
		, value => { value.artifacts[0].bytes--; }
		, value => { value.artifacts.at(-1).originalPath = "git:unknown:source.mjs"; }
	]) {
		const value = structuredClone(original); mutate(value);
		await assert.rejects(() => assertContainerEntryArchive(value, readFile, bytesOnly), assert.AssertionError);
	}
	// The unaltered archive passes the same byte checks, so each refusal above is the altered artifact's.
	await assertContainerEntryArchive(original, readFile, bytesOnly);
});

test("the container entry archive writer preserves originals and refuses differing replacement bytes", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-container-entry-writer-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const path = join(root, "receipt.json"), bytes = Buffer.from("original\n");
	await writeContainerEntryArtifact(path, bytes); await writeContainerEntryArtifact(path, bytes);
	await assert.rejects(() => writeContainerEntryArtifact(path, Buffer.from("different\n")), /Refusing to replace/u);
	assert.deepEqual(await readFile(path), bytes);
});
