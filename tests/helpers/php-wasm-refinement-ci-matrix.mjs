/**
 * Closed inventory for the admitted PHP-Wasm refinement workflows.
 *
 * @file
 */
import assert from "node:assert/strict";

const workflow = (id, title, ownerNodes, timeoutMinutes, options = {}) =>
	Object.freeze({
		id, title, ownerNodes: Object.freeze(ownerNodes), timeoutMinutes
		, job: options.job ?? id
		, kind: options.kind ?? "acceptance"
		, cells: options.cells ?? 1
		, maxParallel: options.maxParallel ?? 1
		, path: `.github/workflows/${id}.yml`
	});

/**
 * Every dedicated recurring workflow that belongs to the admitted #1443
 * refinement surface. The consumer-matrix corpus is audited separately by the
 * partition contract; this inventory closes the dedicated acceptance and
 * instrumented-measurement lanes.
 */
export const phpWasmRefinementCiMatrix = Object.freeze([
	workflow("callback-refinements-php-wasm"
		, "checked Fin and record callbacks", [1460, 1483], 360)
	, workflow("callback-subtype-php-wasm"
		, "callback Subtypes", [1460, 1471], 240)
	, workflow("checked-record-php-wasm"
		, "top-level checked records", [1458, 1476], 180)
	, workflow("checked-record-value-index-php-wasm"
		, "value-index checked records", [1461, 1480], 180)
	, workflow("dependent-checked-record-php-wasm"
		, "dependent checked records", [1461, 1481], 180)
	, workflow("inherited-checked-record-php-wasm"
		, "inherited checked records", [1458, 1479], 180)
	, workflow("nested-checked-record-php-wasm"
		, "nested checked records", [1458, 1477], 180)
	, workflow("nominal-primitive-subtype-php-wasm"
		, "primitive-base nominal Subtypes", [1457], 180)
	, workflow("nominal-subtype-php-wasm"
		, "nominal Subtypes", [1457], 180)
	, workflow("owned-checked-record-php-wasm"
		, "owned checked records", [1459, 1484], 180)
	, workflow("owned-subtype-php-wasm"
		, "owned Subtypes", [1459, 1472], 180)
	, workflow("recursive-checked-record-php-wasm"
		, "recursive checked records", [1458, 1478], 180)
	, workflow("recursive-subtype-php-wasm"
		, "recursive Subtypes", [1458, 1473], 180)
	, workflow("zero-payload-checked-record-php-wasm"
		, "zero-payload checked records", [1461, 1482], 180)
	, workflow("php-wasm-refinement-entry"
		, "nominal and recursive copied dispatch", [1824], 240
		, { job: "entry-probe", kind: "measurement", cells: 8, maxParallel: 2 })
	, workflow("php-wasm-owned-refinement-entry"
		, "owned dispatch and transfer ordering", [1825], 240
		, { job: "entry-probe", kind: "measurement", cells: 4, maxParallel: 2 })
	, workflow("php-wasm-callback-entry"
		, "synchronous callback dispatch", [1826], 240
		, { job: "callback-entry-probe", kind: "measurement"
			, cells: 2, maxParallel: 2 })
	, workflow("php-wasm-indexed-refinement-entry"
		, "dependent, indexed and zero-payload dispatch", [1827], 240
		, { job: "entry-probe", kind: "measurement", cells: 12, maxParallel: 2 })
]);

const escape = value => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const count = (source, expression) => [...source.matchAll(expression)].length;

/**
 * Check one dedicated workflow without executing its expensive producer.
 *
 * @param lane - Closed matrix entry.
 * @param source - Complete workflow source.
 */
export const assertPhpWasmRefinementCiWorkflow = (lane, source) => {
	assert.equal(typeof source, "string");
	assert.match(source, /^name: [^\n]+\n\non:\n {2}push:\n {2}pull_request:\n {2}workflow_dispatch:\n/u);
	assert.match(source, /\npermissions:\n {2}contents: read\n/u);
	assert.match(source, new RegExp("\\nconcurrency:\\n {2}group: "
		+ escape(lane.id) + "-\\$\\{\\{ github\\.ref \\}\\}\\n"
		+ " {2}cancel-in-progress: true\\n", "u"));
	assert.doesNotMatch(source, /\n {2}schedule:/u);
	assert.doesNotMatch(source, /^\s+continue-on-error:\s*true\s*$/mu);
	assert.doesNotMatch(source, /^\s+if:\s*false\s*$/mu);

	const pieces = source.split("\njobs:\n");
	assert.equal(pieces.length, 2);
	const jobs = [...pieces[1].matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)]
		.map(match => match[1]);
	assert.deepEqual(jobs, [lane.job]);
	const job = pieces[1];
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	const timeout = /^ {4}timeout-minutes: (\d+)$/mu.exec(job);
	assert.ok(timeout);
	assert.equal(Number(timeout[1]), lane.timeoutMinutes);
	assert.ok(lane.timeoutMinutes <= 360);
	assert.match(job, /^ {6}EMCC_CORES: "2"$/mu);
	assert.match(job, /^ {6}LEAN_WASM_RUNTIME_PROFILE: browser$/mu);
	assert.match(job, /^ {6}LEAN_WASM_RUNTIME_VARIANT: php-wasm-3\.1\.68$/mu);
	assert.match(job, /^ {6}LEAN_WASM_ARTIFACT_TARGET: php-wasm-emscripten-3\.1\.68$/mu);

	if(lane.kind === "measurement")
	{
		assert.match(job, /^ {4}strategy:\n {6}fail-fast: false$/mu);
		assert.match(job, new RegExp("^ {6}max-parallel: "
			+ lane.maxParallel + "$", "mu"));
		assert.ok(lane.cells >= lane.maxParallel);
	}
	else
	{
		assert.doesNotMatch(job, /^ {4}strategy:/mu);
		assert.equal(lane.cells, 1);
		assert.equal(lane.maxParallel, 1);
	}

	assert.equal(count(job, /^ {8}uses: actions\/checkout@v6$/gmu), 1);
	assert.equal(count(job, /^ {10}fetch-depth: 0$/gmu), 1);
	assert.equal(count(job, /^ {10}persist-credentials: false$/gmu), 1);
	assert.equal(count(job, /^ {8}uses: actions\/setup-node@v6$/gmu), 1);
	assert.equal(count(job, /^ {10}node-version: "22"$/gmu), 1);
	assert.equal(count(job, /^ {10}cache: npm$/gmu), 1);
	assert.equal(count(job, /^ {8}uses: cachix\/install-nix-action@v31$/gmu), 1);
	assert.equal(count(job, /^ {8}uses: actions\/cache@v5$/gmu), 1);
	assert.equal(count(job, /^ {8}id: acceptance$/gmu), 1);

	assert.equal(count(job, /^ {8}if: always\(\)$/gmu), 1);
	assert.equal(count(job, /^ {8}uses: actions\/upload-artifact@v7$/gmu), 1);
	assert.equal(count(job, /^ {10}name: .+\$\{\{ github\.sha \}\}$/gmu), 1);
	assert.equal(count(job, /^ {10}if-no-files-found: error$/gmu), 1);
	assert.equal(count(job, /^ {10}retention-days: 30$/gmu), 1);
	assert.equal(count(job
		, /^ {8}if: always\(\) && steps\.acceptance\.outcome != 'success'$/gmu), 1);
	assert.equal(count(job, /^ {8}run: exit 1$/gmu), 1);
	return Object.freeze({
		id: lane.id, kind: lane.kind, cells: lane.cells
		, maxParallel: lane.maxParallel, timeoutMinutes: lane.timeoutMinutes
	});
};

/**
 * Summarize the bounded hosted surface represented by the closed matrix.
 */
export const phpWasmRefinementCiBudget = () => Object.freeze({
	workflows: phpWasmRefinementCiMatrix.length
	, acceptanceWorkflows: phpWasmRefinementCiMatrix
		.filter(lane => lane.kind === "acceptance").length
	, measurementWorkflows: phpWasmRefinementCiMatrix
		.filter(lane => lane.kind === "measurement").length
	, measurementCells: phpWasmRefinementCiMatrix
		.filter(lane => lane.kind === "measurement")
		.reduce((total, lane) => total + lane.cells, 0)
	, maximumConcurrentJobs: phpWasmRefinementCiMatrix
		.reduce((total, lane) => total + lane.maxParallel, 0)
});
