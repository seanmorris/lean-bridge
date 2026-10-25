/**
 * Exercise committed-byte authentication and probe-only inventory projection.
 * Synthetic references do not establish installed or complete-matrix evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	appendPhpWasmEntryProbe, checkPhpWasmEntryCommittedBytes
	, phpWasmEntryProbeEvidenceId, readCommittedPhpWasmEntryProbe
} from "./php-wasm-refinement-entry-publication.mjs";

const archive = "docs/evidence/php-wasm-entry-hosted-20261025";
const fixture = async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-entry-committed-bytes-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, archive), { recursive: true });
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	git(["init", "--quiet"]); git(["config", "user.name", "Test"]);
	git(["config", "user.email", "test@example.invalid"]);
	const files = [];
	for(const [path, bytes] of [
		["index.json", Buffer.from("byte-audit-only fixture\n")]
		, ["original.part", Buffer.from([0, 1, 2, 255, 10])]
		, ["empty.log", Buffer.alloc(0)]
	]) {
		await writeFile(join(root, archive, path), bytes);
		files.push({ path, bytes: bytes.length, sha256: sha256(bytes) });
	}
	const commit = () => {
		git(["add", "--", archive]);
		git(["-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "original bytes"]);
		return git(["rev-parse", "HEAD"]).trim();
	};
	return { root, files, git, commit, revision: commit() };
};

test("PHP-Wasm publication authenticates exact committed bytes including empty and binary files", async t => {
	const { root, files, revision, commit } = await fixture(t);
	const result = await checkPhpWasmEntryCommittedBytes(revision, archive, files, root);
	assert.deepEqual(result, { scope: "committed-archive-bytes-only", revision
		, files: 3, bytes: files.reduce((sum, file) => sum + file.bytes, 0) });
	await chmod(join(root, archive, "original.part"), 0o755);
	assert.equal((await checkPhpWasmEntryCommittedBytes(commit(), archive, files, root)).files, 3);
	// The byte gate checks Git, not working files; the production reader separately
	// requires a clean checkout and actual working-archive reconstruction/replay.
	await writeFile(join(root, archive, "original.part"), "working file changed");
	assert.deepEqual(await checkPhpWasmEntryCommittedBytes(revision, archive, files, root), result);
});

test("PHP-Wasm publication refuses missing extra forged and unsafe committed files", async t => {
	const { root, files, revision, commit } = await fixture(t);
	for(const mutate of [
		rows => { rows.pop(); }
		, rows => { rows.push({ path: "missing", bytes: 0, sha256: sha256("") }); }
		, rows => { rows.push(rows[0]); }
		, rows => { rows[0].sha256 = "0".repeat(64); }
		, rows => { rows[1].bytes++; }
		, rows => { rows[0].path = "../index.json"; }
		, rows => { rows[0].path = "/index.json"; }
		, rows => { rows[0].path = "index\\file"; }
		, rows => { rows[0].bytes = -1; }
	]) {
		const altered = structuredClone(files); mutate(altered);
		await assert.rejects(checkPhpWasmEntryCommittedBytes(revision, archive, altered, root));
	}
	await writeFile(join(root, archive, "extra"), "extra");
	await assert.rejects(checkPhpWasmEntryCommittedBytes(commit(), archive, files, root), /no extra member/u);
	await symlink("index.json", join(root, archive, "link"));
	await assert.rejects(checkPhpWasmEntryCommittedBytes(commit(), archive, files, root), /regular files/u);
	assert.equal(await readFile(join(root, archive, "index.json"), "utf8"), "byte-audit-only fixture\n");
});

test("PHP-Wasm publication requires an exact commit instead of a branch tree or tag object", async t => {
	const { root, files, revision, git } = await fixture(t);
	git(["-c", "tag.gpgsign=false", "tag", "-a", "archive", "-m", "annotated alias", revision]);
	for(const reference of ["HEAD", "archive", git(["rev-parse", "archive"]).trim()
		, git(["rev-parse", revision + "^{tree}"]).trim()])
		await assert.rejects(checkPhpWasmEntryCommittedBytes(reference, archive, files, root));
});

const reference = () => {
	const parts = Array.from({ length: 28 }, (_, position) => ({
		path: archive + `/artifacts/${String(position).padStart(4, "0")}/zip/0000.part`
		, sha256: "c".repeat(64)
	}));
	return {
		id: phpWasmEntryProbeEvidenceId, kind: "test", revision: "a".repeat(40)
		, command: "synthetic-projection-only"
		, scope: "synthetic projection, not real replay"
		, files: [{ path: archive + "/index.json", sha256: "b".repeat(64) }, ...parts]
		, artifacts: parts };
};
const inventory = () => ({
	schemaVersion: 1, contractVersion: "unchanged"
	, evidence: [{ id: "earlier-evidence" }]
	, observations: [{
		id: "prepared"
		, stages: {
			installedExecution: { state: "passed", evidence: ["earlier-evidence"] }
		}
	}]
});

test("PHP-Wasm probe projection appends evidence without changing support observations", () => {
	const document = inventory(), evidence = reference(), before = structuredClone(document);
	const result = appendPhpWasmEntryProbe(document, evidence);
	assert.deepEqual(document, before);
	assert.deepEqual(result, { ...before, evidence: [...before.evidence, evidence] });
	assert.equal(result.observations, document.observations);
	assert.equal(result.evidence.at(-1).kind, "test");
	assert.throws(() => appendPhpWasmEntryProbe(result, evidence), /already published/u);
});

test("PHP-Wasm probe projection rejects widening missing artifacts and forged references", () => {
	for(const mutate of [
		value => { value.kind = "installed"; }
		, value => { value.id = "other"; }
		, value => { value.revision = "main"; }
		, value => { value.extra = true; }
		, value => { value.files = []; }
		, value => { value.files[0].path = "../../index.json"; }
		, value => { value.files[0].path = "docs/evidence/other/index.json"; }
		, value => { value.artifacts = []; }
		, value => { value.artifacts.pop(); }
		, value => { value.artifacts[0] = { ...value.artifacts[0], sha256: "d".repeat(64) }; }
		, value => { value.artifacts.push(value.artifacts[0]); }
		, value => { value.scope = ""; }
	]) {
		const evidence = reference(); mutate(evidence);
		assert.throws(() => appendPhpWasmEntryProbe(inventory(), evidence));
	}
	const document = inventory(); document.observations[0].stages.installedExecution.evidence.push(phpWasmEntryProbeEvidenceId);
	assert.throws(() => appendPhpWasmEntryProbe(document, reference()), /cannot establish consumer support/u);
});

test("PHP-Wasm probe publication refuses an unrelated archive before replay", async () => {
	for(const root of ["/tmp/archive", "docs/evidence/../archive", "docs/evidence/php-wasm-entry-diagnostic-20261025"])
		await assert.rejects(readCommittedPhpWasmEntryProbe(root, "/tmp/unrelated"));
});
