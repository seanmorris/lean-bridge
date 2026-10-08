/**
 * Authenticate the fresh Lean host-reply refusal run (VO #1453): its original queue, TAP and end record,
 * and the exact producer test whose one selected test enforces seven elaborations. Paths are checked
 * before any read; all three producer sources are authenticated through the historical reader.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";

export const refusalArchiveDirectory = "docs/evidence/native-fin-reply-refusals-20261008";
export const refusalRevision = "190c8fd76774c1e767b7d03f6b0ec40bebabe9f0";
export const refusalTest = "fresh Lean refuses a host callback's result without a Fin-free failure value and admits one with it";
const testPath = "tests/native-fin-callbacks.test.mjs";
const archived = name => `${refusalArchiveDirectory}/${name}`;
export const refusalSnapshot = archived(`sources/190c8fd/${testPath}.txt`);

/** The original producer outputs with their posted digests, and the producer source digests. */
export const refusalOriginals = Object.freeze({
	"queue.json": { original: "build/vo1453-fresh-lean-refusals-190c8fd.queue", sha256: "e7b2cc3a053809f366301c8e474ea134c04011f53bbd34f7359864d2768b6c61" }
	, "run.tap": { original: "build/vo1453-fresh-lean-refusals-190c8fd.tap", sha256: "633b1ffed168b8d32578d582e185433cd4382c04b3c931da6379f1120a9bebd4" }
	, "end.txt": { original: "build/vo1453-fresh-lean-refusals-190c8fd.end", sha256: "7402f18f6a955df08e928863f75b376ce9418cc0d0564399dd6b7913e01e4111" }
});
export const refusalSources = Object.freeze({
	[testPath]: "23846d584c6d79a186c5522138aaf2fd90ae87efd4ab20db885d4c65f1601fc5"
	, "src/analyze/NativeExports.lean": "46b46cbb21fe51d166ab700cde2c41583bc3a093f67cecd07d104cdf649f61ce"
	, "src/analyze/native-metadata.mjs": "d2cf52cf67bd8630a5fa172e63af02145606e19de03d174d8dac0387c7e64d8e"
});
/** The archive's exact path set besides its receipt. */
export const refusalArchivePaths = Object.freeze([...Object.keys(refusalOriginals).map(archived), refusalSnapshot]);

const selection = `${testPath} --test-name-pattern="^${refusalTest}$"`;
const leanPrefix = "/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2";
const lean = "Lean (version 4.32.2, x86_64-unknown-linux-gnu, commit f3b06c705e6c85f5314019d5d3baab0fec5b580c, Release)";

/**
 * The seven elaborations the selected test enforces, as exact lines of its body: three model refusals,
 * three extraction refusals and one admitted reply.
 */
export const refusalCases = Object.freeze({
	"reply": "const refused = [[\"reply\", \"def reply (host : Nat → Fin 5) : Nat := (host 0).val\"]"
	, "replyTile": ", [\"replyTile\", \"structure Tile where\\n  digit : Fin 5\\n  count : Nat\\ndef replyTile (host : Nat → Tile) : Nat := (host 0).count\"]"
	, "replyOk": ", [\"replyOk\", \"def replyOk (host : Nat → Except String (Fin 5)) : Nat := match host 0 with | .ok value => value.val | .error _ => 0\"]];"
	, "replySubtype": "definition: \"def replySubtype (host : Nat → Option { n : Nat // n < 5 }) : Nat := match host 0 with | none => 0 | some value => value.val\""
	, "replyInterval": "definition: `${interval}def replyInterval (host : Nat → Option Interval) : Nat := match host 0 with | none => 0 | some value => value.hi`"
	, "replyConfigured": "definition: `${interval}def replyConfigured (host : Nat → Interval) : Nat := (host 0).hi`"
	, "replies": "const source = \"namespace FinCallbacks\\ndef replies (host : Nat → Except String (Array (Fin 5))) : Nat := match host 0 with | .ok values => values.size | .error _ => 0\\nend FinCallbacks\\n\";"
});
/** Assertions each extraction refusal must meet; together they tie the refusal to extraction and its export. */
const refusalAssertions = Object.freeze([
	"/a host callback result needs a Fin-free failure value: scalar Fin, a Fin in its selected default, Subtype and checked records are refused/u.test(JSON.stringify(error.details ?? error.message)), name);"
	, "pattern: /Subtype refinements currently require a top-level parameter or result: /u"
	, "configured = { \"FinCallbacks.replyConfigured\": { parameters: [site({ refinement: { constructor: \"FinCallbacks.mkInterval\" } })], result: site({}) } };"
	, "assert.ok(error.message.includes(`\"declaration\":\"FinCallbacks.${name}\"`), `${name}: ${error.message}`);"
	, "assert.ok(error.message.includes(\"\\\"reason\\\":\\\"unsupported-native-type\\\"\"), `${name}: ${error.message}`);"
	, "assert.doesNotMatch(error.message, /a host callback result needs a Fin-free failure value/u, name);"
	, "assert.deepEqual(model.exports[0].parameters[0].type.reply, { kind: \"result\", arguments: [{ kind: \"array\", arguments: [{ kind: \"fin\", bound: \"5\" }] }, null] });"
]);

/**
 * The selected test's body holds all seven cases and the assertions that enforce them.
 *
 * @param source - Archived producer test source.
 */
export const assertRefusalTestSource = source => {
	const start = source.indexOf(`test("${refusalTest}", { skip: !lean, timeout: 900_000 }, async t => {\n`);
	assert.ok(start >= 0 && source.indexOf(`test("${refusalTest}"`, start + 1) < 0, "exactly one selected test");
	const end = source.indexOf("\n});\n", start);
	assert.ok(end > start, "the selected test ends");
	const body = source.slice(start, end);
	for(const [name, line] of Object.entries(refusalCases)) assert.equal(body.split(line).length, 2, `case ${name}`);
	for(const line of refusalAssertions) assert.equal(body.split(line).length, 2, line);
	// Pattern-shaped lines appear once per checked-record case.
	assert.equal(body.split("pattern: /checked records currently require a top-level parameter or result: [^\"]*Interval/u").length, 3, "both checked-record cases");
};

const counts = (tap, expected) => {
	for(const [key, count] of Object.entries(expected))
		assert.deepEqual([...tap.matchAll(new RegExp(`^# ${key} (.+)$`, "gmu"))].map(match => match[1]), [String(count)], `TAP ${key}`);
};

/**
 * Validate the original queue, TAP and end record of the one selected run.
 *
 * @param files - Archived run records.
 * @param files.queue - Original queue text.
 * @param files.tap - Original TAP text.
 * @param files.end - Original end record.
 */
export const assertRefusalRun = ({ queue, tap, end }) => {
	const record = JSON.parse(queue);
	assert.equal(record.node, 1453); assert.equal(record.revision, refusalRevision); assert.equal(record.selection, selection);
	assert.equal(record.cpu, "taskset -c 3"); assert.equal(record.concurrency, 1);
	assert.deepEqual(record.environment, { NO_COLOR: "1", FORCE_COLOR: "(unset)", LEAN_BRIDGE_NATIVE_FIN_CALLBACK_LEAN_TEST: "1", LEAN_BRIDGE_LEAN_PREFIX: leanPrefix });
	assert.deepEqual(record.sources, refusalSources);
	assert.equal(record.versions.lean, lean); assert.equal(record.versions.node, "v22.23.3");
	assert.deepEqual([...tap.matchAll(/^(not ok|ok) (\d+) - (.*)$/gmu)].map(match => match.slice(1)), [["ok", "1", refusalTest]]);
	assert.deepEqual([...tap.matchAll(/^1\.\.(\d+)$/gmu)].map(match => match[1]), ["1"]);
	assert.doesNotMatch(tap, /# (?:SKIP|TODO)\b/u);
	counts(tap, { tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 });
	const ended = /^end=\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ exit=(\d+) minFree=(\d+)M\n$/u.exec(end);
	assert.ok(ended, "end record"); assert.equal(ended[1], "0", "exit 0"); assert.ok(Number(ended[2]) >= 1024, "free-space floor");
};

/**
 * The receipt's fixed statement of scope; the artifacts come from the archived bytes.
 *
 * @param artifacts - Archived file references.
 */
export const refusalReceipt = artifacts => ({
	schemaVersion: 1
	, planNode: 1453
	, execution: "local"
	, revision: refusalRevision
	, test: refusalTest
	, selection
	, sources: refusalSources
	, scope: {
		cases: Object.keys(refusalCases)
		, enforcement: "seven elaborations asserted inside one selected test; the TAP records that test, not seven separate results"
		, executed: "fresh Lean extraction and native model construction, stopping before any C compilation"
		, installed: false
		, sanitizers: false
		, hostedCi: false
	}
	, sourceIdentity: "The producer test is archived as text because its integrated successor adds an import; the extractor and metadata sources are authenticated through the historical source reader."
	, artifacts
	, remaining: ["Source and archive integration with an exact history layer.", "Installed, sanitizer and hosted execution of these refusals are not claimed."]
});

/**
 * Write archived bytes once; an existing file, receipt included, must already hold exactly these bytes.
 *
 * @param path - Archive path.
 * @param bytes - Exact bytes.
 */
export const writeRefusalArtifact = async (path, bytes) => {
	await mkdir(dirname(path), { recursive: true });
	try
	{ await writeFile(path, bytes, { flag: "wx" }); }
	catch(error)
	{
		if(error.code !== "EEXIST") throw error;
		assert.ok((await readFile(path)).equals(bytes), `${path} already holds different bytes`);
	}
};

/**
 * Authenticate the whole archive: the exact path set before any read, every digest and size, the
 * fixed receipt, the run records, the producer test and the current historical sources.
 *
 * @param receipt - Parsed receipt.
 * @param read - Read archived or repository bytes for a repository-relative path.
 */
export const assertRefusalArchive = async (receipt, read) => {
	assert.ok(Array.isArray(receipt.artifacts));
	const paths = receipt.artifacts.map(artifact => artifact?.path);
	assert.deepEqual([...paths].sort(), [...refusalArchivePaths].sort(), "the exact archive path set");
	assert.equal(new Set(paths).size, paths.length);
	assert.deepEqual(receipt, refusalReceipt(receipt.artifacts));
	const files = {};
	for(const artifact of receipt.artifacts)
	{
		const bytes = await read(artifact.path);
		assert.equal(bytes.length, artifact.bytes, artifact.path); assert.equal(sha256(bytes), artifact.sha256, artifact.path);
		files[artifact.path] = bytes.toString();
	}
	for(const [name, file] of Object.entries(refusalOriginals))
	{
		const artifact = receipt.artifacts.find(item => item.path === archived(name));
		assert.equal(artifact.originalPath, file.original); assert.equal(artifact.sha256, file.sha256, name);
	}
	const snapshot = receipt.artifacts.find(item => item.path === refusalSnapshot);
	assert.equal(snapshot.originalPath, `git:${refusalRevision}:${testPath}`); assert.equal(snapshot.sha256, refusalSources[testPath]);
	assertRefusalRun({ queue: files[archived("queue.json")], tap: files[archived("run.tap")], end: files[archived("end.txt")] });
	assertRefusalTestSource(files[refusalSnapshot]);
	// The current test must also lead back to the exact executed intermediate, not just a retained snapshot.
	for(const path of [testPath, "src/analyze/NativeExports.lean", "src/analyze/native-metadata.mjs"])
		assert.equal(sha256(beforeFinRefinementSource(path, await read(path), refusalSources[path])), refusalSources[path], path);
};
