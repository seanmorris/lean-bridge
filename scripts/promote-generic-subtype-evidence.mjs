#!/usr/bin/env node
/**
 * Promote only the generic-Subtype cells closed by hosted evidence.
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
	genericSubtypePromotionPath, genericSubtypePromotionReferences
	, promoteGenericSubtypes, renderGenericSubtypePromotion
} from "../tests/helpers/generic-subtype-promotion.mjs";
import {
	genericSubtypeDocumentationPaths, renderGenericSubtypeDocumentation
} from "../tests/helpers/generic-subtype-documentation.mjs";
import { checkGenericSubtypeHostedEvidence }
	from "../tests/helpers/generic-subtype-hosted-evidence.mjs";
import { readPromotionInventory, stagePromotionInventory }
	from "../tests/helpers/type-surface-promotion-io.mjs";
import { commitPromotionFiles, promotionFileIdentity }
	from "../tests/helpers/promotion-file-transaction.mjs";

assert.ok(process.argv.length === 2
	|| (process.argv.length === 3 && process.argv[2] === "--check")
, "Use no arguments to promote, or --check to preflight without changing files");
const checkOnly = process.argv[2] === "--check";
const root = process.cwd();
const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 1024 * 1024 });
const head = git(["rev-parse", "HEAD"]).trim();
const clean = () => {
	assert.equal(git(["rev-parse", "HEAD"]).trim(), head, "Promotion HEAD changed");
	git(["diff", "--quiet", "HEAD", "--"]);
};
clean();
const path = "docs/type-surface.v1.json";
const [irSchema, consumers] = await Promise.all([
	readFile("schema/binding-ir.schema.json", "utf8").then(JSON.parse)
	, readFile("docs/consumer-support.v1.json", "utf8").then(JSON.parse)
]);
const original = await readPromotionInventory(createReadStream(path)
	, { irSchema, consumers });
const documentationSources = Object.fromEntries(await Promise.all(
	Object.entries(genericSubtypeDocumentationPaths).map(
		async ([name, documentPath]) => [
			name, await readFile(documentPath, "utf8")
		]
	)
));
// Check manual markers before the expensive complete archive replay.
renderGenericSubtypeDocumentation(documentationSources);
assert.equal(await promotionFileIdentity(genericSubtypePromotionPath), null
	, "Promotion receipt already exists");
const references = await genericSubtypePromotionReferences(async (lane, evidenceRoot) => {
	process.stderr.write(`Replaying complete generic-Subtype archive: ${lane}\n`);
	return checkGenericSubtypeHostedEvidence(lane, evidenceRoot);
});
const promoted = promoteGenericSubtypes(original.document, references);
const generated = await renderReferenceDocuments({
	root, inventory: { document: promoted, irSchema, consumers }
});
// Apply manual edits to the newly generated tables, never to stale source copies.
const documentation = renderGenericSubtypeDocumentation(Object.fromEntries(
	Object.entries(genericSubtypeDocumentationPaths).map(([name, documentPath]) =>
		[name, generated[documentPath] ?? documentationSources[name]])
));
const documents = { ...generated
	, ...Object.fromEntries(Object.entries(genericSubtypeDocumentationPaths)
		.map(([name, documentPath]) => [documentPath, documentation[name]]))
	, [genericSubtypePromotionPath]: renderGenericSubtypePromotion(references) };
await mkdir(join(root, "build"), { recursive: true });
const staging = await mkdtemp(join(root, "build/generic-subtype-promotion-"));
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
		, cells: 32, archives: references.length, inventory: next
		, files: files.map(file => file.path), head }, null, 2) + "\n");
}
finally
{
	if(!installing || completed) await rm(staging, { recursive: true });
	else process.stderr.write(`Promotion recovery files retained: ${staging}\n`);
}
