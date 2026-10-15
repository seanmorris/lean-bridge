/**
 * Promote only the recursive checked-Subtype PHP-Wasm cells backed by the archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import {
	checkRecursiveSubtypePhpWasmEvidence
	, recursiveSubtypePhpWasmEvidence
	, recursiveSubtypePhpWasmEvidenceSha256
	, recursiveSubtypePhpWasmProducer
} from "./recursive-subtype-php-wasm-evidence.mjs";
import {
	nominalPrimitiveSubtypePhpWasmConversion
	, nominalPrimitiveSubtypePhpWasmField
	, nominalPrimitiveSubtypePhpWasmLimit
	, nominalPrimitiveSubtypePhpWasmParameter
	, nominalPrimitiveSubtypePhpWasmResult
} from "./nominal-primitive-subtype-php-wasm-promotion.mjs";
import {
	recursiveSubtypePhpWasmChangedPaths
	, recursiveSubtypePhpWasmHistoryPath
} from "./recursive-subtype-php-wasm-source-history.mjs";

export const recursiveSubtypePhpWasmProfiles = Object.freeze(["php-wasm"]);
export const recursiveSubtypePhpWasmParameter = `${nominalPrimitiveSubtypePhpWasmParameter}; generated recursive Chain values also check the selected constructor at every present value field and the Fin 3 bound at every digit field, including aliases and nested Array/Option carriers`;
export const recursiveSubtypePhpWasmResult = `${nominalPrimitiveSubtypePhpWasmResult}; generated recursive Chain values project constructor-free proof-backed payloads through aliases and nested Array/Option carriers`;
export const recursiveSubtypePhpWasmField = `${nominalPrimitiveSubtypePhpWasmField}; selected Subtype fields inside the active case of the tested recursive Chain variant are checked at every recursive level`;
export const recursiveSubtypePhpWasmConversion = `${nominalPrimitiveSubtypePhpWasmConversion} Recursive Chain values use generated variant classes. PHP-Wasm traverses only the active case, checks each present Subtype with the constructor selected for that parameter, checks each Fin 3 digit, preserves shared caller graphs on rejection, and rejects cycles or values deeper than 128 copied levels. Results omit proof fields and input constructor choices.`;
export const recursiveSubtypePhpWasmLimit = nominalPrimitiveSubtypePhpWasmLimit.replace(
	"Refined callbacks, owned, recursive, dependent, dispatch-counted and broader generic Subtypes remain separate work."
	, "The tested recursive variant, its transparent alias and nested Array/Option carriers admit selected checked Subtype constructors and Fin bounds. Refined callbacks, owned values, recursive checked records, dependent types, dispatch-counted execution and broader generic Subtypes remain separate work."
);
export const recursiveSubtypePhpWasmScope = "Fresh Lean builds from ordinary source and reviewed Binding IR reproduce complete Composer API, npm component and npm shared-runtime packages. After source removal, offline installation and relocation, each route passes twelve Node and Chromium startup/lazy, weak/strict arrangements with 24 checks per arrangement. The caller covers active recursive cases, two constructor choices for one Subtype field, Fin siblings, transparent aliases, nested Array/Option carriers, shared tails, exact indexed rejection sites, cycle and depth limits, caller preservation and recovery.";
const command = "source scripts/env.sh && LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME='build/recursive-subtype-php-wasm-input/php-wasm-runtime' bash scripts/run-recursive-subtype-php-wasm-ci.sh";
const validatorPaths = Object.freeze([
	"tests/helpers/recursive-subtype-php-wasm-evidence.mjs"
	, "tests/helpers/recursive-subtype-php-wasm-evidence-tests.mjs"
	, "tests/helpers/recursive-subtype-php-wasm-promotion.mjs"
	, "scripts/archive-recursive-subtype-php-wasm.mjs"
	, "scripts/promote-recursive-subtype-php-wasm.mjs"
	, "scripts/run-recursive-subtype-php-wasm-ci.sh"
	, ".github/workflows/recursive-subtype-php-wasm.yml"
]);

let defaultReferences;
/** Derive two inventory entries only after validating every archived byte. */
export const recursiveSubtypePhpWasmReferences = async () => {
	defaultReferences ??= (async () => {
		const checked = await checkRecursiveSubtypePhpWasmEvidence();
		const validators = [];
		for(const path of validatorPaths) validators.push({ path, sha256: sha256(await readFile(path)) });
		return checked.runs.map(run => {
			const id = `recursive-subtype-php-wasm-${run.route}-installed`;
			const evidenceFiles = checked.files.filter(file => file.path.startsWith(`${run.route}/`)
				|| file.path.startsWith("sources/"));
			return {
				id, route: run.route, sourcePath: run.sourcePath
				, profiles: [...recursiveSubtypePhpWasmProfiles]
				, revision: recursiveSubtypePhpWasmProducer, command
				, scope: recursiveSubtypePhpWasmScope
				, files: [...validators
				, {
					path: `${recursiveSubtypePhpWasmEvidence}/index.json`
					, sha256: recursiveSubtypePhpWasmEvidenceSha256
				}
				, ...evidenceFiles.map(file => ({
					path: `${recursiveSubtypePhpWasmEvidence}/${file.path}`
					, sha256: file.sha256
				}))]
				, artifacts: run.archives.map(archive => ({
					path: `${id}/${archive.path}`, sha256: archive.sha256
				}))
				, counts: {
					executions: run.report.phpWasm.executions.length
					, checks: run.report.observation.checks
					, php: run.report.observation.php
					, wordBits: run.report.observation.word_bits
					, loadCeiling: checked.index.loadCeiling
					, diskFloorBytes: checked.index.diskFloorBytes
				}
			};
		});
	})();
	return structuredClone(await defaultReferences);
};

/**
 * Refresh prior evidence pins through the committed implementation milestone.
 *
 * @param inventory - Inventory at the core implementation milestone.
 */
export const refreshRecursiveSubtypePhpWasmCorePins = async inventory => {
	const refreshed = structuredClone(inventory);
	const history = JSON.parse(await readFile(recursiveSubtypePhpWasmHistoryPath, "utf8"));
	assert.deepEqual(history.updates.map(update => update.path),
		recursiveSubtypePhpWasmChangedPaths);
	for(const entry of refreshed.evidence) for(const file of entry.files)
	{
		const update = history.updates.find(item => item.path === file.path);
		if(update && file.sha256 === update.previousSha256) file.sha256 = update.currentSha256;
	}
	const npmReportPath = "tests/helpers/nominal-subtype-npm-report.mjs";
	const staleNpmReport = "da7a00f779dcd0d29dfc495207ccbd45cb27f258d568bff9249d7862583c81e0";
	const currentNpmReport = "3d6a98dda205c75154385b70e20b52408d58caf9797d8922a829fedf4be1318d";
	assert.equal(sha256(await readFile(npmReportPath)), currentNpmReport);
	let npmReportPins = 0;
	let currentNpmReportPins = 0;
	for(const entry of refreshed.evidence) for(const file of entry.files)
		if(file.path === npmReportPath && file.sha256 === staleNpmReport)
		{
			file.sha256 = currentNpmReport; npmReportPins++;
		}
		else if(file.path === npmReportPath && file.sha256 === currentNpmReport)
			currentNpmReportPins++;
	assert.ok(npmReportPins === 4 && currentNpmReportPins === 0
		|| npmReportPins === 0 && currentNpmReportPins === 4,
	"Expected the four stale npm nominal-Subtype report pins introduced before entry-probe wiring");
	return refreshed;
};

/**
 * Add two receipts and supplement exactly six existing PHP-Wasm Subtype cells.
 *
 * @param original - Inventory before recursive checked-Subtype promotion.
 * @param references - Both authenticated installed-route references.
 */
export const promoteRecursiveSubtypePhpWasm = async (original, references) => {
	assert.deepEqual(references, await recursiveSubtypePhpWasmReferences());
	const inventory = await refreshRecursiveSubtypePhpWasmCorePins(original);
	for(const reference of references)
	{
		assert.ok(!inventory.evidence.some(item => item.id === reference.id),
			`Already promoted: ${reference.id}`);
		inventory.evidence.push({
			id: reference.id, kind: "installed", revision: reference.revision
			, command: reference.command, scope: reference.scope
			, files: reference.files, artifacts: reference.artifacts
		});
	}
	for(const path of ["ordinary-source", "reviewed-ir"])
	{
		const expected = path === "ordinary-source" ? [
			["php-wasm-subtype-ordinary", ["parameter", "result"]]
			, ["nominal-subtype-php-wasm-fields-ordinary-source", ["field"]]
		] : [
			["php-wasm-subtype-reviewed", ["parameter", "result"]]
			, ["nominal-subtype-php-wasm-fields-reviewed-ir", ["field"]]
		];
		const matches = inventory.observations.filter(item => item.path === path
			&& item.shapes.includes("subtype") && item.profiles.includes("php-wasm"));
		assert.deepEqual(matches.map(item => [item.id, item.positions]), expected,
			"Missing or overlapping recursive PHP-Wasm Subtype observations");
		const reference = references.find(item => item.sourcePath === path);
		assert.ok(reference); const addition = ` Recursive checked PHP-Wasm acceptance: ${reference.scope}`;
		for(const observation of matches)
		{
			assert.equal(observation.limitations.filter(item =>
				item === nominalPrimitiveSubtypePhpWasmLimit).length, 1);
			observation.scope = observation.scope.replaceAll(
				nominalPrimitiveSubtypePhpWasmLimit, recursiveSubtypePhpWasmLimit
			) + addition;
			observation.limitations = observation.limitations.map(item =>
				item === nominalPrimitiveSubtypePhpWasmLimit ? recursiveSubtypePhpWasmLimit : item);
			assert.equal(observation.conversionNotes.subtype.split(
				nominalPrimitiveSubtypePhpWasmConversion).length, 2);
			observation.conversionNotes.subtype = observation.conversionNotes.subtype.replace(
				nominalPrimitiveSubtypePhpWasmConversion, recursiveSubtypePhpWasmConversion
			);
			for(const position of observation.positions) observation.hostTypes.subtype[position] = {
				parameter: recursiveSubtypePhpWasmParameter
				, result: recursiveSubtypePhpWasmResult
				, field: recursiveSubtypePhpWasmField
			}[position];
			for(const stage of Object.values(observation.stages))
			{
				assert.equal(stage.state, "passed"); stage.evidence.push(reference.id);
				stage.note = stage.note.replaceAll(
					nominalPrimitiveSubtypePhpWasmLimit, recursiveSubtypePhpWasmLimit
				) + addition;
			}
		}
	}
	return inventory;
};

/**
 * Canonical text used by the one-shot writer and source-history gate.
 *
 * @param inventory - Inventory to serialize canonically.
 */
export const recursiveSubtypePhpWasmInventoryText = inventory => `${JSON.stringify(inventory, null, 2)}\n`;
