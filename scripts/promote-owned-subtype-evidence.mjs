#!/usr/bin/env node
/**
 * Replay all eight original Subtype archives before staging support and docs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderReferenceDocuments } from "./generate-reference-docs.mjs";
import {
	ownedSubtypePromotionPath, ownedSubtypePromotionReferences
	, promoteOwnedSubtypes
	, renderOwnedSubtypePromotion
} from "../tests/helpers/owned-subtype-promotion.mjs";
import {
	ownedSubtypeDocumentationPaths, renderOwnedSubtypeDocumentation
} from "../tests/helpers/owned-subtype-documentation.mjs";
import { readPromotionInventory, stagePromotionInventory } from "../tests/helpers/type-surface-promotion-io.mjs";
import { commitPromotionFiles, promotionFileIdentity } from "../tests/helpers/promotion-file-transaction.mjs";

assert.ok(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === "--check")
	, "Use no arguments to promote, or --check to preflight without changing files");
const checkOnly = process.argv[2] === "--check";
const root = process.cwd();
const git = arguments_ => execFileSync("git", arguments_, { encoding: "utf8", maxBuffer: 1024 * 1024 });
const head = git(["rev-parse", "HEAD"]).trim();
const clean = () => {
	assert.equal(git(["rev-parse", "HEAD"]).trim(), head, "Promotion HEAD changed");
	assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), ""
		, "Owned Subtype promotion requires a clean committed checkout");
};
clean();
const path = "docs/type-surface.v1.json";
const [irSchema, consumers] = await Promise.all([
	readFile("schema/binding-ir.schema.json", "utf8").then(JSON.parse)
	, readFile("docs/consumer-support.v1.json", "utf8").then(JSON.parse)
]);
const original = await readPromotionInventory(createReadStream(path), { irSchema, consumers });
const sources = {};
for(const [name, documentPath] of Object.entries(ownedSubtypeDocumentationPaths))
	sources[name] = await readFile(documentPath, "utf8");
renderOwnedSubtypeDocumentation(sources);
assert.equal(await promotionFileIdentity(ownedSubtypePromotionPath), null, "Owned Subtype promotion already published");
const references = await ownedSubtypePromotionReferences();
const promoted = promoteOwnedSubtypes(original.document, references);
const generated = await renderReferenceDocuments({ root, inventory: { document: promoted, irSchema, consumers } });
const documentation = renderOwnedSubtypeDocumentation(Object.fromEntries(
	Object.entries(ownedSubtypeDocumentationPaths).map(([name, documentPath]) =>
		[name, generated[documentPath] ?? sources[name]])
));
const documents = { ...generated
	, ...Object.fromEntries(Object.entries(ownedSubtypeDocumentationPaths)
		.map(([name, documentPath]) => [documentPath, documentation[name]]))
	, [ownedSubtypePromotionPath]: renderOwnedSubtypePromotion(references) };
clean();
await mkdir(join(root, "build"), { recursive: true });
const staging = await mkdtemp(join(root, "build/owned-subtype-promotion-"));
let installing = false, completed = false;
try
{
	const staged = join(staging, "inventory.json");
	const next = await stagePromotionInventory(path, staged, original, promoted);
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
	process.stdout.write(JSON.stringify({ mode: checkOnly ? "check" : "promote"
		, cells: 32
		, observations: promoted.observations.filter((item, number) =>
			item !== original.document.observations[number]).length
		, inventory: next
		, files: files.map(file => file.path), head }, null, 2) + "\n");
}
finally
{
	if(!installing || completed) await rm(staging, { recursive: true });
	else process.stderr.write(`Owned Subtype promotion recovery files retained: ${staging}\n`);
}
