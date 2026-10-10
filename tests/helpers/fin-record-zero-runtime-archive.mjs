/**
 * Authenticate the four Perl runtimes that executed the Fin 0 nominal supplement.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";

const revision = "1840da12d270045b1340b16e98a2a8085f002337";
const root = "docs/evidence/fin-record-zero-native-20261010/";
const directory = root + "perl-runtime-matrix-1840da1/";
const selections = ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"];
const probe = 'print JSON::PP->new->canonical->encode({version => "$^V", archname => $Config{archname}, threaded => $Config{usethreads} eq "define" ? JSON::PP::true : JSON::PP::false})';
const ordered = values => {
	const times = values.map(value => Date.parse(value));
	assert.ok(times.every(Number.isFinite));
	for(let index = 1; index < times.length; index++) assert.ok(times[index - 1] <= times[index]);
};

/**
 * Check original runtime observations against the independently pinned installed archives.
 *
 * @param digest - Pinned SHA-256 of the runtime archive index.
 * @param archives - The four independently pinned successful Perl archives.
 * @param read - File reader; mutation tests substitute changed original bytes.
 */
export const assertFinRecordZeroPerlRuntimes = async (digest, archives, read = readFile) => {
	const bytes = await read(directory + "index.json"); assert.equal(sha256(bytes), digest);
	const index = JSON.parse(bytes);
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "fin-record-zero-perl-runtime-matrix");
	assert.equal(index.revision, revision);
	assert.deepEqual(archives.map(item => item.perl), selections);
	assert.deepEqual(index.references, archives.map(item => ({ selection: item.perl, archive: item.name, indexSha256: item.digest })));
	const labels = selections.map(item => "perl" + item.replaceAll(".", "") + "-floor236");
	const names = ["start.json", "end.json", ...labels.map(label => label + ".json"), "queue.mjs", "native-runner.mjs"];
	assert.deepEqual(index.files.map(file => file.path), names);
	const files = new Map();
	for(const file of index.files)
	{
		const content = await read(directory + file.path);
		assert.equal(content.length, file.bytes); assert.equal(sha256(content), file.sha256);
		files.set(file.path, content);
	}
	const json = name => JSON.parse(files.get(name));
	const start = json("start.json"), end = json("end.json");
	assert.equal(start.revision, revision); assert.equal(end.revision, revision);
	assert.equal(start.runnerSha256, sha256(files.get("queue.mjs")));
	assert.equal(start.nativeRunnerSha256, sha256(files.get("native-runner.mjs")));
	assert.deepEqual(start.runtimes.map(runtime => runtime.selection), selections);
	assert.equal(end.records.length, 4);
	assert.equal(new Set(start.runtimes.map(runtime => runtime.sha256)).size, 4);
	for(const [position, runtime] of start.runtimes.entries())
	{
		const selection = selections[position], label = labels[position];
		const record = json(label + ".json");
		assert.deepEqual(record, end.records[position]);
		assert.equal(record.selection, label);
		assert.deepEqual(record.command, ["/usr/bin/node", "build/run-vo1442-zero-native-v2.mjs", revision, label, "perl"]);
		assert.deepEqual([record.code, record.signal], [0, null]);
		assert.deepEqual(record.runtimeBefore, runtime); assert.deepEqual(record.runtimeAfter, runtime);
		assert.equal(runtime.command, `/app/.toolchains/perl/${selection}/bin/perl`);
		assert.equal(runtime.realpath, runtime.command);
		assert.deepEqual(runtime.args, ["-MConfig", "-MJSON::PP", "-e", probe]);
		assert.deepEqual(JSON.parse(runtime.stdout), runtime.runtime);
		assert.deepEqual(runtime.runtime, {
			version: "v" + selection.split("-")[0]
			, threaded: selection.endsWith("-threaded")
			, archname: selection.endsWith("-threaded") ? "x86_64-linux-thread-multi" : "x86_64-linux"
		});
		assert.match(runtime.sha256, /^[a-f0-9]{64}$/u);
		const archiveRoot = root + archives[position].name + "/";
		const archiveBytes = await read(archiveRoot + "index.json");
		assert.equal(sha256(archiveBytes), archives[position].digest);
		const archive = JSON.parse(archiveBytes);
		assert.equal(archive.outcome, "passed"); assert.equal(archive.producer.revision, revision);
		assert.deepEqual(archive.profiles, ["perl"]);
		const originals = {};
		for(const name of ["start.json", "end.json"])
		{
			const content = await read(archiveRoot + name), file = archive.files.find(file => file.path === name);
			assert.equal(content.length, file.bytes); assert.equal(sha256(content), file.sha256);
			originals[name] = JSON.parse(content);
		}
		const producerStart = originals["start.json"], producerEnd = originals["end.json"];
		assert.equal(producerStart.runnerSha256, start.nativeRunnerSha256);
		assert.equal(producerStart.environment.LEAN_BRIDGE_CORPUS_PERL, runtime.command);
		assert.equal(producerStart.environment.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR, "2.36");
		assert.deepEqual([producerEnd.code, producerEnd.signal], [0, null]);
		ordered([start.startedAt, record.startedAt, producerStart.startedAt, producerEnd.endedAt, record.endedAt, end.endedAt]);
		if(position) ordered([end.records[position - 1].endedAt, record.startedAt]);
	}
	return true;
};
