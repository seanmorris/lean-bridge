#!/usr/bin/env node
/**
 * Replay the entire committed owned matrix before refreshing its evidence/docs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { renderReferenceDocuments } from "./generate-reference-docs.mjs";
import {
	ownedCheckedRecordPromotionPath, ownedCheckedRecordPromotionReferences
	, ownedCheckedRecordPromotionSelectionPath, refreshOwnedCheckedRecords
	, renderOwnedCheckedRecordPromotion
} from "../tests/helpers/owned-checked-record-promotion.mjs";
import {
	ownedCheckedRecordDocumentationPaths, refreshOwnedCheckedRecordDocumentation
} from "../tests/helpers/owned-checked-record-documentation.mjs";
import { readPromotionInventory, stageEvidenceRefresh } from "../tests/helpers/type-surface-promotion-io.mjs";
import { commitPromotionFiles, promotionFileIdentity } from "../tests/helpers/promotion-file-transaction.mjs";

assert.ok(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === "--check")
	, "Use no arguments to refresh, or --check to preflight without changing files");
const checkOnly = process.argv[2] === "--check";
const root = process.cwd();
const git = arguments_ => execFileSync("git", arguments_, { encoding: "utf8", maxBuffer: 1024 * 1024 });
const head = git(["rev-parse", "HEAD"]).trim();
const clean = () => {
	assert.equal(git(["rev-parse", "HEAD"]).trim(), head, "Refresh HEAD changed");
	assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), ""
		, "Owned refresh requires a clean committed checkout");
};
clean();
const selectionBytes = await readFile(ownedCheckedRecordPromotionSelectionPath);
assert.equal(git(["show", `${head}:${ownedCheckedRecordPromotionSelectionPath}`]), selectionBytes.toString()
	, "Matrix selection must be committed at refresh HEAD");
const selection = JSON.parse(selectionBytes);
assert.equal(selectionBytes.toString(), canonicalJson(selection), "Matrix selection must be canonical");
const path = "docs/type-surface.v1.json";
const [irSchema, consumers] = await Promise.all([
	readFile("schema/binding-ir.schema.json", "utf8").then(JSON.parse)
	, readFile("docs/consumer-support.v1.json", "utf8").then(JSON.parse)
]);
const original = await readPromotionInventory(createReadStream(path), { irSchema, consumers });
const sources = {};
for(const [name, documentPath] of Object.entries(ownedCheckedRecordDocumentationPaths))
	sources[name] = await readFile(documentPath, "utf8");
refreshOwnedCheckedRecordDocumentation(sources);
assert.equal(await promotionFileIdentity(ownedCheckedRecordPromotionPath), null, "Owned refresh already published");
const { references, replay } = await ownedCheckedRecordPromotionReferences(selection, lane => {
	process.stderr.write(`Replayed committed owned checked-record archive: ${lane.lane}\n`);
});
assert.equal(replay.revision, head);
assert.equal(replay.selectionSha256, sha256(selectionBytes));
const promoted = refreshOwnedCheckedRecords(original.document, references);
const generated = await renderReferenceDocuments({ root, inventory: { document: promoted, irSchema, consumers } });
const documentation = refreshOwnedCheckedRecordDocumentation(Object.fromEntries(
	Object.entries(ownedCheckedRecordDocumentationPaths).map(([name, documentPath]) =>
		[name, generated[documentPath] ?? sources[name]])
));
const documents = { ...generated
	, ...Object.fromEntries(Object.entries(ownedCheckedRecordDocumentationPaths)
		.map(([name, documentPath]) => [documentPath, documentation[name]]))
	, [ownedCheckedRecordPromotionPath]: renderOwnedCheckedRecordPromotion(references) };
clean();
await mkdir(join(root, "build"), { recursive: true });
const staging = await mkdtemp(join(root, "build/owned-checked-record-refresh-"));
let installing = false, completed = false;
try
{
	const staged = join(staging, "inventory.json");
	const next = await stageEvidenceRefresh(path, staged, original, promoted);
	const files = [{ path, staged, previous: original.source, next }];
	for(const [number, [documentPath, content]] of Object.entries(documents).entries())
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
	process.stdout.write(JSON.stringify({ mode: checkOnly ? "check" : "refresh"
		, cells: 170, changedObservations: 0, refreshedEvidence: 11
		, replay, inventory: next
		, files: files.map(file => file.path), head }, null, 2) + "\n");
}
finally
{
	if(!installing || completed) await rm(staging, { recursive: true });
	else process.stderr.write(`Owned refresh recovery files retained: ${staging}\n`);
}
