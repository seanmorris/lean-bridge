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
import { renderReferenceDocuments } from "./generate-reference-docs.mjs";
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
	readPromotionInventory, stagePromotionInventory
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
const promoted = promoteOptionalParameterComplete(
	original.document, { irSchema, consumers }, reference);
const generated = await renderReferenceDocuments({
	root, inventory: { document: promoted, irSchema, consumers }
});
const documentationEntries = Object.entries(
	optionalParameterCompleteDocumentationPaths).map(([name, documentPath]) => [
	name, generated[documentPath] ?? sources[name]
]);
const documentation = renderOptionalParameterCompleteDocumentation(
	Object.fromEntries(documentationEntries));
const documents = {
	...generated
	, ...Object.fromEntries(Object.entries(
		optionalParameterCompleteDocumentationPaths)
		.map(([name, documentPath]) => [documentPath, documentation[name]]))
};

clean();
await mkdir(join(root, "build"), { recursive: true });
const staging = await mkdtemp(join(root
	, "build/optional-parameter-complete-promotion-"));
let installing = false, completed = false;
try
{
	const staged = join(staging, "inventory.json");
	const next = await stagePromotionInventory(
		path, staged, original, promoted);
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
		, inventory: next, files: files.map(file => file.path), head
	}, null, 2) + "\n");
}
finally
{
	if(!installing || completed) await rm(staging, { recursive: true });
	else process.stderr.write(
		`Optional-parameter promotion recovery files retained: ${staging}\n`);
}
