/**
 * Recheck original scalar JVM exit observations from repository-relative retained files.
 * Historical producer paths describe the run and are never used for archive reads.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { assertExtractedNativeFinGdbRun, nativeFinGdbExtractedWaitScript } from "./native-fin-dispatch-gdb-extracted.mjs";
import { nativeFinDispatchExpected, readNativeFinDispatch } from "./native-fin-dispatch.mjs";

const root = "docs/evidence/native-fin-jvm-exit-20261013";
const digest = "6f7b600a6688409b4783de5cf3d642ca056d7e84d68b8d461d4c629aa3f4c354";
const read = path => readFile(join(root, path));
const verify = async reader => {
	const bytes = await reader("index.json"); assert.equal(sha256(bytes), digest);
	const index = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "native-fin-jvm-exit-observation-v1");
	assert.equal(index.head, "50a5cf414a914a3906ccf7676eb4006427b8ecd8");
	assert.equal(index.files.length, 54);
	assert.equal(new Set(index.files.map(file => file.path)).size, index.files.length);
	for(const file of index.files)
	{
		assert.ok(/^[A-Za-z0-9_./-]+$/u.test(file.path));
		assert.ok(file.path.split("/").every(part => part && part !== "." && part !== ".."));
		const original = await reader(file.path);
		assert.equal(original.length, file.bytes, file.path);
		assert.equal(sha256(original), file.sha256, file.path);
	}
	return index;
};

test("scalar JVM exit archive checks both installed routes and all four original counter receipts", async () => {
	const index = await verify(read), json = async path => JSON.parse(await read(path));
	const entries = await readdir(root, { recursive: true, withFileTypes: true });
	assert.ok(entries.every(item => !item.isSymbolicLink()));
	const names = entries
		.filter(item => item.isFile()).map(item => join(item.parentPath, item.name).slice(root.length + 1));
	assert.deepEqual(names.sort(), ["index.json", ...index.files.map(file => file.path)].sort());
	const capture = await json("hosted-capture.json");
	assert.equal(capture.job, "115259485803");
	assert.equal(capture.code, 0); assert.equal(capture.signal, null);
	assert.equal(capture.bytes, (await read("hosted-failure.log")).length);
	assert.equal(capture.sha256, sha256(await read("hosted-failure.log")));
	const failure = (await read("hosted-failure.log")).toString();
	assert.match(failure, /GNU gdb \(Ubuntu 15\.1-1ubuntu1~24\.04\.1\) 15\.1/u);
	assert.match(failure, /No unwaited-for children left/u);
	assert.match(failure, /fin instrumentation refused: the inferior did not exit normally/u);
	const start = await json("installed/start.json"), end = await json("installed/end.json");
	assert.equal(start.head, index.head); assert.equal(end.head, index.head);
	assert.equal(start.phase, "installed"); assert.equal(end.phase, "installed");
	assert.equal(start.env.LEAN_BRIDGE_JVM_FIN_TEST, "1");
	assert.equal(start.env.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR, "2.36");
	assert.equal(start.env.LEAN_BRIDGE_GDB, "/usr/bin/gdb");
	assert.equal(start.env.LEAN_NUM_THREADS, "1");
	assert.equal(start.runnerSha256, sha256(await read("runner.mjs.txt")));
	assert.deepEqual(start.commands, [["--test", "--test-concurrency=1", "--test-reporter=tap", "tests/jvm-fin.test.mjs"]]);
	assert.equal(end.records.length, 1);
	const record = end.records[0], tap = (await read("installed/run.tap")).toString();
	assert.deepEqual(record.args, start.commands[0]);
	assert.equal(record.code, 0); assert.equal(record.signal, null);
	assert.equal(record.bytes, Buffer.byteLength(tap)); assert.equal(record.sha256, sha256(tap));
	assert.match(tap, /# tests 5\n# suites 0\n# pass 5\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n/u);
	assert.doesNotMatch(tap, /^(?:not ok|.*# (?:SKIP|TODO)\b)/mu);
	assert.deepEqual([...tap.matchAll(/^ok (\d+) - /gmu)].map(match => Number(match[1])), [1, 2, 3, 4, 5]);
	assert.deepEqual((await json("installed/sources-end.json")).changes, []);
	for(const file of index.files.filter(item => item.path.startsWith("sources/")))
	{
		const path = file.path.slice("sources/".length, -".txt".length);
		assert.equal(start.sources[path], file.sha256, path);
		assert.equal(sha256(beforeFinRefinementSource(path, await readFile(path), file.sha256)), file.sha256, path);
	}
	const expected = nativeFinDispatchExpected(outcome => outcome.rejected
		? `rejected:${outcome.rejected[0]}<${outcome.rejected[1]}` : `ok:${outcome.ok}`);
	for(const [route, author] of [["ordinary", "ordinary-source"], ["reviewed", "reviewed-ir"]])
	{
		const report = await json(`installed/${route}.json`);
		assert.equal(report.schemaVersion, 1); assert.equal(report.reproducible, true);
		assert.deepEqual(report.reports.map(item => item.profile), ["java", "kotlin"]);
		for(const item of report.reports)
		{
			assert.equal(item.path, author);
			assert.equal(item.checks, item.profile === "java" ? 2023 : 2022);
			for(const flag of ["offlineInstall", "compilerFreePath", "sourceRemovedBeforeInstallation", "relocatedInstallation", "repeatExecution"])
				assert.equal(item[flag], true, flag);
			const prefix = `observations/${route}/${item.profile}/`;
			const compressed = prefix + "observer.json.gz";
			const original = index.files.find(file => file.path === compressed).uncompressed;
			const observerBytes = gunzipSync(await read(compressed), { maxOutputLength: original.bytes });
			assert.equal(observerBytes.length, original.bytes); assert.equal(sha256(observerBytes), original.sha256);
			const observer = JSON.parse(observerBytes), accepted = await json(prefix + "accepted.json");
			const config = await json(prefix + "run-1.json");
			assert.equal(accepted.record, config.record); assert.equal(accepted.armed, config.armed);
			assert.equal(accepted.parent, config.parent); assert.equal(accepted.nonce, config.nonce);
			assert.equal(accepted.code, 0); assert.equal(accepted.stderr, "");
			assert.equal(accepted.stdout, (await read(prefix + "run-1.stdout")).toString());
			assert.equal(accepted.stderr, (await read(prefix + "run-1.stderr")).toString());
			assert.equal((await read(prefix + "fin-extracted.gdb.py")).toString(), nativeFinGdbExtractedWaitScript);
			assert.deepEqual(observer.identity, config.identity);
			assert.equal(observer.configSha256, config.configSha256);
			const rows = readNativeFinDispatch(accepted.stdout, expected);
			const checked = await assertExtractedNativeFinGdbRun(observer, {
				...accepted
				, record: join(root, prefix, "run-1.record")
				, armed: join(root, prefix, "run-1.armed.json")
			}, rows);
			assert.deepEqual(item.dispatch.observed, rows);
			assert.deepEqual(item.dispatch.breakpoints, checked.breakpoints);
			assert.equal(item.dispatch.processId, checked.processId);
			assert.deepEqual(item.dispatch.jvmExit, checked.jvmExit);
			assert.equal(item.dispatch.scriptSha256, accepted.scriptSha256);
			assert.deepEqual(item.dispatch.libraries, observer.identity.hashes);
			assert.deepEqual(item.dispatch.definers, observer.identity.definers);
			assert.equal(item.dispatch.configSha256, observer.configSha256);
			assert.equal(item.dispatch.gdb.version, "GNU gdb (Debian 13.1-3) 13.1");
		}
	}
});

test("scalar JVM exit archive refuses every missing or changed original", async t => {
	const index = await verify(read);
	const originals = new Map(await Promise.all(["index.json", ...index.files.map(file => file.path)]
		.map(async path => [path, await read(path)])));
	for(const [target, bytes] of originals)
	{
		await assert.rejects(verify(async path => {
			if(path === target) throw new Error("missing original");
			return originals.get(path);
		}), /missing original/u);
		await assert.rejects(verify(async path => path === target ? Buffer.concat([bytes, Buffer.from("changed")]) : originals.get(path)));
	}
	t.diagnostic(`${originals.size * 2} missing/corrupted original controls`);
});
