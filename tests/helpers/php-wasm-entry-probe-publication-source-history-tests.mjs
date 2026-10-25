/**
 * Check the exact probe publication using immutable data and bounded streams.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforePhpWasmEntryProbePublicationSource
	, phpWasmEntryProbePublicationAddedPaths
	, phpWasmEntryProbePublicationChangedPaths
	, phpWasmEntryProbePublicationCommits
	, phpWasmEntryProbePublicationImplementationPaths
	, phpWasmEntryProbePublicationHistoryPath
	, phpWasmEntryProbePublicationImplementation
	, phpWasmEntryProbePublicationIntegrationBase
	, phpWasmEntryProbePublicationIntegrationPaths
	, phpWasmEntryProbePublicationPredecessor
	, reversePhpWasmEntryProbePublicationUpdate
} from "./php-wasm-entry-probe-publication-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes } from "./source-history-stream.mjs";
import { typeSurfaceContractsAtProducer } from "./producer-source.mjs";
import { readPromotionInventory } from "./type-surface-promotion-io.mjs";
import { phpWasmEntryProbeEvidenceId } from "./php-wasm-refinement-entry-publication.mjs";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	phpWasmEntryProbeDocumentationPaths, renderPhpWasmEntryProbeDocumentation
} from "./php-wasm-refinement-entry-publication-docs.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	phpWasmEntryProbePublicationHistoryPath, "utf8"));
const inventoryPath = "docs/type-surface.v1.json";
let loaded;
const publication = () => loaded ??= (async () => {
	const revision = phpWasmEntryProbePublicationImplementation;
	const receipt = JSON.parse(git(["show"
		, revision
		+ ":docs/evidence/php-wasm-entry-probe-publication-20261025.json"]));
	const contracts = typeSurfaceContractsAtProducer(revision);
	const before = await readPromotionInventory(gitSourceBytes(
		phpWasmEntryProbePublicationPredecessor, inventoryPath), contracts);
	const after = await readPromotionInventory(gitSourceBytes(revision, inventoryPath)
		, contracts, { retainEvidence: [phpWasmEntryProbeEvidenceId] });
	assert.deepEqual(before.source, receipt.inventory.previous);
	assert.deepEqual(after.source, receipt.inventory.current);
	return { receipt, before: before.document, after: after.document
		, evidence: after.document.evidence.at(-1) };
})();

test("PHP-Wasm entry probe publication authenticates its wiring and lineage", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-entry-probe-publication-source-v1");
	assert.equal(record.predecessorCommit, phpWasmEntryProbePublicationPredecessor);
	assert.equal(record.implementationCommit, phpWasmEntryProbePublicationImplementation);
	assert.equal(record.integrationBaseCommit, phpWasmEntryProbePublicationIntegrationBase);
	assert.deepEqual(record.implementationCommits, phpWasmEntryProbePublicationCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmEntryProbePublicationChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmEntryProbePublicationIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmEntryProbePublicationAddedPaths);
	assert.deepEqual(git(["rev-list", "--reverse"
		, phpWasmEntryProbePublicationPredecessor + ".." + phpWasmEntryProbePublicationImplementation]).trim().split("\n")
	, phpWasmEntryProbePublicationCommits);
	for(const [index, revision] of phpWasmEntryProbePublicationCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? phpWasmEntryProbePublicationPredecessor : phpWasmEntryProbePublicationCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmEntryProbePublicationPredecessor
		, phpWasmEntryProbePublicationImplementation]).trim().split("\n")
	, [...phpWasmEntryProbePublicationImplementationPaths].sort());
	const updates = [...record.updates.filter(item => item.path !== inventoryPath)
		, ...record.integrationUpdates];
	for(const update of updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmEntryProbePublicationSource);
		const prior = record.integrationUpdates.includes(update)
			? phpWasmEntryProbePublicationIntegrationBase : phpWasmEntryProbePublicationPredecessor;
		const previous = git(["show", prior + ":" + update.path]);
		assert.equal(reversePhpWasmEntryProbePublicationUpdate(
			current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	assert.ok(finRefinementNormalizationPaths.includes(inventoryPath));
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
});

test("PHP-Wasm entry probe publication preserves every prepared-package observation", async () => {
	const { receipt, before, after, evidence } = await publication();
	assert.equal(receipt.kind, "php-wasm-entry-probe-publication-v1");
	assert.equal(receipt.scope, "separate-instrumented-probe");
	assert.equal(receipt.preparedPackageObservationsChanged, false);
	assert.equal(receipt.publisherCommit, phpWasmEntryProbePublicationPredecessor);
	assert.equal(receipt.replay.replayedRoutes, 30);
	assert.equal(receipt.replay.producerArtifacts, 27);
	assert.equal(receipt.replay.aggregateArtifacts, 1);
	assert.equal(evidence.id, phpWasmEntryProbeEvidenceId);
	assert.equal(evidence.kind, "test");
	assert.equal(evidence.revision, receipt.replay.producerCommit);
	assert.deepEqual(evidence.files[0], { path: receipt.archive.path, sha256: receipt.archive.sha256 });
	assert.equal(after.evidence.length, before.evidence.length + 1);
	const pins = new Map(receipt.sourcePins.map(pin => [pin.path, pin]));
	assert.deepEqual(after.evidence.slice(0, -1), before.evidence.map(entry => ({
		...entry, files: entry.files.map(file => pins.has(file.path)
			? { ...file, sha256: pins.get(file.path).current } : file)
	})));
	assert.deepEqual({ ...after, evidence: before.evidence }, before);
	assert.deepEqual(receipt.sourcePins.map(pin => ({ path: pin.path, count: pin.count })), [
		{ path: "docs/php.md", count: 6 }, { path: "docs/publish/php.md", count: 5 }
		, { path: "docs/lean/existing-package.md", count: 18 }
		, { path: "docs/reference/types.md", count: 0 }
	]);
});

test("PHP-Wasm entry probe publication changes only four paragraphs and registered checks", async () => {
	const { receipt, evidence } = await publication();
	const previous = {}, current = {};
	for(const [page, path] of Object.entries(phpWasmEntryProbeDocumentationPaths))
	{
		previous[page] = git(["show", phpWasmEntryProbePublicationPredecessor + ":" + path]);
		current[page] = git(["show", phpWasmEntryProbePublicationImplementation + ":" + path]);
		const document = receipt.documents.find(item => item.path === path); assert.ok(document);
		assert.deepEqual(document.previous, { bytes: Buffer.byteLength(previous[page]), sha256: sha256(previous[page]) });
		assert.deepEqual(document.current, { bytes: Buffer.byteLength(current[page]), sha256: sha256(current[page]) });
		const pin = receipt.sourcePins.find(item => item.path === path); assert.ok(pin);
		assert.equal(pin.previous, document.previous.sha256); assert.equal(pin.current, document.current.sha256);
	}
	assert.deepEqual(current, renderPhpWasmEntryProbeDocumentation(previous, evidence));
	const path = "tests/checked-javascript.test.mjs";
	assert.equal(git(["show", phpWasmEntryProbePublicationImplementation + ":" + path])
		, git(["show", phpWasmEntryProbePublicationPredecessor + ":" + path]).replace(
			'import "./helpers/php-wasm-entry-publication-pin-repair-source-history-tests.mjs";'
			, 'import "./helpers/php-wasm-entry-publication-pin-repair-source-history-tests.mjs";'
			+ '\nimport "./helpers/php-wasm-entry-published-probe-tests.mjs";'));
	for(const path of [".github/workflows/php-wasm-refinement-entry-promotion.yml"
		, "scripts/summarize-php-wasm-refinement-entry-hosted.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-archive.mjs"
		, "tests/helpers/type-surface-promotion-io.mjs"
		, "docs/evidence/php-wasm-entry-hosted-20261025"
		, "docs/evidence/php-wasm-entry-hosted-acceptance-20261025"])
		assert.equal(git(["rev-parse", phpWasmEntryProbePublicationPredecessor + ":" + path])
			, git(["rev-parse", phpWasmEntryProbePublicationImplementation + ":" + path]), path);
});

test("PHP-Wasm entry probe publication streams an exact append and 29 named pin changes", async () => {
	const { receipt, evidence } = await publication();
	const update = (await read()).updates.find(item => item.path === inventoryPath); assert.ok(update);
	assert.equal(update.previousSha256, receipt.inventory.previous.sha256);
	assert.equal(update.currentSha256, receipt.inventory.current.sha256);
	assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
		phpWasmEntryProbePublicationImplementation, inventoryPath), update), true);
	assert.equal(update.edits.length, 30);
	const insertion = update.edits.at(-1);
	const rendered = JSON.stringify(evidence, null, 2).split("\n").map(line => "    " + line).join("\n");
	assert.equal(insertion.previous, "");
	assert.equal(insertion.current, "    },\n" + rendered.slice(0, -5));
	const edits = new Map(update.edits.slice(0, -1).map(edit => [edit.start, edit]));
	const pins = new Map(receipt.sourcePins.map(pin => [pin.path, { ...pin, seen: 0 }]));
	let files = false, offset = 0, pending;
	const input = Readable.from(gitSourceBytes(phpWasmEntryProbePublicationImplementation, inventoryPath));
	for await(const line of createInterface({ input, crlfDelay: Infinity }))
	{
		if(line === '      "files": [') files = true;
		if(line === "      ],") files = false;
		if(pending)
		{
			assert.ok(files);
			assert.equal(line, '          "sha256": "' + pending.current + '"');
			const edit = edits.get(offset); assert.ok(edit, pending.path);
			assert.equal(edit.current, line + "\n");
			assert.equal(edit.previous, '          "sha256": "' + pending.previous + '"\n');
			edits.delete(offset); pending.seen++;
		}
		const match = files && /^ {10}"path": "([^"]+)",$/u.exec(line);
		pending = match ? pins.get(match[1]) : undefined;
		offset += line.length + 1;
	}
	assert.equal(edits.size, 0);
	for(const pin of pins.values()) assert.equal(pin.seen, pin.count, pin.path);
	assert.equal([...pins.values()].reduce((total, pin) => total + pin.seen, 0), 29);
	const encoded = git(["show"
		, phpWasmEntryProbePublicationImplementation
		+ ":docs/evidence/php-wasm-entry-probe-publication-20261025.json"]);
	assert.equal(encoded, canonicalJson(receipt));
});

test("PHP-Wasm entry probe publication rejects unknown or forged transitions", async () => {
	const update = (await read()).integrationUpdates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmEntryProbePublicationSource);
	assert.equal(beforePhpWasmEntryProbePublicationSource(
		update.path, current, update.currentSha256), current);
	const unknown = current + "\nunknown";
	assert.equal(beforePhpWasmEntryProbePublicationSource(
		update.path, unknown), unknown);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, edits: [...update.edits, update.edits[0]] }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reversePhpWasmEntryProbePublicationUpdate(current, forged));
	assert.equal(beforePhpWasmEntryProbePublicationSource(
		"unrelated.mjs", current), current);
});

test("PHP-Wasm entry probe publication writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-entry-hosted-identity-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-php-wasm-entry-probe-publication-source-history.mjs")]
	, { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
