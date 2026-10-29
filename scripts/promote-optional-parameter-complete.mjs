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
	reconcileDependentCheckedRecordSourcePins
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
const currentSourcePaths = Object.freeze([
	"docs/php.md", "docs/consume/dotnet.md", "docs/consume/java.md"
	, "docs/consume/kotlin.md", "docs/consume/ruby.md"
	, "docs/consume/perl.md", "docs/consume/python.md"
	, "docs/consume/rust.md", "docs/consume/c.md", "docs/consume/cpp.md"
	, "docs/consume/wit-wasi.md", "docs/lean/existing-package.md"
	, "docs/lean/export-decisions.md"
]);
const currentSourceSet = new Set(currentSourcePaths);
const fullOriginal = JSON.parse(await readFile(path, "utf8"));
const retainedEvidenceIds = fullOriginal.evidence.filter(evidence =>
	evidence.files.some(file => currentSourceSet.has(file.path)))
	.map(evidence => evidence.id);
assert.equal(retainedEvidenceIds.length, 35
	, "Optional publication must retain exactly 35 live-pin evidence entries");
const retain = { retainEvidence: retainedEvidenceIds };
const original = await readPromotionInventory(createReadStream(path)
	, { irSchema, consumers }, retain);
const sources = {};
for(const [name, documentPath] of Object.entries(
	optionalParameterCompleteDocumentationPaths))
	sources[name] = await readFile(documentPath, "utf8");
renderOptionalParameterCompleteDocumentation(sources);

const reference = await optionalParameterCompleteReference();
const semanticPromotion = promoteOptionalParameterComplete(
	fullOriginal, { irSchema, consumers }, reference);
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
const currentDigests = new Map(currentSourcePaths.map(documentPath => {
	assert.ok(Object.hasOwn(documents, documentPath)
		, `Missing promoted documentation: ${documentPath}`);
	return [documentPath, sha256(documents[documentPath])];
}));
const changedCurrentSourcePaths = currentSourcePaths.filter(documentPath =>
	semanticPromotion.evidence.some(evidence => evidence.files.some(file =>
		file.path === documentPath
		&& file.sha256 !== currentDigests.get(documentPath))));
assert.deepEqual(changedCurrentSourcePaths, currentSourcePaths
	, "Every optional publication guide must require a live-pin refresh");
const reconciled = reconcileDependentCheckedRecordSourcePins(
	semanticPromotion, currentDigests);
const refreshedPins = reconciled.refreshed;
assert.equal(refreshedPins, 70
	, "Optional-parameter publication must refresh exactly 70 live pins");
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
	const priorEvidenceCount = fullOriginal.evidence.length;
	const stagingPromotion = {
		...semanticPromotion
		, evidence: [
			...original.document.evidence
			, ...semanticPromotion.evidence.slice(priorEvidenceCount)
		]
	};
	const semanticStaged = join(staging, "semantic-inventory.json");
	await stagePromotionInventory(
		path, semanticStaged, original, stagingPromotion);
	const semanticOriginal = await readPromotionInventory(
		createReadStream(semanticStaged), { irSchema, consumers }, retain);
	const promotedById = new Map(promoted.evidence.map(evidence => [
		evidence.id, evidence
	]));
	const refreshedProjection = {
		...semanticOriginal.document
		, evidence: semanticOriginal.document.evidence.map(evidence =>
			retainedEvidenceIds.includes(evidence.id)
				? promotedById.get(evidence.id) : evidence)
	};
	const staged = join(staging, "inventory.json");
	const next = await stageEvidenceRefresh(
		semanticStaged, staged, semanticOriginal, refreshedProjection);
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
			- fullOriginal.observations.length
		, sourcePins: {
			paths: currentSourcePaths, refreshed: refreshedPins
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
