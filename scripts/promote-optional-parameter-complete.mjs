#!/usr/bin/env node
/**
 * Replay, stage and atomically promote all 34 optional-parameter cells and
 * their generated and author-facing documentation.
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
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	optionalParameterCompleteReference
} from "../tests/helpers/optional-parameter-hosted-evidence.mjs";
import {
	promoteOptionalParameterComplete
} from "../tests/helpers/optional-parameter-complete-promotion.mjs";
import {
	optionalParameterCompleteDocumentationPaths
	, renderOptionalParameterCompleteDocumentation
} from "../tests/helpers/optional-parameter-complete-documentation.mjs";
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
const head = git(["rev-parse", "HEAD"]).trim();
const clean = () => {
	assert.equal(git(["rev-parse", "HEAD"]).trim(), head
		, "Optional-parameter promotion HEAD changed");
	assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), ""
		, "Optional-parameter promotion requires a clean committed checkout");
};
clean();

const path = "docs/type-surface.v1.json";
const [irSchema, consumers] = await Promise.all([
	readFile("schema/binding-ir.schema.json", "utf8").then(JSON.parse)
	, readFile("docs/consumer-support.v1.json", "utf8").then(JSON.parse)
]);
const original = await readPromotionInventory(createReadStream(path)
	, { irSchema, consumers });
const sources = {};
for(const [name, documentPath] of Object.entries(
	optionalParameterCompleteDocumentationPaths))
	sources[name] = await readFile(documentPath, "utf8");
renderOptionalParameterCompleteDocumentation(sources);

const reference = await optionalParameterCompleteReference();
const semanticPromotion = promoteOptionalParameterComplete(
	original.document, { irSchema, consumers }, reference);
const renderDocuments = async document => {
	const generated = await renderReferenceDocuments({
		root, inventory: { document, irSchema, consumers }
	});
	const documentationEntries = Object.entries(
		optionalParameterCompleteDocumentationPaths).map(
		([name, documentPath]) => [
			name, generated[documentPath] ?? sources[name]
		]);
	const documentation = renderOptionalParameterCompleteDocumentation(
		Object.fromEntries(documentationEntries));
	return {
		...generated
		, ...Object.fromEntries(Object.entries(
			optionalParameterCompleteDocumentationPaths).map(
			([name, documentPath]) => [documentPath, documentation[name]]))
	};
};
const documents = await renderDocuments(semanticPromotion);
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	semanticPromotion, Object.keys(documents));
assert.ok(currentSourcePaths.length > 0
	, "Optional-parameter publication must own changed live-source pins");
const currentDigests = new Map(currentSourcePaths.map(documentPath => {
	assert.ok(Object.hasOwn(documents, documentPath), documentPath);
	return [documentPath, sha256(documents[documentPath])];
}));
const reconciled = reconcileDependentCheckedRecordSourcePins(
	semanticPromotion, currentDigests);
assert.ok(reconciled.refreshed > 0
	, "Optional-parameter publication must refresh changed live-source pins");
const promoted = reconciled.inventory;
assert.deepEqual(await renderDocuments(promoted), documents
	, "Source-pin reconciliation must not change rendered documentation");

clean();
await mkdir(join(root, "build"), { recursive: true });
const staging = await mkdtemp(join(root
	, "build/optional-parameter-complete-promotion-"));
let installing = false, completed = false;
try
{
	const semanticStaged = join(staging, "semantic-inventory.json");
	await stagePromotionInventory(
		path, semanticStaged, original, semanticPromotion);
	const semanticOriginal = await readPromotionInventory(
		createReadStream(semanticStaged), { irSchema, consumers });
	const staged = join(staging, "inventory.json");
	const next = await stageEvidenceRefresh(
		semanticStaged, staged, semanticOriginal, promoted);
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
		, cells: 34
		, observations: promoted.observations.length
			- original.document.observations.length
		, sourcePins: {
			paths: currentSourcePaths, refreshed: reconciled.refreshed
		}
		, inventory: next, files: files.map(file => file.path), head
	}, null, 2) + "\n");
}
finally
{
	if(!installing || completed) await rm(staging, { recursive: true });
	else process.stderr.write(
		`Optional-parameter promotion recovery files retained: ${staging}\n`);
}
