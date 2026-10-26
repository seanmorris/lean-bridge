#!/usr/bin/env node
/**
 * Promote retained nominal Subtype entry archives as test-only evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	nominalSubtypeEntryDocumentationPaths, nominalSubtypeEntryPromotionPath
	, nominalSubtypeEntryPromotionReferences, promoteNominalSubtypeEntryEvidence
	, renderNominalSubtypeEntryDocumentation, renderNominalSubtypeEntryPromotion
} from "../tests/helpers/nominal-subtype-entry-promotion.mjs";
import {
	readPromotionInventory, stagePromotionInventory
} from "../tests/helpers/type-surface-promotion-io.mjs";
import {
	commitPromotionFiles, promotionFileIdentity
} from "../tests/helpers/promotion-file-transaction.mjs";

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
const inventoryPath = "docs/type-surface.v1.json";
const [irSchema, consumers] = await Promise.all([
	readFile("schema/binding-ir.schema.json", "utf8").then(JSON.parse)
	, readFile("docs/consumer-support.v1.json", "utf8").then(JSON.parse)
]);
const original = await readPromotionInventory(createReadStream(inventoryPath)
	, { irSchema, consumers });
const sources = Object.fromEntries(await Promise.all(
	Object.entries(nominalSubtypeEntryDocumentationPaths).map(
		async ([name, path]) => [name, await readFile(path, "utf8")]
	)
));
renderNominalSubtypeEntryDocumentation(sources);
assert.equal(await promotionFileIdentity(nominalSubtypeEntryPromotionPath), null
	, "Promotion receipt already exists");
const references = await nominalSubtypeEntryPromotionReferences((lane, path) => {
	process.stderr.write(`Replaying complete nominal Subtype entry archive: ${lane}\n`);
	return import("../tests/helpers/nominal-subtype-entry-hosted-evidence.mjs")
		.then(module => module.checkNominalSubtypeEntryHostedEvidence(lane, path));
});
const promoted = promoteNominalSubtypeEntryEvidence(
	original.document, references);
const rendered = renderNominalSubtypeEntryDocumentation(sources);
const documents = Object.fromEntries(
	Object.entries(nominalSubtypeEntryDocumentationPaths).map(
		([name, path]) => [path, rendered[name]]
	)
);
documents[nominalSubtypeEntryPromotionPath]
	= renderNominalSubtypeEntryPromotion(references);
await mkdir(join(root, "build"), { recursive: true });
const staging = await mkdtemp(join(root, "build/nominal-entry-promotion-"));
let installing = false, completed = false;
try
{
	const stagedInventory = join(staging, "inventory.json");
	const next = await stagePromotionInventory(
		inventoryPath, stagedInventory, original, promoted);
	const files = [{ path: inventoryPath, staged: stagedInventory
		, previous: original.source, next }];
	for(const [number, [path, content]] of Object.entries(documents).entries())
	{
		const previous = await promotionFileIdentity(path);
		const staged = join(staging, `document-${number}.md`);
		await writeFile(staged, content, { flag: "wx" });
		const identity = await promotionFileIdentity(staged);
		if(previous?.sha256 === identity.sha256) continue;
		files.push({ path, staged, previous, next: identity });
	}
	clean();
	if(!checkOnly)
	{
		installing = true;
		await commitPromotionFiles({ root, staging, files });
	}
	completed = true;
	process.stdout.write(JSON.stringify({ mode: checkOnly ? "check" : "promote"
		, evidence: references.map(item => item.id), inventory: next
		, files: files.map(file => file.path), head }, null, 2) + "\n");
}
finally
{
	if(!installing || completed) await rm(staging, { recursive: true });
	else process.stderr.write(`Promotion recovery files retained: ${staging}\n`);
}
