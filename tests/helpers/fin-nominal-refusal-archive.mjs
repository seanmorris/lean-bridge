/**
 * Authenticate the original failed and repaired fresh-Lean nominal refusal audits.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";

/**
 * Verify original bytes, source identities, actual diagnostics and absent outputs.
 *
 * @param expected - Pinned index digest, revision and original outcome.
 * @param read - File reader, replaceable only for corruption controls.
 */
export const assertFinNominalRefusalArchive = async (expected, read = readFile) => {
	const root = `docs/evidence/fin-nominal-refusals-20261010/${expected.revision.slice(0, 7)}`;
	const indexBytes = await read(`${root}/index.json`);
	assert.equal(sha256(indexBytes), expected.digest);
	const index = JSON.parse(indexBytes);
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "fin-nominal-refusal-audit");
	assert.equal(index.revision, expected.revision); assert.equal(index.outcome, expected.outcome);
	const passed = expected.outcome === "passed";
	const names = ["start.json", "run.tap", "runner.mjs"
		, ...["generic", "recursive", "callback-record"].flatMap(label => [`${label}.lean`, `${label}.json`])
		, ...(passed ? ["end.json"] : [])
		, "sources/src/analyze/NativeExports.lean"
		, "sources/src/analyze/native-metadata.mjs"];
	assert.deepEqual(index.files.map(file => file.path), names);
	const bytes = new Map();
	for(const file of index.files)
	{
		const source = await read(`${root}/${file.path}`);
		assert.equal(source.length, file.bytes, file.path);
		assert.equal(sha256(source), file.sha256, file.path);
		bytes.set(file.path, source);
	}
	const json = name => JSON.parse(bytes.get(name));
	const start = json("start.json");
	assert.equal(start.revision, expected.revision); assert.equal(start.tree, index.tree);
	assert.equal(start.runnerSha256, sha256(bytes.get("runner.mjs")));
	for(const path of ["src/analyze/NativeExports.lean", "src/analyze/native-metadata.mjs"])
		assert.equal(start.sources[path], sha256(bytes.get(`sources/${path}`)));
	const tap = bytes.get("run.tap").toString();
	assert.match(tap, /# tests 4\n/u);
	assert.match(tap, passed ? /# pass 4\n# fail 0\n/u : /# pass 2\n# fail 2\n/u);
	assert.match(tap, /# cancelled 0\n# skipped 0\n/u);
	const namesByLabel = { generic: "genericSite", recursive: "recursiveSite", "callback-record": "callbackRecordSite" };
	for(const [label, name] of Object.entries(namesByLabel))
	{
		const record = json(`${label}.json`), declaration = `NativeFin.${name}`;
		assert.equal(record.declaration, declaration); assert.equal(record.label, label);
		assert.equal(record.outputExists, false);
		assert.equal(record.sourceSha256, sha256(bytes.get(`${label}.lean`)));
		assert.deepEqual(record.config.exports, [declaration]);
		const { failure } = record;
		if(label === "recursive" && !passed)
		{
			assert.equal(failure.code, "native-project-build-failed");
			assert.match(failure.message, /graph edges require copied references/u);
			assert.deepEqual(failure.details, {}); continue;
		}
		assert.equal(failure.code, "native-elaboration-unsupported");
		const projection = failure.details.projections.find(item => item.declaration === declaration);
		assert.equal(projection?.status, "unsupported"); assert.equal(projection.reason, "unsupported-native-type");
		const problem = { generic: /generic record instantiations/u, recursive: /checked Fin refinements cannot share a component with copied graph exports/u, "callback-record": /callback/u }[label];
		assert.match(projection.expression, problem);
		assert.ok(failure.details.diagnostics.some(item => item.declaration === declaration && item.severity === "error"));
		if(passed)
		{
			const source = bytes.get(`${label}.lean`).toString();
			assert.equal(projection.source.path, "NativeFin.lean");
			assert.equal(projection.source.startLine, source.split("\n").findIndex(line => line.startsWith(`def ${name} `)) + 1);
			assert.equal(projection.source.startColumn, 0);
		}
	}
	if(passed)
	{
		const end = json("end.json");
		assert.equal(end.revision, expected.revision); assert.equal(end.trackedClean, true);
		assert.ok(Date.parse(end.completedAt) >= Date.parse(start.startedAt));
		assert.match(start.leanVersion, /Lean \(version 4\.32\.2/u);
		assert.match(start.leanSha256, /^[a-f0-9]{64}$/u);
	}
	return index;
};
