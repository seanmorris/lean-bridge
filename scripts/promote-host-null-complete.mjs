#!/usr/bin/env node
/**
 * Replay, stage and atomically promote the complete 170-cell hosted HostNull
 * matrix and its generated documentation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import { renderReferenceDocuments } from "./generate-reference-docs.mjs";
import {
	hostNullCompletePromotionReference, promoteHostNullComplete
} from "../tests/helpers/host-null-complete-promotion.mjs";
import {
	hostNullCompleteDocumentationPaths
	, renderHostNullCompleteDocumentation
} from "../tests/helpers/host-null-complete-documentation.mjs";
import {
	hostNullCompleteDocumentationPinTransitions
	, reconcileHostNullCompleteDocumentationPins
} from "../tests/helpers/host-null-complete-documentation-pin-reconciliation.mjs";
import {
	hostNullPerlSharedSource
} from "../tests/helpers/host-null-complete-perl-evidence-refresh.mjs";
import {
	hostNullCompleteSourcePinEvidenceIds, hostNullTypeDocsSharedSource
	, reconcileHostNullCompleteSourcePins
} from "../tests/helpers/host-null-complete-source-pin-reconciliation.mjs";
import {
	readPromotionInventory, stageEvidenceRefresh, stagePromotionInventory
} from "../tests/helpers/type-surface-promotion-io.mjs";
import {
	commitPromotionFiles, promotionFileIdentity
} from "../tests/helpers/promotion-file-transaction.mjs";

assert.ok(process.argv.length === 2 || (process.argv.length === 3
	&& process.argv[2] === "--check")
, "Use no arguments to promote, or --check to preflight without changing files");
const checkOnly = process.argv[2] === "--check";
const root = process.cwd();
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 1024 * 1024
});
const gitBytes = arguments_ => execFileSync("git", arguments_, {
	maxBuffer: 1024 * 1024
});
const head = git(["rev-parse", "HEAD"]).trim();
const clean = () => {
	assert.equal(git(["rev-parse", "HEAD"]).trim(), head
		, "Promotion HEAD changed");
	assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), ""
		, "HostNull promotion requires a clean committed checkout");
};
clean();

const path = "docs/type-surface.v1.json";
const [irSchema, consumers] = await Promise.all([
	readFile("schema/binding-ir.schema.json", "utf8").then(JSON.parse)
	, readFile("docs/consumer-support.v1.json", "utf8").then(JSON.parse)
]);
const fullOriginal = JSON.parse(await readFile(path, "utf8"));
const retainedEvidenceIds = hostNullCompleteSourcePinEvidenceIds(fullOriginal);
const retainedEvidence = new Set(retainedEvidenceIds);
const original = await readPromotionInventory(createReadStream(path)
	, { irSchema, consumers });
assert.deepEqual(original.document.evidence.map(entry => entry.id)
	, fullOriginal.evidence.map(entry => entry.id));
original.document.evidence = original.document.evidence.map((entry, index) =>
	retainedEvidence.has(entry.id) ? fullOriginal.evidence[index] : entry);
assert.equal(original.document.evidence.filter(entry =>
	retainedEvidence.has(entry.id)).length, retainedEvidenceIds.length);
const sources = {};
for(const [name, documentPath] of Object.entries(
	hostNullCompleteDocumentationPaths))
	sources[name] = await readFile(documentPath, "utf8");
renderHostNullCompleteDocumentation(sources);

const reference = await hostNullCompletePromotionReference();
const currentSources = Object.fromEntries(await Promise.all([
	["perl", hostNullPerlSharedSource]
	, ["typeDocs", hostNullTypeDocsSharedSource]
].map(async ([name, sourcePath]) => {
	const source = await readFile(sourcePath), digest = sha256(source);
	assert.equal(sha256(gitBytes([
		"show", `${reference.revision}:${sourcePath}`
	])), digest, `Hosted producer must authenticate ${sourcePath}`);
	return [name, digest];
})));
const reconciliation = reconcileHostNullCompleteSourcePins(
	original.document, reference, currentSources);
const refreshedDocument = reconciliation.inventory;
let promoted = promoteHostNullComplete(
	refreshedDocument, { irSchema, consumers }, reference);
let generated = await renderReferenceDocuments({
	root, inventory: { document: promoted, irSchema, consumers }
});
let documentationEntries = Object.entries(
	hostNullCompleteDocumentationPaths).map(([name, documentPath]) => [
	name, generated[documentPath] ?? sources[name]
	]);
let documentation = renderHostNullCompleteDocumentation(Object.fromEntries(
	documentationEntries));
let documents = {
	...generated
	, ...Object.fromEntries(Object.entries(hostNullCompleteDocumentationPaths)
		.map(([name, documentPath]) => [documentPath, documentation[name]]))
};
const documentationReconciliation = reconcileHostNullCompleteDocumentationPins(
	promoted, new Map(hostNullCompleteDocumentationPinTransitions.map(item => [
		item.path, documents[item.path]
	]
	))
);
promoted = documentationReconciliation.inventory;
generated = await renderReferenceDocuments({
	root, inventory: { document: promoted, irSchema, consumers }
});
documentationEntries = Object.entries(
	hostNullCompleteDocumentationPaths).map(([name, documentPath]) => [
	name, generated[documentPath] ?? sources[name]
	]);
documentation = renderHostNullCompleteDocumentation(Object.fromEntries(
	documentationEntries));
const finalDocuments = {
	...generated
	, ...Object.fromEntries(Object.entries(hostNullCompleteDocumentationPaths)
		.map(([name, documentPath]) => [documentPath, documentation[name]]))
};
assert.deepEqual(finalDocuments, documents
	, "Documentation source-pin reconciliation must not change rendered prose");
documents = finalDocuments;

clean();
await mkdir(join(root, "build"), { recursive: true });
const staging = await mkdtemp(join(root, "build/host-null-complete-promotion-"));
let installing = false, completed = false;
try
{
	const refreshedPath = join(staging, "refreshed-inventory.json");
	const refreshedWithDocumentationPins = {
		...refreshedDocument
		, evidence: promoted.evidence.slice(0, original.document.evidence.length)
	};
	const refreshedIdentity = await stageEvidenceRefresh(
		path, refreshedPath, original, refreshedWithDocumentationPins);
	assert.equal(refreshedIdentity.bytes, original.source.bytes
		, "Digest-only Perl refresh must preserve inventory size");
	const refreshed = {
		...original, document: refreshedWithDocumentationPins
		, source: refreshedIdentity
	};
	const staged = join(staging, "inventory.json");
	const next = await stagePromotionInventory(
		refreshedPath, staged, refreshed, promoted);
	const files = [{ path, staged, previous: original.source, next }];
	const documentEntries = Object.entries(documents).entries();
	for(const [number, [documentPath, content]] of documentEntries)
	{
		const previous = await promotionFileIdentity(documentPath);
		const staged = join(staging, `document-${number}.md`);
		await writeFile(staged, content, { flag: "wx" });
		const next = await promotionFileIdentity(staged);
		if(previous?.sha256 === next.sha256) continue;
		files.push({ path: documentPath, staged, previous, next });
	}
	clean();
	if(!checkOnly)
	{
		installing = true;
		await commitPromotionFiles({ root, staging, files });
	}
	completed = true;
	process.stdout.write(JSON.stringify({
		mode: checkOnly ? "check" : "promote"
		, cells: 170
		, observations: promoted.observations.length
			- original.document.observations.length
		, refreshedEvidence: reconciliation.refreshedEvidence
			+ documentationReconciliation.refreshedEvidence
		, refreshedPins: reconciliation.refreshedPins
			+ documentationReconciliation.refreshedPins
		, inventory: next, files: files.map(file => file.path), head
	}, null, 2) + "\n");
}
finally
{
	if(!installing || completed) await rm(staging, { recursive: true });
	else process.stderr.write(
		`HostNull promotion recovery files retained: ${staging}\n`);
}
