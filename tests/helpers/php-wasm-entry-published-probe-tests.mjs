/**
 * Check the live probe reference, its retained identities and public links.
 * Full original-source replay remains a separate archive acceptance gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { renderReferenceDocuments } from "../../scripts/generate-reference-docs.mjs";
import { checkPhpWasmEntryHostedArchiveIndex } from "./php-wasm-refinement-entry-hosted-archive.mjs";
import {
	appendPhpWasmEntryProbe, phpWasmEntryProbeEvidenceId
} from "./php-wasm-refinement-entry-publication.mjs";
import {
	phpWasmEntryProbeDocumentationPaths, phpWasmEntryProbePreviousDocumentation
	, renderPhpWasmEntryProbeBoundary
} from "./php-wasm-refinement-entry-publication-docs.mjs";
import { readPromotionInventory } from "./type-surface-promotion-io.mjs";

let loaded;
const current = () => loaded ??= (async () => {
	const contracts = {
		irSchema: JSON.parse(await readFile("schema/binding-ir.schema.json", "utf8"))
		, consumers: JSON.parse(await readFile("docs/consumer-support.v1.json", "utf8"))
	};
	const { document } = await readPromotionInventory(createReadStream("docs/type-surface.v1.json")
		, contracts, { retainEvidence: [phpWasmEntryProbeEvidenceId] });
	const matches = document.evidence.filter(entry => entry.id === phpWasmEntryProbeEvidenceId);
	assert.equal(matches.length, 1);
	const evidence = matches[0], root = dirname(evidence.files[0].path);
	const bytes = await readFile(evidence.files[0].path), index = JSON.parse(bytes);
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(sha256(bytes), evidence.files[0].sha256);
	checkPhpWasmEntryHostedArchiveIndex(index);
	return { document, contracts, evidence, root, index };
})();

test("PHP-Wasm published probes bind all 28 original artifact slots without widening support", async () => {
	const { document, evidence, root, index } = await current();
	assert.equal(evidence.revision, index.producerCommit);
	assert.equal(evidence.kind, "test");
	assert.match(evidence.scope, /30 ordinary\/reviewed routes in 27 retained producer artifacts plus the aggregate verifier artifact/u);
	assert.match(evidence.scope, /does not change prepared-package support states/u);
	assert.deepEqual(appendPhpWasmEntryProbe({ ...document
		, evidence: document.evidence.filter(entry => entry.id !== evidence.id) }, evidence), document);
	const expected = [root + "/index.json", root + "/api/run.json", root + "/replay.json"];
	const artifacts = [];
	assert.equal(index.artifacts.length, 28);
	for(const [number, item] of index.artifacts.entries())
	{
		const slot = String(number).padStart(4, "0");
		const path = root + "/" + item.directory + "/index.json";
		const bytes = await readFile(path), stored = JSON.parse(bytes);
		assert.equal(bytes.length, item.index.bytes);
		assert.equal(sha256(bytes), item.index.sha256);
		assert.equal(bytes.toString(), canonicalJson(stored));
		expected.push(path, root + `/api/jobs/${slot}.json`, root + `/api/artifacts/${slot}.json`);
		for(const part of stored.zip.parts)
		{
			const path = root + "/" + item.directory + "/" + part.path;
			expected.push(path); artifacts.push({ path, sha256: part.sha256 });
		}
	}
	for(const source of index.sources)
		for(const part of source.parts) expected.push(root + "/" + part.path);
	expected.push(
		"scripts/check-php-wasm-refinement-entry-hosted-archive.mjs"
		, "tests/helpers/php-wasm-refinement-entry-publication.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-archive.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-identities.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-replay.mjs"
		, "tests/helpers/php-wasm-refinement-entry-hosted-storage.mjs"
	);
	assert.deepEqual(evidence.files.map(file => file.path), expected);
	assert.deepEqual(evidence.artifacts, artifacts);
	for(const file of evidence.files)
		assert.equal(sha256(await readFile(file.path)), file.sha256, file.path);
});

test("PHP-Wasm published probe paragraphs and generated references match the live inventory", async () => {
	const { document, contracts, evidence } = await current();
	for(const [page, path] of Object.entries(phpWasmEntryProbeDocumentationPaths))
	{
		const source = await readFile(path, "utf8");
		assert.equal(source.split(renderPhpWasmEntryProbeBoundary(evidence, page)).length, 2, path);
		assert.ok(!source.includes(phpWasmEntryProbePreviousDocumentation[page]), path);
	}
	const generated = await renderReferenceDocuments({ root: process.cwd(), inventory: { document, ...contracts } });
	for(const [path, expected] of Object.entries(generated))
		assert.equal(sha256(await readFile(path)), sha256(expected), path);
});

test("PHP-Wasm published probe links resolve to committed revision-pinned evidence", async () => {
	const { evidence } = await current();
	const { rewriteDocumentationLink } = await import("../../scripts/generate-site-content.mjs");
	const { docPages } = await import("../../site/registry.mjs");
	const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	const path = evidence.files[0].path;
	assert.equal(execFileSync("git", ["ls-tree", "--name-only", revision, "--", path]
		, { encoding: "utf8" }).trim(), path);
	for(const [name, source] of Object.entries(phpWasmEntryProbeDocumentationPaths))
	{
		const page = docPages.find(page => page.source === source); assert.ok(page, source);
		const paragraph = renderPhpWasmEntryProbeBoundary(evidence, name);
		const link = /\[Hosted entry probes\]\(([^)]+)\)/u.exec(paragraph); assert.ok(link);
		assert.equal(rewriteDocumentationLink(link[1], page, { revision, trackedFiles: new Set([path]) })
			, `https://github.com/seanmorris/lean-bridge/blob/${revision}/${path}`);
		assert.throws(() => rewriteDocumentationLink(link[1], page, { revision, trackedFiles: new Set() })
			, /Untracked documentation link/u);
	}
});
