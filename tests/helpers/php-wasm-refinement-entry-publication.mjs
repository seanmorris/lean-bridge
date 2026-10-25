/**
 * Bind probe publication to a complete independently replayed, committed archive.
 * Instrumented evidence never changes prepared-package support observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkPhpWasmEntryHostedArchive, checkPhpWasmEntryHostedArchiveIndex
} from "./php-wasm-refinement-entry-hosted-archive.mjs";
import { checkPhpWasmEntryStoredIndex } from "./php-wasm-refinement-entry-hosted-storage.mjs";

export const phpWasmEntryProbeEvidenceId = "php-wasm-refinement-entry-hosted-probes";
const environment = () => Object.fromEntries(Object.entries(process.env)
	.filter(([key]) => !key.startsWith("GIT_")));
const git = (args, cwd = process.cwd()) => execFileSync("git", args
	, { cwd, env: environment(), encoding: "utf8", maxBuffer: 16 * 1024 ** 2
		, stdio: ["ignore", "pipe", "pipe"] });
const rootPath = path => assert.match(path, /^docs\/evidence\/php-wasm-entry-hosted-[0-9]{8}$/u);
const relativePath = path => {
	assert.equal(typeof path, "string");
	assert.ok(path.length > 0 && !/[\\:\0\r\n]/u.test(path));
	assert.ok(path.split("/").every(part => part && part !== "." && part !== ".."));
};
const identity = (value, minimum = 0) => {
	assert.ok(Number.isSafeInteger(value.bytes) && value.bytes >= minimum);
	assert.match(value.sha256, /^[a-f0-9]{64}$/u);
};
const keys = (value, expected) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value));
	assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
};
const slot = position => String(position).padStart(4, "0");
const fileIdentity = bytes => ({ bytes: bytes.length, sha256: sha256(bytes) });

/**
 * Authenticate every archive byte in immutable Git blobs at one exact revision.
 * This byte-only audit cannot replace working-file checks or real route replay.
 *
 * @param revision - Full commit, not a moving branch.
 * @param root - Closed repository-relative PHP-Wasm archive directory.
 * @param files - Exact archive-relative byte inventory, including its index.
 * @param repository - Repository path for the archive or an isolated unit test.
 */
export const checkPhpWasmEntryCommittedBytes = async (
	revision, root, files, repository = process.cwd()
) => {
	assert.match(revision, /^[a-f0-9]{40}$/u); rootPath(root);
	assert.equal(git(["rev-parse", "--verify", revision + "^{commit}"], repository).trim()
		, revision, "archive revision must identify the commit itself");
	assert.ok(Array.isArray(files) && files.length > 0 && files.length <= 600_000);
	const expected = new Map();
	for(const file of files)
	{
		keys(file, ["path", "bytes", "sha256"]); relativePath(file.path); identity(file);
		expected.set(root + "/" + file.path, file);
	}
	assert.equal(expected.size, files.length, "duplicate committed file");
	const entries = git(["ls-tree", "-rz", "--full-tree", revision, "--", root], repository)
		.split("\0").filter(Boolean).map(line => {
			const match = /^100(?:644|755) blob ([a-f0-9]{40})\t(.+)$/u.exec(line);
			assert.ok(match, "archive Git members must be regular files");
			return { object: match[1], path: match[2] };
		});
	assert.deepEqual(entries.map(entry => entry.path).sort(), [...expected.keys()].sort()
		, "commit must contain every indexed archive byte and no extra member");
	const child = spawn("git", ["-C", repository, "cat-file", "--batch"]
		, { env: environment(), stdio: ["pipe", "pipe", "pipe"] });
	let errorText = "";
	child.stderr.on("data", chunk => { errorText = (errorText + chunk).slice(-4096); });
	const completed = new Promise((accept, reject) => {
		child.once("error", reject);
		child.once("close", (code, signal) => accept({ code, signal }));
	});
	void completed.catch(() => {}); child.stdin.on("error", () => {});
	child.stdin.end(entries.map(entry => entry.object).join("\n") + "\n");
	let buffer = Buffer.alloc(0), stage = "header", position = 0, remaining = 0, hash;
	try
	{
		for await(const chunk of child.stdout)
		{
			buffer = Buffer.concat([buffer, chunk]);
			while(buffer.length)
			{
				const entry = entries[position]; assert.ok(entry, "unexpected Git batch output");
				const file = expected.get(entry.path);
				if(stage === "header")
				{
					const end = buffer.indexOf(10);
					if(end < 0)
					{
						assert.ok(buffer.length < 1024); break;
					}
					assert.deepEqual(buffer.subarray(0, end).toString().split(" ")
						, [entry.object, "blob", String(file.bytes)], entry.path);
					remaining = file.bytes; hash = createHash("sha256");
					buffer = buffer.subarray(end + 1); stage = "body";
				}
				if(stage === "body")
				{
					const size = Math.min(buffer.length, remaining);
					hash.update(buffer.subarray(0, size)); buffer = buffer.subarray(size); remaining -= size;
					if(remaining) break;
					assert.equal(hash.digest("hex"), file.sha256, entry.path); stage = "newline";
				}
				if(stage === "newline")
				{
					if(!buffer.length) break;
					assert.equal(buffer[0], 10); buffer = buffer.subarray(1); position++; stage = "header";
				}
			}
		}
		assert.deepEqual(await completed, { code: 0, signal: null }, errorText);
		assert.equal(stage, "header"); assert.equal(buffer.length, 0); assert.equal(position, files.length);
	}
	finally
	{
		child.stdin.destroy(); child.stdout.destroy();
		if(child.exitCode === null) child.kill("SIGTERM");
		await completed.catch(() => {});
	}
	return { scope: "committed-archive-bytes-only", revision, files: files.length
		, bytes: files.reduce((total, file) => total + file.bytes, 0) };
};

const archiveFiles = async (root, index, indexBytes) => {
	const files = [{ path: "index.json", ...fileIdentity(indexBytes) }
		, { path: "api/run.json", ...index.run }
		, { path: "replay.json", ...index.replay }];
	const compact = new Set(files.map(file => file.path)), artifacts = [];
	for(const [position, item] of index.artifacts.entries())
	{
		const path = item.directory + "/index.json", bytes = await readFile(join(root, path));
		assert.deepEqual(fileIdentity(bytes), item.index, path);
		const stored = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(stored));
		checkPhpWasmEntryStoredIndex(stored);
		const rows = [{ path, ...item.index }
			, { path: `api/jobs/${slot(position)}.json`, ...item.job }
			, { path: `api/artifacts/${slot(position)}.json`, ...item.artifact }];
		for(const row of rows) compact.add(row.path);
		files.push(...rows);
		for(const part of stored.zip.parts)
		{
			const path = item.directory + "/" + part.path;
			files.push({ path, bytes: part.bytes, sha256: part.sha256 });
			compact.add(path); artifacts.push(path);
		}
		for(const output of stored.output)
			files.push({ path: item.directory + "/" + output.path, bytes: output.bytes, sha256: output.sha256 });
	}
	for(const source of index.sources)
		for(const part of source.parts)
		{
			files.push({ path: part.path, bytes: part.bytes, sha256: part.sha256 }); compact.add(part.path);
		}
	files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
	assert.equal(new Set(files.map(file => file.path)).size, files.length);
	const reference = path => {
		const file = files.find(item => item.path === path); assert.ok(file);
		return { path: root + "/" + path, sha256: file.sha256 };
	};
	return { files, references: [...compact].map(reference), artifacts: artifacts.map(reference) };
};

/**
 * Recheck complete original evidence and its exact committed bytes before
 * constructing the compact probe reference. There is no injected verifier.
 *
 * @param root - Repository-relative immutable archive directory.
 * @param producerCheckout - Clean checkout at the original producer revision.
 */
export const readCommittedPhpWasmEntryProbe = async (root, producerCheckout) => {
	rootPath(root);
	const revision = git(["rev-parse", "HEAD"]).trim();
	const clean = () => {
		assert.equal(git(["rev-parse", "HEAD"]).trim(), revision, "publication HEAD changed");
		assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), ""
			, "probe publication requires a clean committed checkout");
	};
	clean();
	const path = root + "/index.json", bytes = await readFile(path), index = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(index)); checkPhpWasmEntryHostedArchiveIndex(index);
	const replay = await checkPhpWasmEntryHostedArchive(resolve(root), producerCheckout);
	assert.deepEqual(await readFile(path), bytes, "archive index changed during replay");
	const members = await archiveFiles(root, index, bytes);
	const committed = await checkPhpWasmEntryCommittedBytes(revision, root, members.files);
	const validators = [
		"scripts/check-php-wasm-refinement-entry-hosted-archive.mjs"
		, "tests/helpers/php-wasm-refinement-entry-publication.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-archive.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-identities.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-replay.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-storage.mjs"
	];
	const sources = [];
	for(const path of validators)
	{
		const bytes = await readFile(path);
		assert.deepEqual(bytes, Buffer.from(git(["show", revision + ":" + path])), path);
		sources.push({ path, sha256: sha256(bytes) });
	}
	clean();
	return { replay, committed, archive: { path, ...fileIdentity(bytes) }
		, evidence: {
			id: phpWasmEntryProbeEvidenceId, kind: "test", revision: index.producerCommit
			, command: 'node scripts/check-php-wasm-refinement-entry-hosted-archive.mjs --directory "$PWD/' + root
				+ '" --producer-checkout "$LEAN_BRIDGE_PRODUCER_CHECKOUT"'
			, scope: `GitHub Actions run ${replay.runId}, attempt ${replay.runAttempt}, at ${index.producerCommit}: 30 ordinary/reviewed routes in 27 retained producer artifacts plus the aggregate verifier artifact. All original API/ZIP/output bytes and producer/archiver sources are committed and independently reconstructed; the original producer's real thirty-route verifier replays every retained record. Separate instrumented PHP-Wasm fixture packages measure validator, constructor, adapter and Lean-source entries on 24 copied, owned and indexed routes; six callback routes record callback control totals. This test evidence does not change prepared-package support states, instrument unmodified consumer packages, establish performance or memory bounds, or prove unmeasured signatures. External runtimes, toolchains and operating-system distributions remain recorded inputs.`
			, files: [...members.references, ...sources], artifacts: members.artifacts
		}
	};
};

/**
 * Pure projection only: append a validated probe reference without modifying
 * any prepared-package observation, support stage or earlier evidence entry.
 * The production caller must obtain the reference through real archive replay.
 *
 * @param document - Validated inventory or its streaming semantic projection.
 * @param evidence - Probe reference built by the committed archive reader.
 */
export const appendPhpWasmEntryProbe = (document, evidence) => {
	keys(evidence, ["id", "kind", "revision", "command", "scope", "files", "artifacts"]);
	assert.equal(evidence.id, phpWasmEntryProbeEvidenceId); assert.equal(evidence.kind, "test");
	assert.match(evidence.revision, /^[a-f0-9]{40}$/u);
	for(const name of ["command", "scope"]) assert.ok(typeof evidence[name] === "string" && evidence[name].length > 0);
	for(const name of ["files", "artifacts"])
	{
		assert.ok(Array.isArray(evidence[name]) && evidence[name].length > 0);
		assert.equal(new Set(evidence[name].map(file => file.path)).size, evidence[name].length);
		for(const file of evidence[name])
		{
			keys(file, ["path", "sha256"]); relativePath(file.path); assert.match(file.sha256, /^[a-f0-9]{64}$/u);
		}
	}
	const indexPath = evidence.files[0].path;
	assert.match(indexPath, /^docs\/evidence\/php-wasm-entry-hosted-[0-9]{8}\/index\.json$/u);
	const root = indexPath.slice(0, -"/index.json".length), slots = [];
	for(const artifact of evidence.artifacts)
	{
		assert.ok(artifact.path.startsWith(root + "/"));
		const match = /^artifacts\/(\d{4})\/zip\/\d{4}\.part$/u.exec(artifact.path.slice(root.length + 1));
		assert.ok(match); slots.push(match[1]);
		assert.ok(evidence.files.some(file => file.path === artifact.path && file.sha256 === artifact.sha256));
	}
	assert.deepEqual([...new Set(slots)].sort(), Array.from({ length: 28 }, (_, position) => slot(position)));
	assert.ok(!document.evidence.some(item => item.id === evidence.id), "probe evidence already published");
	for(const observation of document.observations)
		for(const stage of Object.values(observation.stages))
			assert.ok(!stage.evidence.includes(evidence.id), "entry probes cannot establish consumer support");
	return { ...document, evidence: [...document.evidence, evidence] };
};
