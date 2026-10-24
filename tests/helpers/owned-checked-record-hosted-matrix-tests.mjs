/**
 * Reject partial matrix claims and prove retained bytes are committed.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	ownedCheckedRecordHostedLaneNames, ownedCheckedRecordHostedLanes
	, ownedCheckedRecordHostedRoutes
} from "./owned-checked-record-hosted-contracts.mjs";
import {
	assertOwnedCheckedRecordCommittedArchive, assertOwnedCheckedRecordMatrixIndexes
	, assertOwnedCheckedRecordMatrixSelection, verifyOwnedCheckedRecordHostedMatrix
} from "./owned-checked-record-hosted-matrix.mjs";

const selectionFor = indexes => ({
	schemaVersion: 1, kind: "owned-checked-record-matrix-selection"
	, archives: ownedCheckedRecordHostedLaneNames.map((lane, position) => ({
		lane
		, index: { path: `docs/evidence/owned-checked-record-${lane}-hosted-20990101/index.json`
			, sha256: sha256(indexes[position]) }
	}))
});
const indexesForPreflight = () => ownedCheckedRecordHostedLaneNames.map(lane => {
	const producerCommit = (lane === "javascript" ? "b" : lane === "php-wasm" ? "c" : "a").repeat(40);
	return Buffer.from(canonicalJson({ schemaVersion: 1, lane
		, kind: `owned-checked-record-${lane}-hosted-v1`
		, targets: ownedCheckedRecordHostedLanes[lane].targets
		, producerCommit, consumerCommit: producerCommit
		, accepted: { lane, producerCommit
			, routes: ownedCheckedRecordHostedRoutes.map(route => ({ route })) }
	}));
});

test("owned matrix selection requires eleven lanes and forty-four routes", () => {
	const indexes = indexesForPreflight(), selection = selectionFor(indexes);
	assertOwnedCheckedRecordMatrixSelection(selection);
	const values = assertOwnedCheckedRecordMatrixIndexes(selection, indexes);
	assert.equal(values.length, 11);
	assert.equal(values.reduce((sum, value) => sum + value.accepted.routes.length, 0), 44);
	assert.equal(new Set(values.map(value => value.producerCommit)).size, 3);
});

test("owned matrix selection rejects missing, duplicate, widened and unsafe references", () => {
	const original = selectionFor(indexesForPreflight());
	for(const mutate of [
		value => { value.archives.pop(); }
		, value => { value.archives.push(value.archives[0]); }
		, value => { value.archives[1] = value.archives[0]; }
		, value => { value.archives.reverse(); }
		, value => { value.archives[0].lane = "unknown"; }
		, value => { value.kind = "promoted"; }
		, value => { value.schemaVersion = 2; }
		, value => { value.optional = true; }
		, value => { value.archives[0].optional = true; }
		, value => { value.archives[0].index.optional = true; }
		, value => { value.archives[0].index.path = "/tmp/index.json"; }
		, value => { value.archives[0].index.path = "docs/evidence/../index.json"; }
		, value => { value.archives[0].index.path = value.archives[1].index.path; }
		, value => { value.archives[0].index.sha256 = "bad"; }
	]) {
		const changed = structuredClone(original); mutate(changed);
		assert.throws(() => assertOwnedCheckedRecordMatrixSelection(changed));
	}
});

test("owned matrix preflight rejects forged hashes, lanes, targets and route coverage", () => {
	const indexes = indexesForPreflight(), selection = selectionFor(indexes);
	assert.throws(() => assertOwnedCheckedRecordMatrixIndexes(selection, indexes.slice(1)));
	const corrupted = [...indexes]; corrupted[0] = Buffer.concat([corrupted[0], Buffer.from(" ")]);
	assert.throws(() => assertOwnedCheckedRecordMatrixIndexes(selection, corrupted));
	assert.throws(() => assertOwnedCheckedRecordMatrixIndexes(selectionFor(corrupted), corrupted));
	for(const mutate of [
		value => { value.lane = "php-wasm"; }
		, value => { value.kind = "local-qualification"; }
		, value => { value.targets.push("unknown"); }
		, value => { value.consumerCommit = "c".repeat(40); }
		, value => { value.accepted.lane = "php-wasm"; }
		, value => { value.accepted.producerCommit = "c".repeat(40); }
		, value => { value.accepted.routes.pop(); }
		, value => { value.accepted.routes[1] = value.accepted.routes[0]; }
		, value => { value.accepted.routes.push({ route: "async-full" }); }
		, value => {
			value.producerCommit = value.consumerCommit = value.accepted.producerCommit = "c".repeat(40);
		}
	]) {
		const changed = [...indexes], value = JSON.parse(changed[0]); mutate(value);
		changed[0] = Buffer.from(canonicalJson(value));
		assert.throws(() => assertOwnedCheckedRecordMatrixIndexes(selectionFor(changed), changed));
	}
});

const committedFixture = async t => {
	const repository = await mkdtemp(join(tmpdir(), "lean-owned-matrix-git-"));
	t.after(() => rm(repository, { recursive: true, force: true }));
	const root = "docs/evidence/owned-checked-record-ruby-hosted-20990101";
	await mkdir(join(repository, root), { recursive: true });
	const files = [];
	for(const [path, bytes] of [["empty", Buffer.alloc(0)]
		, ["binary", Buffer.alloc(256 * 1024 + 17, 137)]
		, ["text", Buffer.from("alpha\n\0omega\n")]]) {
		await writeFile(join(repository, root, path), bytes);
		files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
		}
	const index = Buffer.from(canonicalJson({ files }));
	await writeFile(join(repository, root, "index.json"), index);
	const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", ["-C", repository, ...arguments_]
		, { encoding: "utf8", env: environment, stdio: ["ignore", "pipe", "pipe"] });
	git(["init", "--quiet"]);
	const commit = () => {
		git(["add", "."]);
		git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
			, "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "fixture"]);
		return git(["rev-parse", "HEAD"]).trim();
	};
	return { repository, root, index, files, commit, revision: commit() };
};

test("owned matrix Git audit streams the exact committed file set", async t => {
	const { repository, root, index, revision, files } = await committedFixture(t);
	assert.deepEqual(await assertOwnedCheckedRecordCommittedArchive(revision, root, index, repository)
		, { files: 4, bytes: index.length + files.reduce((sum, file) => sum + file.bytes, 0) });
	// Git retention is independent of the worktree; full verification separately replays it.
	await writeFile(join(repository, root, "text"), "uncommitted");
	assert.equal((await assertOwnedCheckedRecordCommittedArchive(revision, root, index, repository)).files, 4);
});

test("owned matrix Git audit rejects altered indexes and missing or duplicate files", async t => {
	const { repository, root, index, revision } = await committedFixture(t);
	for(const mutate of [
		value => { value.files.pop(); }
		, value => { value.files.push(value.files[0]); }
		, value => { value.files[0].path = "../outside"; }
		, value => { value.files[0].bytes++; }
		, value => { value.files[0].sha256 = "0".repeat(64); }
	]) {
		const changed = JSON.parse(index); mutate(changed);
		await assert.rejects(assertOwnedCheckedRecordCommittedArchive(
			revision, root, Buffer.from(canonicalJson(changed)), repository
		));
	}
});

test("owned matrix Git audit rejects unindexed files and executable evidence", async t => {
	const fixture = await committedFixture(t);
	await writeFile(join(fixture.repository, fixture.root, "unindexed"), "x");
	await assert.rejects(assertOwnedCheckedRecordCommittedArchive(
		fixture.commit(), fixture.root, fixture.index, fixture.repository
	));
	await rm(join(fixture.repository, fixture.root, "unindexed"));
	await chmod(join(fixture.repository, fixture.root, "binary"), 0o755);
	await assert.rejects(assertOwnedCheckedRecordCommittedArchive(
		fixture.commit(), fixture.root, fixture.index, fixture.repository
	));
});

test("owned matrix verification refuses absent archives before reporting any lane", async () => {
	let reported = 0;
	await assert.rejects(verifyOwnedCheckedRecordHostedMatrix(
		selectionFor(indexesForPreflight()), () => { reported++; }
	), { code: "ENOENT" });
	assert.equal(reported, 0);
});
