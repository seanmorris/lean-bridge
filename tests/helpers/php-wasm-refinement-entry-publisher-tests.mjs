/**
 * Check the real publisher's refusal boundary and conditional documentation.
 * Synthetic rendering references do not establish hosted archive acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	phpWasmRefinementEntryBoundary, phpWasmRefinementEntryReference
} from "../../scripts/generate-type-docs.mjs";
import { renderReferenceDocuments } from "../../scripts/generate-reference-docs.mjs";
import { phpWasmEntryProbeEvidenceId } from "./php-wasm-refinement-entry-publication.mjs";
import { renderPhpWasmEntryProbeBoundary } from "./php-wasm-refinement-entry-publication-docs.mjs";
import { readPromotionInventory } from "./type-surface-promotion-io.mjs";

const evidence = () => ({
	id: phpWasmEntryProbeEvidenceId, kind: "test", revision: "a".repeat(40)
	, files: [{ path: "docs/evidence/php-wasm-entry-hosted-20261025/index.json", sha256: "b".repeat(64) }]
});
const document = () => ({ evidence: [evidence()], observations: [] });

test("PHP-Wasm publisher rendering preserves pending text until probe evidence exists", () => {
	assert.equal(phpWasmRefinementEntryReference({ evidence: [], observations: [] }), phpWasmRefinementEntryBoundary);
	assert.equal(phpWasmRefinementEntryReference(document()), renderPhpWasmEntryProbeBoundary(evidence()));
	assert.match(phpWasmRefinementEntryReference(document()), /unmodified prepared packages/u);
});

test("PHP-Wasm publisher rendering rejects ambiguous references and support-stage use", () => {
	for(const change of [
		value => { value.evidence.push(evidence()); }
		, value => { value.evidence[0].kind = "installed"; }
		, value => { value.evidence[0].revision = "latest"; }
		, value => { value.evidence[0].files = []; }
		, value => { value.evidence[0].files[0].path = "docs/evidence/diagnostic/index.json"; }
		, value => { value.observations = [{ stages: { execution: { evidence: [phpWasmEntryProbeEvidenceId] } } }]; }
	]) {
		const value = document(); change(value);
		assert.throws(() => phpWasmRefinementEntryReference(value));
	}
});

test("PHP-Wasm publisher generator changes only the probe paragraph in a synthetic projection", async () => {
	const irSchema = JSON.parse(await readFile("schema/binding-ir.schema.json", "utf8"));
	const consumers = JSON.parse(await readFile("docs/consumer-support.v1.json", "utf8"));
	const original = await readPromotionInventory(createReadStream("docs/type-surface.v1.json"), { irSchema, consumers });
	const pending = { ...original.document, evidence: original.document.evidence
		.filter(item => item.id !== phpWasmEntryProbeEvidenceId) };
	const reference = { ...evidence(), command: "Synthetic rendering only"
		, scope: "No hosted acceptance", artifacts: [] };
	const published = { ...pending, evidence: [...pending.evidence, reference] };
	const baseline = await renderReferenceDocuments({ root: process.cwd()
		, inventory: { document: pending, irSchema, consumers } });
	const rendered = await renderReferenceDocuments({ root: process.cwd()
		, inventory: { document: published, irSchema, consumers } });
	assert.deepEqual(Object.keys(rendered), Object.keys(baseline));
	assert.ok(Object.hasOwn(rendered, "docs/reference/types.md"));
	for(const [path, source] of Object.entries(baseline))
	{
		const expected = path === "docs/reference/types.md"
			? source.replace(phpWasmRefinementEntryBoundary, renderPhpWasmEntryProbeBoundary(evidence())) : source;
		assert.equal(rendered[path], expected, path);
		if(!original.document.evidence.some(item => item.id === phpWasmEntryProbeEvidenceId))
			assert.equal(source, await readFile(path, "utf8"), path);
	}
});

const cli = resolve("scripts/publish-php-wasm-refinement-entry-probes.mjs");
const run = (cwd, args) => spawnSync(process.execPath, ["--max-old-space-size=512", cli, ...args]
	, { cwd, encoding: "utf8", timeout: 10_000, maxBuffer: 256 * 1024 });
const selection = ["--archive", "docs/evidence/php-wasm-entry-hosted-20261025"
	, "--producer-checkout", "/tmp/exact-producer-required"];

test("PHP-Wasm publisher rejects malformed arguments without staging or publication", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-php-entry-publisher-args-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const invalid = [[], ["--check"], [...selection, "--skip-replay"]
		, ["--archive", "/tmp/archive", ...selection.slice(2)]
		, [...selection.slice(0, 2), "--producer-checkout", "relative"]
		, ["--archive", selection[1], "--archive", selection[1]]
		, [...selection, "--check", "--check"]
		, [...selection.slice(0, 2), "--producer-checkout", "/tmp/../other"]];
	for(const args of invalid)
	{
		const result = run(directory, args);
		assert.equal(result.status, 1, result.stderr); assert.equal(result.signal, null);
		assert.match(result.stderr, /Usage:/u);
		assert.deepEqual(await readdir(directory), []);
	}
});

test("PHP-Wasm publisher requires its own checkout even in check mode", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-php-entry-publisher-checkout-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	for(const args of [selection, [...selection, "--check"], ["--check", ...selection]])
	{
		const result = run(directory, args);
		assert.equal(result.status, 1, result.stderr); assert.equal(result.signal, null);
		assert.match(result.stderr, /must run in its own checkout/u);
		assert.deepEqual(await readdir(directory), []);
	}
});
