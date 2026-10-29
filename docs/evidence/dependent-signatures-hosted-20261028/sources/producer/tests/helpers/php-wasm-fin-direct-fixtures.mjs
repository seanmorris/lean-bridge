/**
 * Direct scalar and complete structural Fin fixtures for PHP-Wasm acceptance.
 * Existing native callers and source signatures are preserved.
 *
 * @file
 */
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finContainerEdgeConsumer, finContainerEdgeRefinements, finContainerEdgeReviewedIr, finContainerEdgeSource } from "./fin-container-edges.mjs";
import { reviewedScalarHostIr } from "./reviewed-scalar-host-fixture.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const fin = bound => bound === null ? null : { kind: "fin", bound };
const settings = name => ({ npm: { name: `lean-bridge-${name}-wasm`, version: "1.0.0" }, composer: { name: `lean-bridge-${name}/wasm`, version: "1.0.0" } });
const scalarBounds = {
	impossible: [["0"], null], only: [["1"], null], mirror: [["10"], "10"]
	, twice: [["300"], null]
	, succHuge: [["1180591620717411303424"], "1180591620717411303424"]
	, wrap: [[null], "7"], label: [[null, "4", null], null]
};
export const phpWasmScalarFinRefinements = Object.freeze(Object.fromEntries(Object.entries(scalarBounds)
	.map(([name, [parameters, result]]) => [`NativeFin.${name}`, { parameters: parameters.map(fin), result: fin(result) }])));

export const phpWasmDirectScalar = Object.freeze({
	root: "tests/fixtures/onboarding/native-fin", module: "NativeFin"
	, namespace: "LeanNativeFin", operation: "mirror"
	, consumer: "tests/fixtures/php-wasm-fin-scalar.php"
	, settings: settings("native-fin"), review: reviewedScalarHostIr
	, refinements: phpWasmScalarFinRefinements
});

export const phpWasmDirectContainerSpec = Object.freeze({
	module: "FinContainers", namespace: "LeanFincontainers"
	, operation: "mirror_all"
	, settings: settings("fincontainers"), review: finContainerEdgeReviewedIr
	, refinements: finContainerEdgeRefinements
});

/**
 * Materialize the complete original-plus-edge container fixture and unchanged public PHP caller.
 * The shared installed harness copies this source into two independent author roots.
 *
 * @param t - Running test context that owns the temporary fixture directory.
 */
export const phpWasmDirectContainers = async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-php-wasm-fin-direct-fixture-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project"), consumer = join(directory, "consumer.php");
	await cp("tests/fixtures/onboarding/native-fin-containers", root, { recursive: true });
	await saveLakeFile(root, "FinContainers.lean", await finContainerEdgeSource());
	await saveLakeFile(directory, "consumer.php", await finContainerEdgeConsumer("php-native"));
	return { root, consumer, ...phpWasmDirectContainerSpec };
};
