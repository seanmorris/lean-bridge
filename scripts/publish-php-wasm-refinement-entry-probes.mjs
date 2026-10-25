#!/usr/bin/env node
/**
 * Replay a complete committed probe archive before publishing its references.
 * Prepared-package observations and historical archive bytes stay unchanged.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, statfs, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { renderReferenceDocuments } from "./generate-reference-docs.mjs";
import {
	appendPhpWasmEntryProbe, phpWasmEntryProbeEvidenceId
	, readCommittedPhpWasmEntryProbe
} from "../tests/helpers/php-wasm-refinement-entry-publication.mjs";
import {
	phpWasmEntryProbeDocumentationPaths, phpWasmEntryProbePreviousDocumentation
	, renderPhpWasmEntryProbeDocumentation
} from "../tests/helpers/php-wasm-refinement-entry-publication-docs.mjs";
import { readPromotionInventory, stagePromotionInventory } from "../tests/helpers/type-surface-promotion-io.mjs";
import { commitPromotionFiles, promotionFileIdentity } from "../tests/helpers/promotion-file-transaction.mjs";
import { gitSourceBytes } from "../tests/helpers/source-history-stream.mjs";
import { stagePhpWasmEntryProbePins } from "../tests/helpers/php-wasm-refinement-entry-publication-pins.mjs";

const usage = "Usage: publish-php-wasm-refinement-entry-probes.mjs --archive <repository-relative-archive> --producer-checkout <exact-absolute-worktree> [--check]";
const args = process.argv.slice(2), options = {};
assert.ok(args.length === 4 || args.length === 5, usage);
for(let index = 0; index < args.length; index++)
{
	const flag = args[index];
	assert.ok(["--archive", "--producer-checkout", "--check"].includes(flag)
		&& !Object.hasOwn(options, flag), usage);
	options[flag] = flag === "--check" ? true : args[++index];
}
assert.match(options["--archive"] ?? "", /^docs\/evidence\/php-wasm-entry-hosted-[0-9]{8}$/u, usage);
assert.ok(typeof options["--producer-checkout"] === "string"
	&& isAbsolute(options["--producer-checkout"])
	&& resolve(options["--producer-checkout"]) === options["--producer-checkout"], usage);
const checkOnly = options["--check"] === true, archive = options["--archive"];
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
assert.equal(process.cwd(), root, "Probe publication must run in its own checkout");
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
const git = args => execFileSync("git", args, {
	env: environment, encoding: "utf8"
	, maxBuffer: 4 * 1024 ** 2, stdio: ["ignore", "pipe", "pipe"] });
const head = git(["rev-parse", "HEAD"]).trim();
const clean = () => {
	assert.equal(git(["rev-parse", "HEAD"]).trim(), head, "Publication HEAD changed");
	assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), ""
		, "Probe publication requires a clean committed checkout");
};
clean();
const path = "docs/type-surface.v1.json";
const irSchema = JSON.parse(await readFile("schema/binding-ir.schema.json", "utf8"));
const consumers = JSON.parse(await readFile("docs/consumer-support.v1.json", "utf8"));
const original = await readPromotionInventory(createReadStream(path), { irSchema, consumers });
const committedHash = createHash("sha256"); let committedBytes = 0;
for await(const chunk of gitSourceBytes(head, path))
{ committedHash.update(chunk); committedBytes += chunk.length; }
assert.deepEqual(original.source, { bytes: committedBytes, sha256: committedHash.digest("hex") }
	, "Publication inventory must match committed bytes");
assert.ok(!original.document.evidence.some(item => item.id === phpWasmEntryProbeEvidenceId)
	, "Hosted probe evidence already published");
const receiptPath = "docs/evidence/php-wasm-entry-probe-publication-" + archive.slice(-8) + ".json";
assert.equal(await promotionFileIdentity(receiptPath), null, "Publication receipt already exists");
const sources = {}, previousDocuments = {};
for(const [page, documentPath] of Object.entries(phpWasmEntryProbeDocumentationPaths))
{
	const bytes = await readFile(documentPath);
	assert.deepEqual(bytes, Buffer.from(git(["show", head + ":" + documentPath])), documentPath);
	sources[page] = bytes.toString();
	assert.equal(sources[page].split(phpWasmEntryProbePreviousDocumentation[page]).length, 2
		, "Exact previous probe paragraph: " + page);
	previousDocuments[documentPath] = { bytes: bytes.length, sha256: sha256(bytes) };
}
const accepted = await readCommittedPhpWasmEntryProbe(archive, options["--producer-checkout"]);
assert.equal(accepted.committed.revision, head);
const promoted = appendPhpWasmEntryProbe(original.document, accepted.evidence);
assert.deepEqual(promoted.observations, original.document.observations);
const rendered = renderPhpWasmEntryProbeDocumentation(sources, accepted.evidence);
const documents = Object.fromEntries(Object.entries(phpWasmEntryProbeDocumentationPaths)
	.map(([page, documentPath]) => [documentPath, rendered[page]]));
const generated = await renderReferenceDocuments({ root
	, inventory: { document: promoted, irSchema, consumers } });
for(const [documentPath, source] of Object.entries(generated))
	assert.equal(source, documentPath === phpWasmEntryProbeDocumentationPaths.reference
		? documents[documentPath] : await readFile(documentPath, "utf8")
	, "Publication must preserve every generated table and unrelated paragraph: " + documentPath);
clean();
const space = await statfs(root);
assert.ok(space.bavail * space.bsize >= original.source.bytes * 2 + 512 * 1024 ** 2
	, "Publication staging and rollback must leave at least 512 MiB free");
await mkdir(join(root, "build"), { recursive: true });
const staging = await mkdtemp(join(root, "build/php-wasm-entry-publication-"));
let installing = false, completed = false;
try
{
	const unpinned = join(staging, "inventory-unpinned.json");
	const staged = join(staging, "inventory.json");
	const projected = await stagePromotionInventory(path, unpinned, original, promoted);
	const updates = Object.entries(documents).map(([path, content]) => ({ path
		, previous: previousDocuments[path].sha256
		, current: sha256(Buffer.from(content)) }));
	const { pins, ...next } = await stagePhpWasmEntryProbePins(
		createReadStream(unpinned), staged, projected, updates
	);
	await rm(unpinned);
	const files = [{ path, staged, previous: original.source, next }];
	for(const [position, [documentPath, content]] of Object.entries(documents).entries())
	{
		const staged = join(staging, `document-${position}.md`);
		await writeFile(staged, content, { flag: "wx" });
		files.push({ path: documentPath, staged
			, previous: previousDocuments[documentPath]
			, next: await promotionFileIdentity(staged) });
	}
	const receipt = {
		schemaVersion: 1, kind: "php-wasm-entry-probe-publication-v1"
		, scope: "separate-instrumented-probe", publisherCommit: head
		, archive: accepted.archive, replay: accepted.replay
		, committed: accepted.committed
		, evidenceId: accepted.evidence.id, preparedPackageObservationsChanged: false
		, sourcePins: pins
		, inventory: { previous: original.source, current: next }
		, documents: files.slice(1).map(file => ({ path: file.path
			, previous: file.previous, current: file.next }))
	};
	const receiptStaged = join(staging, "publication.json");
	await writeFile(receiptStaged, canonicalJson(receipt), { flag: "wx" });
	files.push({ path: receiptPath, staged: receiptStaged, previous: null
		, next: await promotionFileIdentity(receiptStaged) });
	clean();
	if(!checkOnly)
	{
		installing = true;
		await commitPromotionFiles({ root, staging, files });
	}
	completed = true;
	const result = { mode: checkOnly ? "check" : "publish"
		, head, evidenceId: accepted.evidence.id
		, replayedRoutes: accepted.replay.replayedRoutes
		, refreshedSourcePins: pins.reduce((sum, pin) => sum + pin.count, 0)
		, preparedPackageObservationsChanged: false, inventory: next
		, files: files.map(file => file.path) };
	process.stdout.write(canonicalJson(result));
}
finally
{
	if(!installing || completed) await rm(staging, { recursive: true });
	else process.stderr.write(`Probe publication recovery files retained: ${staging}\n`);
}
