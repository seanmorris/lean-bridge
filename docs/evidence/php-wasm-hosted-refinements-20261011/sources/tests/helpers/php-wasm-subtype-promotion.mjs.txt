/**
 * Promote only the installed ordinary/reviewed PHP-Wasm Subtype parameter and result cells.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertPhpWasmSubtypeArchive, phpWasmSubtypeArchiveRoot, phpWasmSubtypeProducer } from "./php-wasm-subtype-archive.mjs";

export const phpWasmSubtypePromotionDigest = "fcad1416ce70d9ee17c619b8333bc18997561d44af6e188bb80de17d839aff8b";
export const phpWasmSubtypePromotionEnvironment = "Local Node 22.23.2 and Chromium 152.0.7977.75 execute PHP 8.4.1 on wasm32, with php-wasm 0.1.0, Lean 4.32.2 and Emscripten 3.1.68. Each route runs eight Node embedded/Composer startup/lazy weak/strict configurations and four Chromium bundled startup/lazy weak/strict configurations.";
export const phpWasmSubtypePromotionLimit = "Constructor, adapter and source entry counts were not measured. These local observations do not establish hosted CI, native PHP, Firefox/WebKit, browser Composer, nested or nominal Subtype, refined callbacks, or graph/owned refinement transports. The archive retains selected producer sources and package digests, not a complete dependency closure or package binaries.";
export const phpWasmSubtypePromotionConversion = "Pass the primitive base value. Lean's selected checked constructor supplies the value passed to the export, including normalization; rejection throws LeanBridgeError code 1 naming the parameter and constructor. Results project the proof-backed base value. Weak and strict callers preserve inputs and recover after rejection. Only top-level primitive-base parameters and results are covered; constructor and dispatch counts were not measured.";
export const phpWasmSubtypePromotionValidators = [
	"tests/helpers/php-wasm-subtype-promotion.mjs"
	, "tests/helpers/php-wasm-subtype-promotion-tests.mjs"
	, "tests/helpers/php-wasm-subtype-archive.mjs"
	, "tests/helpers/php-wasm-subtype-report.mjs"
	, "tests/helpers/php-wasm-subtype-fixture.mjs"
	, "tests/helpers/php-wasm-fin-direct-report.mjs"
	, "tests/helpers/php-wasm-fin-observation.mjs"
	, "scripts/check-php-wasm-subtype-reports.mjs"
];

/**
 * Authenticate both original source routes before selecting observations.
 *
 * @param read - File reader replaceable for original-byte corruption controls.
 */
export const phpWasmSubtypePromotionReferences = async (read = readFile) => {
	const { index, files } = await assertPhpWasmSubtypeArchive(phpWasmSubtypePromotionDigest, read);
	const originals = [{ path: `${phpWasmSubtypeArchiveRoot}/index.json`, sha256: phpWasmSubtypePromotionDigest }
		, ...index.files.map(file => ({ path: `${phpWasmSubtypeArchiveRoot}/${file.path}`, sha256: file.sha256 }))];
	return ["ordinary", "reviewed"].map(route => {
		const report = JSON.parse(files.get(`${route}.json`)), sourcePath = route === "ordinary" ? "ordinary-source" : "reviewed-ir";
		return { id: `php-wasm-subtype-${route}-installed`, sourcePath
			, revision: phpWasmSubtypeProducer
			, scope: `${sourcePath}: twelve exports, twelve installed executions with 2024 checks each, two-root package reproduction and source-free offline installation. Cases include checked String/Nat/Int/ByteArray/UInt8 bases, mixed Fin/Subtype, two checked arguments, input preservation, rejection/recovery, normalization, two constructors for one generic and a zero-argument refined result. ${phpWasmSubtypePromotionEnvironment} ${phpWasmSubtypePromotionLimit}`
			, command: "LEAN_BRIDGE_PHP_WASM_SUBTYPE_TEST=1 node --test --test-concurrency=1 --test-name-pattern='^(ordinary|reviewed) installed PHP-Wasm Subtypes' tests/helpers/php-wasm-subtype-tests.mjs && node scripts/check-php-wasm-subtype-reports.mjs --directory build/php-wasm-subtype"
			, files: originals.map(file => ({ ...file }))
			, artifacts: Object.entries(report.archives).map(([path, sha256]) => ({ path, sha256 })) };
	});
};

/**
 * Append two exact observations and evidence entries without changing previous claims.
 *
 * @param original - Inventory before this promotion.
 * @param references - Both independently authenticated source routes.
 */
export const promotePhpWasmSubtype = async (original, references) => {
	assert.deepEqual(references, await phpWasmSubtypePromotionReferences());
	const inventory = structuredClone(original);
	const validators = await Promise.all(phpWasmSubtypePromotionValidators.map(async path => ({ path, sha256: sha256(await readFile(path)) })));
	for(const reference of references)
	{
		const id = reference.id.replace(/-installed$/u, "");
		assert.ok(!inventory.evidence.some(item => item.id === reference.id), "Already promoted: " + reference.id);
		assert.ok(!inventory.observations.some(item => item.id === id), "Already promoted: " + id);
		inventory.evidence.push({ id: reference.id, kind: "installed"
			, revision: reference.revision
			, scope: reference.scope, command: reference.command
			, files: [...validators, ...reference.files]
			, artifacts: reference.artifacts.map(file => ({ ...file, path: `${reference.id}/${file.path}` })) });
		const notes = {
			analysis: reference.sourcePath === "reviewed-ir" ? "Independently reviewed constructor and specialization decisions reconcile with fresh Lean metadata." : "Fresh Lean checks each configured constructor against the exact primitive base and subtype."
			, generation: "The plain copied wasm32 PHP model retains all twelve export decisions, including distinct checked constructors for two specializations of one generic."
			, compilation: "Lean compiles the typed validators and adapters; results project the subtype base value."
			, packaging: "Three package archives reproduce in two author roots before source removal and offline installation."
			, installedExecution: reference.scope
		};
		assert.deepEqual(Object.keys(notes), inventory.stages);
		inventory.observations.push({ id, profiles: ["php-wasm"], shapes: ["subtype"]
			, positions: ["parameter", "result"], path: reference.sourcePath
			, scope: reference.scope
			, limitations: [phpWasmSubtypePromotionLimit, phpWasmSubtypePromotionEnvironment]
			, hostTypes: { subtype: {
				parameter: "Brick\\Math\\BigInteger, string, Bytes or int, checked and constructed by the selected Lean constructor"
				, result: "the primitive base value projected from the proof-backed Lean result"
			} }
			, conversionNotes: { subtype: phpWasmSubtypePromotionConversion }
			, stages: Object.fromEntries(inventory.stages.map(name => [name, { state: "passed", evidence: [reference.id], note: notes[name] }])) });
	}
	return inventory;
};
