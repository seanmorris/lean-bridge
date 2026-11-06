/** @file */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { registerRetainedContractTests, retainedContractScope } from "./helpers/retained-contract-tests.mjs";

const workflowJob = (source, job) => source.split(`\n  ${job}:\n`)[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
const staticImports = source => {
	const boundary = source.search(/^(?:await|class|const|export|function|let|test|var)\b/gmu);
	const header = boundary === -1 ? source : source.slice(0, boundary);
	return [...header.matchAll(
		/^import\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["'];/gmu
	)].map(match => match[1]).filter(specifier => specifier.startsWith("."));
};
const retainedPaths = source => [...source.matchAll(
	/["'`](docs\/evidence\/[^"'`\r\n]+)["'`]/gu
)].map(match => match[1]).filter(path => path.slice("docs/evidence/".length)
	.includes("/"));
const retainedReaders = async (entrypoints, overrides = new Map()) => {
	const pending = entrypoints.map(path => resolve(path)), seen = new Set();
	const readers = [];
	while(pending.length > 0)
	{
		const path = pending.pop();
		if(seen.has(path)) continue;
		seen.add(path);
		const source = overrides.get(path) ?? await readFile(path, "utf8");
		const retained = retainedPaths(source);
		if(retained.length > 0 && /(?:-tests|[.]test)[.]mjs$/u.test(path))
			readers.push({ path, retained });
		for(const specifier of staticImports(source))
		{
			const imported = resolve(dirname(path), specifier);
			pending.push(imported);
		}
	}
	return readers;
};

test("retained contracts are required by default and reject an unknown policy", async () => {
	assert.equal(retainedContractScope({}), "required");
	assert.throws(() => retainedContractScope({ LEAN_BRIDGE_RETAINED_CONTRACTS: "optional" })
		, /must be one of: required, deferred/u);
	await assert.rejects(registerRetainedContractTests([null], {}), /loaders must be functions/u);
});

test("required retained contracts load every suite in order", async () => {
	const loaded = [];
	const result = await registerRetainedContractTests([
		async () => { loaded.push("history"); }
		, async () => { loaded.push("evidence"); }
	], { LEAN_BRIDGE_RETAINED_CONTRACTS: "required" });
	assert.deepEqual(loaded, ["history", "evidence"]);
	assert.deepEqual(result, { scope: "required", registered: 2 });
});

test("deferred retained contracts do not load archive suites", async () => {
	let loaded = false;
	const result = await registerRetainedContractTests([
		async () => { loaded = true; }
	], { LEAN_BRIDGE_RETAINED_CONTRACTS: "deferred" });
	assert.equal(loaded, false);
	assert.deepEqual(result, { scope: "deferred", registered: 0 });
});

test("sparse consumers defer retained contracts while Core requires them", async () => {
	const [consumers, perl, quality] = await Promise.all([
		readFile(".github/workflows/consumer-matrix.yml", "utf8")
		, readFile(".github/workflows/perl-consumer.yml", "utf8")
		, readFile(".github/workflows/quality.yml", "utf8")
	]);
	for(const job of ["node-consumers", "php-consumers", "native-consumers", "managed-consumers", "wasi-consumer"])
	{
		const source = workflowJob(consumers, job);
		assert.ok(source, job);
		assert.equal(source.match(/LEAN_BRIDGE_RETAINED_CONTRACTS: deferred/gu)?.length, 1, job);
	}
	assert.equal(workflowJob(perl, "perl").match(/LEAN_BRIDGE_RETAINED_CONTRACTS: deferred/gu)?.length, 1);
	assert.equal(workflowJob(quality, "contract").match(/LEAN_BRIDGE_RETAINED_CONTRACTS: required/gu)?.length, 1);
});

test("deferred native consumer entrypoints have no static retained-evidence readers", async () => {
	const entrypoints = [
		"tests/native-fin-records.test.mjs"
		, "tests/native-fin-record-zero.test.mjs"
		, "tests/native-fin-callbacks.test.mjs"
		, "tests/native-subtype.test.mjs"
	];
	assert.deepEqual(await retainedReaders(entrypoints), []);
	const counts = [];
	for(const path of entrypoints)
	{
		const source = await readFile(path, "utf8");
		counts.push(source.match(/\(\) => import\("[.]\/helpers\//gu)?.length ?? 0);
	}
	assert.deepEqual(counts, [9, 2, 14, 66]);

	// Prove the closure check is not vacuous: restoring one archived suite to the
	// static graph must identify its dated retained-evidence directory.
	const path = resolve("tests/native-fin-record-zero.test.mjs");
	const source = await readFile(path, "utf8");
	const mutant = `import "./helpers/fin-record-zero-archive-tests.mjs";\n${source}`;
	const readers = await retainedReaders([path], new Map([[path, mutant]]));
	assert.ok(readers.some(reader => reader.retained.some(value =>
		value.startsWith("docs/evidence/fin-record-zero-native-20261010/"))));
});
