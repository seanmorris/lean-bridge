/**
 * Compact manifest commitments and fail-closed promotion entry points.
 * Synthetic indices exercise reference binding, never installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	ownedSubtypePromotionArchiveRoot, ownedSubtypePromotionArchives
} from "./owned-subtype-promotion-catalog.mjs";
import { ownedSubtypePromotionArchiveReferences } from "./owned-subtype-promotion-archive-references.mjs";

const syntheticIndex = item => {
	const payload = Buffer.from("Synthetic manifest control, not a runtime package");
	const part = { path: "hosted/artifact.zip.parts/0000.part", offset: 0
		, bytes: payload.length, sha256: sha256(payload) };
	const files = ["artifact", "job", "run"].map(name => ({
		path: `hosted/api/${name}.json`, bytes: 3, sha256: sha256("{}\n")
	}));
	files.push({ path: part.path, bytes: part.bytes, sha256: part.sha256 }
		, { path: "hosted/output/retained-package.tgz", bytes: payload.length, sha256: sha256(payload) });
	return {
		kind: `owned-subtype-${item.lane}-hosted-v1`, lane: item.lane
		, profiles: [...item.profiles], producerCommit: item.producer, files
		, hostedRun: { runId: item.run, job: { id: item.job }
			, createdAt: `${item.date.slice(0, 4)}-${item.date.slice(4, 6)}-${item.date.slice(6)}T00:00:00Z`
			, apiRecords: Object.fromEntries(["artifact", "job", "run"].map(name => [name
				, { bytes: 3, sha256: sha256("{}\n") }]))
			, artifact: { bytes: payload.length, parts: [part] } }
		, accepted: { kind: "owned-subtype-hosted-replay", lane: item.lane
			, profiles: [...item.profiles], producerCommit: item.producer
			, ...item.lane === "javascript" ? { tests: 12 } : {}
			, accepted: item.lane === "javascript"
				? { schemaVersion: 2, profile: "installed-owned-subtype-javascript"
					, routes: ["ordinary", "reviewed"].map(route => ({
						route, archives: 2, archiveBytes: 1, browserExecutions: 12
					}))
				}
				: { routes: ["ordinary", "reviewed"] } }
	};
};

test("owned Subtype compact references bind each canonical manifest, API record and ZIP part", () => {
	for(const item of ownedSubtypePromotionArchives)
	{
		const index = syntheticIndex(item), root = ownedSubtypePromotionArchiveRoot(item.lane);
		const bytes = Buffer.from(canonicalJson(index));
		const compact = ownedSubtypePromotionArchiveReferences(index, root, bytes);
		assert.equal(compact.files.length, 5);
		assert.equal(compact.artifacts.length, 1);
		assert.equal(compact.files[0].sha256, sha256(bytes));
		assert.equal(compact.files[0].path, `${root}/index.json`);
		assert.deepEqual(compact.artifacts, compact.files.slice(4));
		assert.equal(compact.files.some(file => file.path.endsWith("retained-package.tgz")), false);
		assert.equal(JSON.parse(bytes).files.some(file => file.path.endsWith("retained-package.tgz")), true);
	}
});

test("owned Subtype compact references reject changed identity and noncanonical bytes", () => {
	const index = syntheticIndex(ownedSubtypePromotionArchives[0]);
	const root = ownedSubtypePromotionArchiveRoot(index.lane), bytes = Buffer.from(canonicalJson(index));
	for(const wrongRoot of ["../outside", root + "/", ownedSubtypePromotionArchiveRoot("native")])
		assert.throws(() => ownedSubtypePromotionArchiveReferences(index, wrongRoot, bytes));
	assert.throws(() => ownedSubtypePromotionArchiveReferences(index, root, Buffer.concat([bytes, Buffer.from(" ")])));
	assert.throws(() => ownedSubtypePromotionArchiveReferences(index, root, bytes.toString()));
	for(const mutate of [
		value => { value.producerCommit = "0".repeat(40); }
		, value => { value.hostedRun.runId++; }
		, value => { value.hostedRun.job.id++; }
		, value => { value.profiles.push("php-wasm"); }
	]) {
		const changed = structuredClone(index); mutate(changed);
		assert.throws(() => ownedSubtypePromotionArchiveReferences(changed, root, Buffer.from(canonicalJson(changed))));
	}
});

test("owned Subtype compact references reject missing, forged and disconnected manifests", () => {
	const index = syntheticIndex(ownedSubtypePromotionArchives[1]);
	const root = ownedSubtypePromotionArchiveRoot(index.lane);
	for(const mutate of [
		value => { value.files.splice(3, 1); }
		, value => { value.files.push(value.files[0]); }
		, value => { value.files[0].path = "../outside"; }
		, value => { value.files[0].path = "/outside"; }
		, value => { value.files[0].bytes++; }
		, value => { value.files[0].sha256 = "0".repeat(64); }
		, value => { value.files.at(-1).bytes = -1; }
		, value => { value.files.at(-1).sha256 = "invalid"; }
		, value => { value.files.push({ path: "index.json", bytes: 0, sha256: "0".repeat(64) }); }
		, value => { delete value.hostedRun.apiRecords.job; }
		, value => { value.hostedRun.artifact.parts = []; }
		, value => { value.hostedRun.artifact.parts.push(value.hostedRun.artifact.parts[0]); }
		, value => { value.hostedRun.artifact.parts[0].offset = 1; }
		, value => { value.hostedRun.artifact.parts[0].bytes = 0; }
		, value => { value.hostedRun.artifact.parts[0].sha256 = "0".repeat(64); }
		, value => { value.hostedRun.artifact.bytes++; }
	]) {
		const changed = structuredClone(index); mutate(changed);
		assert.throws(() => ownedSubtypePromotionArchiveReferences(changed, root, Buffer.from(canonicalJson(changed))));
	}
});

test("owned Subtype compact commitments cover payloads outside the short reference list", () => {
	const index = syntheticIndex(ownedSubtypePromotionArchives[1]);
	const root = ownedSubtypePromotionArchiveRoot(index.lane), originalBytes = Buffer.from(canonicalJson(index));
	const original = ownedSubtypePromotionArchiveReferences(index, root, originalBytes);
	index.files.at(-1).sha256 = "0".repeat(64);
	assert.throws(() => ownedSubtypePromotionArchiveReferences(index, root, originalBytes));
	const changed = ownedSubtypePromotionArchiveReferences(index, root, Buffer.from(canonicalJson(index)));
	assert.notEqual(changed.files[0].sha256, original.files[0].sha256);
	assert.deepEqual(changed.files.slice(1), original.files.slice(1));
});

test("owned Subtype promotion CLI refuses invalid modes and unrelated checkouts without writes", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-subtype-promotion-cli-"));
	t.after(() => rm(root, { recursive: true }));
	const script = resolve("scripts/promote-owned-subtype-evidence.mjs");
	for(const args of [[], ["--check"], ["--skip"], ["--check", "--check"]])
	{
		const result = spawnSync(process.execPath, ["--max-old-space-size=256", script, ...args]
		, { cwd: root, encoding: "utf8", timeout: 20_000, maxBuffer: 1024 * 1024 });
		assert.equal(result.error, undefined);
		assert.equal(result.signal, null);
		assert.equal(result.status, 1);
		assert.match(result.stderr, args.length > 1 || args[0] === "--skip"
			? /Use no arguments to promote, or --check/u : /not a git repository/u);
		assert.equal(result.stdout, "");
		assert.deepEqual(await readdir(root), []);
	}
});

test("owned Subtype promotion preflight and installation both refuse uncommitted work", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-subtype-promotion-dirty-"));
	t.after(() => rm(root, { recursive: true }));
	execFileSync("git", ["init", "--quiet", root]);
	execFileSync("git", ["-C", root, "-c", "user.name=Fixture"
		, "-c", "user.email=fixture@example.invalid", "-c", "core.hooksPath=/dev/null"
		, "commit", "--allow-empty", "--quiet", "-m", "Fixture"]);
	await writeFile(join(root, "keep.txt"), "Concurrent user work\n");
	for(const args of [[], ["--check"]])
	{
		const result = spawnSync(process.execPath, ["--max-old-space-size=256"
			, resolve("scripts/promote-owned-subtype-evidence.mjs"), ...args]
		, { cwd: root, encoding: "utf8", timeout: 20_000, maxBuffer: 1024 * 1024 });
		assert.equal(result.error, undefined);
		assert.equal(result.signal, null);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /requires a clean committed checkout/u);
		assert.equal(result.stdout, "");
		assert.equal(await readFile(join(root, "keep.txt"), "utf8"), "Concurrent user work\n");
		assert.deepEqual((await readdir(root)).sort(), [".git", "keep.txt"]);
	}
});

test("owned Subtype writer preflights documents and uses the shared streaming transaction", async () => {
	const source = await readFile("scripts/promote-owned-subtype-evidence.mjs", "utf8");
	const order = ["renderOwnedSubtypeDocumentation(sources)"
		, "await ownedSubtypePromotionReferences()", "await renderReferenceDocuments("
		, "await stagePromotionInventory(", "await commitPromotionFiles("];
	const offsets = order.map(marker => {
		const offset = source.indexOf(marker);
		assert.ok(offset >= 0, `Missing writer stage: ${marker}`);
		assert.equal(source.indexOf(marker, offset + 1), -1, `Repeated writer stage: ${marker}`);
		return offset;
	});
	assert.deepEqual(offsets, [...offsets].sort((left, right) => left - right));
	assert.match(source, /if\(!checkOnly\)/u);
	assert.doesNotMatch(source, /writeFile\(path,|JSON\.stringify\(promoted/u);
});
