/**
 * Preserve the first installed zero-bound nominal collection runs, including the Python failure.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertFinRecordZeroReport } from "./fin-record-zero-report.mjs";

const base = "docs/evidence/fin-record-zero-native-20261010/";
const originalRevision = "7f32996dce66ea7ab191c8c23b031a0b13c1ffe2";
const cases = [
	{ name: "c-cpp-7f32996", digest: "5e975db58e3c2816f02bcefaa63380976797d54877329be48ddb2a2c69766aae", outcome: "passed", profiles: ["c", "cpp"], count: 40 }
	, { name: "python311-7f32996", digest: "b8ded2711303e9badf36994c3b8f80fe2b641ee673eeb78e6b706ff7cb2461a7", outcome: "failed", profiles: ["python"], count: 37 }
	, { name: "python311-8fdec75"
		, digest: "4d03aec16689260f2309db46630a6c644866243be808f0c858a42b4dba59099a"
		, revision: "8fdec75af4ab853ee18b3b9159784174a37df86a"
		, tree: "966f4125ba0e904a6176abb138bc8500ed2420c8"
		, outcome: "passed", profiles: ["python"], count: 40 }
	, { name: "python312-ruby-jvm-3c41650"
		, digest: "5894e167f280b207c92817273bb4c67697320cd2a269b01942d239c0b73ddeda"
		, revision: "3c416502d4630017e366eaefd55455fef83add66"
		, tree: "5152274a80982d87de03c7db843819fd662b22f2"
		, outcome: "passed", profiles: ["java", "kotlin", "python", "ruby"]
		, count: 40 }
];
const inspect = async (item, read = readFile) => {
	const root = base + item.name + "/", bytes = await read(root + "index.json");
	assert.equal(sha256(bytes), item.digest);
	const index = JSON.parse(bytes);
	const revision = item.revision ?? originalRevision;
	assert.deepEqual(index.producer, { revision, tree: item.tree ?? "fc45c2de56af524022131bbc734e096e39c55ef3" });
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "fin-record-zero-local-acceptance");
	assert.equal(index.outcome, item.outcome); assert.deepEqual(index.profiles, item.profiles);
	assert.equal(index.hostGlibc, "glibc 2.36");
	assert.equal(index.files.length, item.count);
	assert.equal(new Set(index.files.map(file => file.path)).size, item.count);
	const files = new Map();
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && file.path.split("/").every(part => part && part !== ".." && part !== "."));
		const value = await read(root + file.path);
		assert.equal(value.length, file.bytes, file.path); assert.equal(sha256(value), file.sha256, file.path);
		files.set(file.path, value);
	}
	const json = name => JSON.parse(files.get(name)), start = json("start.json"), end = json("end.json");
	assert.equal(start.revision, revision); assert.deepEqual(start.profiles, item.profiles);
	assert.deepEqual(start.environment, index.environment);
	assert.equal(start.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
	assert.equal(start.glibc, "glibc 2.36"); assert.equal(start.node, "v22.23.2");
	assert.equal(sha256(files.get("runner.mjs")), start.runnerSha256);
	assert.equal(sha256(files.get("run.tap")), end.tapSha256);
	assert.equal(end.signal, null); assert.equal(end.stoppedForDisk, false);
	assert.ok(end.minimumFreeMiB >= start.stopFloorMiB);
	const snapshots = index.files.filter(file => file.role === "source"); assert.equal(snapshots.length, 33);
	for(const file of snapshots) assert.equal(file.sha256, start.sources[file.path.replace(/^sources\//u, "")]);
	const lines = files.get("run.tap").toString("utf8").split("\n");
	if(item.outcome === "passed")
	{
		assert.equal(end.code, 0);
		const reviewedMutations = item.profiles.includes("c");
		for(const line of [`# tests ${reviewedMutations ? 6 : 3}`, `# pass ${reviewedMutations ? 6 : 2}`, "# fail 0", `# skipped ${reviewedMutations ? 0 : 1}`, "# cancelled 0"]) assert.ok(lines.includes(line), line);
		if(reviewedMutations) for(const label of ["loosened empty record", "loosened array field", "omitted list field"])
			assert.ok(lines.includes("    # Subtest: " + label));
		const verified = json("verified.json"); assert.equal(verified.revision, revision);
		assert.equal(verified.checksPerConsumer, 2046);
		for(const [name, route] of [["ordinary.json", "ordinary-source"], ["reviewed.json", "reviewed-ir"]])
		{
			assert.equal(sha256(files.get(name)), verified.receipts[name]);
			await assertFinRecordZeroReport(json(name), item.profiles, route);
		}
	}
	else
	{
		assert.equal(end.code, 1);
		for(const line of ["# tests 3", "# pass 0", "# fail 2", "# skipped 1", "# cancelled 0"]) assert.ok(lines.includes(line), line);
		assert.match(files.get("run.tap").toString("utf8"), /AssertionError: empty record collection/u);
		assert.match(files.get("sources/tests/fixtures/fin-record-zero-consumers/python.py").toString("utf8"), /check\(call\(\[\]\) == \[\]/u);
		assert.match(files.get("sources/src/backends/python/copied-conversions.mjs").toString("utf8"), /return tuple\(_from/u);
		for(const name of ["ordinary.json", "reviewed.json", "verified.json"]) assert.equal(files.has(name), false);
	}
};

test("zero-bound nominal archives retain successful native calls with the failed Python predecessor", async () => {
	for(const item of cases) await inspect(item);
});

test("zero-bound archive gates refuse altered originals, source snapshots and execution logs", async () => {
	for(const item of cases) for(const target of ["index.json", "run.tap", "end.json", "start.json", "runner.mjs", "sources/tests/fixtures/fin-record-zero-consumers/python.py"])
		await assert.rejects(() => inspect(item, async path => {
			const bytes = await readFile(path);
			return path === base + item.name + "/" + target ? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
		}));
});
