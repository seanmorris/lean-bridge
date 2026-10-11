/**
 * Preserve original exit-observation probes and refuse incomplete diagnostic archives.
 * The archived package replay does not establish a reproduction of the hosted shutdown race.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertFinContainerEdgeJvmGdbRun, finContainerEdgeJvmWaitGdbScript } from "./fin-container-edge-jvm-gdb.mjs";
import { readFinContainerEdgeJvm } from "./fin-container-edge-jvm.mjs";

const root = "docs/evidence/jvm-pending-exit-20261011";
const indexDigest = "2920296b61862f5eb1cd6876bf90a196b2d7d81c63bad6ffe0c87c8aa2409fa7";
const read = path => readFile(join(root, path));
const verify = async reader => {
	const bytes = await reader("index.json");
	assert.equal(sha256(bytes), indexDigest);
	const index = JSON.parse(bytes);
	assert.equal(index.files.length, 25);
	for(const file of index.files)
	{
		const bytes = await reader(file.path);
		assert.equal(bytes.length, file.bytes, file.path);
		assert.equal(sha256(bytes), file.sha256, file.path);
	}
	return index;
};

test("the pending JVM exit archive verifies the complete Java replay and refusal control", async () => {
	const index = await verify(read);
	const paths = (await readdir(root, { recursive: true, withFileTypes: true }))
		.filter(item => item.isFile()).map(item => join(item.parentPath, item.name).slice(root.length + 1));
	assert.deepEqual(paths.sort(), ["index.json", ...index.files.map(file => file.path)].sort());
	const summary = JSON.parse(await read("runtime/summary.json"));
	assert.deepEqual(summary.results.map(run => [run.mode, run.status, run.checks]), [
		["production", 0, "passed"], ["reaped-without-gdb-status", 72, "passed"]
	]);
	assert.match((await read("kernel-controls.tap")).toString(), /traced-kernel-exit-0, traced-kernel-exit-7/u);
	for(const index of [0, 1])
	{
		const stem = `runtime/run-${index}`;
		const config = JSON.parse(await read(`${stem}.json`));
		const result = JSON.parse(await read(`${stem}.result.json`));
		assert.equal(result.signal, null); assert.equal(result.error, undefined);
		const extractionRoot = config.argv[2].slice("-Djava.io.tmpdir=".length);
		const production = finContainerEdgeJvmWaitGdbScript({ nativeDirectory: config.root, extractionRoot, libraries: summary.libraries });
		const script = (await read(`${stem}.py`)).toString();
		assert.equal(script, index === 0 ? production : production.replace("    jvm_exit = jvm_observe_exit()"
			, '    gdb.set_convenience_variable("_exitcode", None)\n    jvm_exit = jvm_observe_exit()'));
		assert.equal(sha256(script), summary.results[index].scriptSha256);
		const stdout = (await read(`${stem}.stdout`)).toString();
		const stderr = (await read(`${stem}.stderr`)).toString();
		const rows = readFinContainerEdgeJvm(stdout, "java"); assert.equal(rows.length, 12046);
		const observer = { identity: config.identity
			, configSha256: config.configSha256
			, listings: JSON.parse(await read("runtime/listings.json"))
			, definerIndices: config.identity.definers.map(name => config.identity.libraries.indexOf(name)) };
		const run = { code: result.status
			, output: result.stdout + result.stderr, stdout, stderr
			, record: join(root, `${stem}.record`)
			, armed: join(root, `${stem}.armed.json`)
			, nonce: config.nonce, extractionRoot };
		if(index === 0)
		{
			const manifest = await assertFinContainerEdgeJvmGdbRun(observer, run, rows, summary.libraries);
			assert.deepEqual(manifest.jvmExit, summary.results[index].receipt);
		}
		else
		{
			assert.equal(result.status, 72); assert.equal(summary.results[index].receipt, null);
			assert.match(result.stderr, /fin instrumentation refused: the inferior did not exit normally/u);
			await assert.rejects(assertFinContainerEdgeJvmGdbRun(observer, run, rows, summary.libraries));
		}
	}
});

test("the pending JVM exit archive refuses every missing or changed original", async () => {
	const index = await verify(read);
	const originals = new Map(await Promise.all(["index.json", ...index.files.map(file => file.path)].map(async path => [path, await read(path)])));
	for(const [target, bytes] of originals)
	{
		await assert.rejects(verify(async path => {
			if(path === target) throw new Error("missing original");
			return originals.get(path);
		}), /missing original/u);
		await assert.rejects(verify(async path => path === target ? Buffer.concat([bytes, Buffer.from("changed")]) : originals.get(path)));
	}
});
