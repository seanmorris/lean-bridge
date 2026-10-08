/**
 * Authenticate the two original PHP-Wasm Fin routes before promoting their observed positions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { phpWasmFinCaller, phpWasmFinFixtures } from "./php-wasm-fin-fixtures.mjs";
import { assertPhpWasmFinObservation } from "./php-wasm-fin-observation.mjs";
import { assertReviewedPhpWasmFinExecution, assertReviewedPhpWasmFinReport } from "./reviewed-php-wasm-fin-evidence.mjs";

export const phpWasmFinPromotionReceipts = [
	{ path: "docs/evidence/php-wasm-fin-20261008/receipt.json"
		, sha256: "512b62e522fc8e71ab814f2e073cbd7ee33ed24396fb04d13eb3bb280de15734"
		, revision: "c391e58a1fcfa9a3c137f1ca4b4fb8a49fc77dda"
		, sourcePath: "ordinary-source" }
	, { path: "docs/evidence/reviewed-php-wasm-fin-20261008/receipt.json"
		, sha256: "267b96187f7264a76f294aa737e50a8185780723dc9d6422ae51d96261dc3663"
		, revision: "8d395a3e49e189b174d9b8359c3247f77215b663"
		, sourcePath: "reviewed-ir" }
];
export const phpWasmFinPromotionEnvironment = "Local Node 22.23.3 and Chromium 154.0.8037.57 execute PHP 8.4.1 on wasm32; the runtime pins Emscripten 3.1.68 and php-wasm 0.1.0. Each fixture runs eight Node arrangements (embedded/Composer, startup/lazy, weak/strict) and four Chromium bundled arrangements (startup/lazy, weak/strict). No Firefox, WebKit or browser Composer execution is claimed.";
export const phpWasmFinPromotionNestedOnly = "Only Fin nested in products, Except branches or copied fields is exercised; no bare top-level Fin or direct Array/List/Option (Fin n) export is executed.";
export const phpWasmFinPromotionLimit = `${phpWasmFinPromotionNestedOnly} Source and adapter dispatch are not measured. These local reports do not establish hosted CI, native PHP, a native glibc floor, checked Subtype, callback replies, generic/recursive refined fields, or graph/owned refinement transports. Selected producer source identities are not a complete dependency closure. Package archive hashes are retained, not the binary archives.`;
export const phpWasmFinPromotionConversion = `${phpWasmFinPromotionNestedOnly} Use Brick Math integers with exact closed bounds. Products, active Except branches and copied record/variant fields keep their constraints through the tested containers; none is valid for Option (Fin 0), but present Fin 0 values reject. Both weak and strict PHP callers preserve inputs and recover after rejection.`;

/**
 * State the exact environment and limitations of one original execution.
 *
 * @param reference - One authenticated installed fixture selection.
 */
export const phpWasmFinPromotionScope = reference => `${reference.scope} ${phpWasmFinPromotionEnvironment} ${phpWasmFinPromotionLimit} Commands select the current reproduction tests; configure the local PHP-Wasm toolchain separately. The original reports identify the producer revision that actually ran.`;

/**
 * Keep every stage note identical in the inventory writer and its verifier.
 *
 * @param reference - One authenticated installed fixture selection.
 */
export const phpWasmFinPromotionNotes = reference => ({
	analysis: reference.sourcePath === "reviewed-ir"
		? "Independently reviewed bounds reconcile with fresh Lean metadata."
		: "Fresh Lean metadata retains the exact closed bounds."
	, generation: "Plain copied PHP-Wasm preserves Fin bounds in products, active result branches, copied fields and their tested container combinations."
	, compilation: "The wasm32 adapter checks Nat limbs and constructs Fin with a decidable Lean proof."
	, packaging: `Two author roots reproduce three package archives before source-free offline installation. ${phpWasmFinPromotionEnvironment}`
	, installedExecution: `${reference.scope} ${phpWasmFinPromotionLimit}`
});
export const phpWasmFinPromotionValidators = [
	"tests/helpers/php-wasm-fin-promotion-references.mjs"
	, "tests/helpers/php-wasm-fin-observation.mjs"
	, "tests/helpers/php-wasm-fin-fixtures.mjs"
	, "tests/helpers/type-corpus-php-wasm-evidence.mjs"
	, "tests/helpers/reviewed-php-wasm-fin-evidence.mjs"
];

/**
 * Authenticate both original producers and their complete product and record selections.
 * Absolute paths in their reports are provenance only; read only repository-relative files.
 *
 * @param read - File reader, replaceable to test corruption of the archived originals.
 */
export const phpWasmFinPromotionReferences = async (read = readFile) => {
	const references = [];
	const original = async file => {
		const bytes = await read(file.path);
		assert.equal(sha256(bytes), file.sha256, file.path);
		if(file.bytes !== undefined) assert.equal(bytes.length, file.bytes, file.path);
		return bytes;
	};
	for(const expected of phpWasmFinPromotionReceipts)
	{
		const receipt = JSON.parse(await original(expected)), reviewed = expected.sourcePath === "reviewed-ir";
		assert.equal(receipt.revision, expected.revision); assert.equal(receipt.execution, "local");
		assert.equal(receipt.scope.profile, "php-wasm"); assert.equal(receipt.scope.dispatch, "not measured");
		assert.equal(receipt.scope.sourcePath, reviewed ? "reviewed-source" : "ordinary-source");
		assert.equal(receipt.scope.reviewedContracts, reviewed); assert.equal(receipt.scope.subtype, false);
		assert.deepEqual(receipt.scope.fixtures, [
			{ name: "products", exports: 11, executions: 12, checksPerExecution: 2039 }
			, { name: "records", exports: 13, executions: 12, checksPerExecution: 2053 }
		]);
		const files = reviewed ? receipt.artifacts : [receipt.report, receipt.log, receipt.queue];
		const bytes = new Map();
		for(const file of files) bytes.set(file.path, await original(file));
		const sources = new Map();
		for(const file of receipt.sourceFiles)
		{
			const text = file.archivePath ? bytes.get(file.archivePath)?.toString()
				: beforeFinRefinementSource(file.path, (await read(file.path)).toString(), file.sha256);
			assert.equal(typeof text, "string"); assert.equal(sha256(text), file.sha256, file.path);
			sources.set(file.path, text);
		}
		const readSource = async path => { assert.ok(sources.has(path), path); return sources.get(path); };
		const reportFile = reviewed ? files.find(file => file.path.endsWith("/reviewed.json")) : receipt.report;
		const archive = JSON.parse(bytes.get(reportFile.path));
		assert.deepEqual(archive.reports.map(report => report.fixture), ["products", "records"]);
		if(reviewed)
		{
			await assertReviewedPhpWasmFinReport(archive, receipt, readSource);
			const text = name => bytes.get(files.find(file => file.path.endsWith("/" + name)).path).toString();
			assertReviewedPhpWasmFinExecution(text("original.tap"), text("original.queue"));
		}
		else
		{
			const tap = bytes.get(receipt.log.path).toString(), queue = bytes.get(receipt.queue.path).toString();
			for(const [key, count] of Object.entries({ tests: 9, pass: 9, fail: 0, skipped: 0 }))
				assert.deepEqual([...tap.matchAll(new RegExp(`^# ${key} (.+)$`, "gmu"))].map(match => match[1]), [String(count)]);
			assert.match(tap, /^exit=0$/mu); assert.doesNotMatch(tap, /^not ok /mu);
			assert.match(queue, /php-wasm-fin exit=0 # pass 9 # fail 0 # skipped 0/u);
		}
		assert.equal(receipt.producerEnvironment.nodeVersion, "v22.23.3");
		assert.equal(receipt.producerEnvironment.browserVersion, "154.0.8037.57");
		for(const report of archive.reports)
		{
			const fixture = phpWasmFinFixtures[report.fixture], checks = report.fixture === "products" ? 2039 : 2053;
			const { request } = await phpWasmFinCaller(fixture);
			assertPhpWasmFinObservation(report, fixture, await readSource(fixture.consumer), request, checks, reviewed);
			assert.deepEqual(report.phpWasm.runtime.pins, receipt.producerEnvironment.pins);
			assert.equal(report.phpWasm.nodeVersion, receipt.producerEnvironment.nodeVersion);
			assert.equal(report.phpWasm.browserVersion, receipt.producerEnvironment.browserVersion);
			const module = report.phpWasm.component.sourceIdentity.modules.find(item => item.module === fixture.module);
			assert.equal(module.source.sha256, sha256(await readSource(`${fixture.root}/${fixture.module}.lean`)));
			references.push({ id: `php-wasm-fin-${report.fixture}-${reviewed ? "reviewed" : "ordinary"}-installed`
				, sourcePath: expected.sourcePath, revision: expected.revision
				, fixture: report.fixture, checks
				, positions: report.fixture === "products" ? ["parameter", "result"] : ["field"]
				, scope: `${reviewed ? "Independently reviewed" : "Ordinary-source"} ${report.fixture}: ${Object.keys(report.refinements).length} exports, twelve installed executions with ${checks} checks each, two-root package reproduction and source-free offline installation.`
				, command: reviewed
					? "LEAN_BRIDGE_PHP_WASM_REVIEWED_FIN_LEAN_TEST=1 LEAN_BRIDGE_PHP_WASM_REVIEWED_FIN_TEST=1 node --test --test-concurrency=1 --test-name-pattern='independent Fin reviews|independently reviewed PHP-Wasm' tests/php-wasm-fin.test.mjs"
					: "LEAN_BRIDGE_PHP_WASM_FIN_TEST=1 node --test --test-concurrency=1 tests/php-wasm-fin.test.mjs"
				, files: [{ path: expected.path, sha256: expected.sha256 }, ...files]
				, artifacts: Object.entries(report.archives).map(([path, sha256]) => ({ path, sha256 })) });
		}
	}
	return references;
};
