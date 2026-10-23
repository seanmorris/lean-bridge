/**
 * Exact support-inventory controls for hosted PHP-Wasm callback refinements.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	typeSurfaceCells, validateTypeSurface
} from "../../src/adoption/type-surface.mjs";
import {
	assertCallbackRefinementsPhpWasmPromotionReference
	, callbackRefinementsPhpWasmEvidenceId
	, callbackRefinementsPhpWasmPromotionParent
	, callbackRefinementsPhpWasmPromotionReference
	, promoteCallbackRefinementsPhpWasm
	, renderCallbackRefinementsPhpWasmPromotion
} from "./callback-refinements-php-wasm-promotion.mjs";

const load = path => readFile(path, "utf8").then(JSON.parse);
const baseline = () => JSON.parse(execFileSync("git", ["show"
	, `${callbackRefinementsPhpWasmPromotionParent}:docs/type-surface.v1.json`]
, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 }));
const archive = "docs/evidence/callback-refinements-php-wasm-20261023";
const validators = [
	"scripts/promote-callback-refinements-php-wasm-evidence.mjs"
	, "tests/callback-refinements-php-wasm.test.mjs"
	, "tests/helpers/callback-refinements-php-wasm-hosted-evidence.mjs"
	, "tests/helpers/callback-refinements-php-wasm-promotion-tests.mjs"
	, "tests/helpers/callback-refinements-php-wasm-promotion.mjs"
];
const syntheticReference = () => ({
	id: callbackRefinementsPhpWasmEvidenceId, kind: "installed"
	, revision: "387f1c1897230beb09c05f7eda17faf70a64b415"
	, hostedRun: 39870952379, job: 120144963711, artifact: 12467650836
	, command: "node --test tests/helpers/callback-refinements-php-wasm-hosted-evidence-tests.mjs"
	, scope: "Synthetic exact control. Hosted acceptance covers the fixture's closed Fin bounds and copied Interval and Weighted records in synchronous callbacks on wasm32 PHP 8.4.1. Retained or asynchronous callbacks, owned callback values, open dependent refinements, recursive refined callbacks, arbitrary predicates, dispatch cost and peak memory remain separate work. External Lean, PHP, Composer, Chromium, Nix, Emscripten and operating-system distributions remain trusted recorded inputs."
	, files: [
		{ path: `${archive}/index.json`
			, sha256: "297895d119c12fd4dde45763fc18271774a62a6de1130de070528145f7a11208" }
		, ...Array.from({ length: 2348 }, (_, index) => ({
			path: `${archive}/synthetic/${String(index).padStart(4, "0")}`
			, sha256: "a".repeat(64)
		}))
		, ...validators.map(path => ({ path, sha256: "b".repeat(64) }))
	]
});

test("PHP-Wasm callback refinement promotion derives the retained archive closure", async () => {
	const reference = await callbackRefinementsPhpWasmPromotionReference();
	assert.equal(assertCallbackRefinementsPhpWasmPromotionReference(reference)
		, reference);
	assert.ok(reference.files.some(file => file.path.endsWith(
		"/hosted/output/records/fin/ordinary/report.json")));
	assert.ok(reference.files.some(file => file.path.endsWith(
		"/hosted/output/records/checked-record/reviewed/report.json")));
});

test("PHP-Wasm callback refinement promotion splits resources and closes eight cells", async () => {
	const [surface, irSchema, consumers] = await Promise.all([
		baseline(), load("schema/binding-ir.schema.json")
		, load("docs/consumer-support.v1.json")
	]);
	const contracts = { irSchema, consumers };
	const reference = syntheticReference();
	const promoted = promoteCallbackRefinementsPhpWasm(surface, reference);
	assert.equal(promoted.evidence.length, surface.evidence.length + 1);
	assert.equal(promoted.observations.length, surface.observations.length + 4);
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const resource = promoted.observations.find(item =>
			item.id === `php-wasm-owned-callback-results-${path}`);
		assert.deepEqual(resource.shapes, ["resource"]);
		assert.deepEqual(Object.keys(resource.hostTypes), ["resource"]);
		assert.ok(Object.values(resource.stages).every(stage =>
			!stage.evidence.some(id => id.startsWith(
				"owned-checked-record-php-wasm-"))));
	}
	for(const shape of ["fin", "checked-record"])
		for(const route of ["ordinary", "reviewed"])
		{
			const item = promoted.observations.find(observation =>
				observation.id === `callback-${shape}-php-wasm-${route}`);
			assert.ok(item);
			assert.deepEqual(item.profiles, ["php-wasm"]);
			assert.deepEqual(item.shapes, [shape]);
			assert.deepEqual(item.positions
				, ["callback-parameter", "callback-result"]);
			assert.equal(item.path, route === "ordinary"
				? "ordinary-source" : "reviewed-ir");
			assert.ok(Object.values(item.stages).every(stage =>
				stage.state === "passed"
				&& stage.evidence.includes(reference.id)));
			if(shape === "checked-record")
				assert.ok(Object.values(item.stages).every(stage =>
					stage.evidence.some(id => id.startsWith(
						"owned-checked-record-php-wasm-"))));
		}
	assert.equal(validateTypeSurface(promoted, contracts), true);
	const before = new Map(typeSurfaceCells(surface, contracts)
		.map(cell => [cell.id, cell]));
	const changed = typeSurfaceCells(promoted, contracts).filter(cell =>
		JSON.stringify(cell) !== JSON.stringify(before.get(cell.id)));
	assert.deepEqual(changed.map(cell => cell.id).sort(), [
		"php-wasm/checked-record/ordinary-source/callback-parameter"
		, "php-wasm/checked-record/ordinary-source/callback-result"
		, "php-wasm/checked-record/reviewed-ir/callback-parameter"
		, "php-wasm/checked-record/reviewed-ir/callback-result"
		, "php-wasm/fin/ordinary-source/callback-parameter"
		, "php-wasm/fin/ordinary-source/callback-result"
		, "php-wasm/fin/reviewed-ir/callback-parameter"
		, "php-wasm/fin/reviewed-ir/callback-result"
		, "php-wasm/resource/ordinary-source/callback-parameter"
		, "php-wasm/resource/ordinary-source/callback-result"
		, "php-wasm/resource/reviewed-ir/callback-parameter"
		, "php-wasm/resource/reviewed-ir/callback-result"
	]);
	assert.throws(() => promoteCallbackRefinementsPhpWasm(promoted, reference)
		, /Already promoted/u);
});

test("PHP-Wasm callback refinement promotion refuses forged references", () => {
	const reference = syntheticReference();
	assert.equal(assertCallbackRefinementsPhpWasmPromotionReference(reference)
		, reference);
	for(const mutate of [
		value => { value.id = "other"; }
		, value => { value.revision = "0".repeat(40); }
		, value => { value.hostedRun++; }
		, value => { value.job++; }
		, value => { value.artifact++; }
		, value => { value.command = "true"; }
		, value => { value.scope = "too broad"; }
		, value => { value.files[0].sha256 = "0".repeat(64); }
		, value => { value.files.pop(); }
		, value => { value.files[value.files.length - 1].path = "wrong"; }
		, value => { value.files[1] = value.files[2]; }
	]) {
		const changed = structuredClone(reference); mutate(changed);
		assert.throws(() =>
			assertCallbackRefinementsPhpWasmPromotionReference(changed));
	}
});

test("PHP-Wasm callback refinement promotion renders its exact boundary", () => {
	const markdown = renderCallbackRefinementsPhpWasmPromotion(
		syntheticReference());
	for(const value of ["39870952379", "120144963711", "12467650836"
		, "Fin | ordinary source", "Checked record | reviewed IR"
		, "promotes eight exact cells", "Retained or asynchronous callbacks"])
		assert.ok(markdown.includes(value), value);
});

test("PHP-Wasm callback refinement promotion refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-callback-refinement-promotion-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/promote-callback-refinements-php-wasm-evidence.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /draft-only at its exact parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
	assert.match(callbackRefinementsPhpWasmPromotionParent, /^[a-f0-9]{40}$/u);
});
