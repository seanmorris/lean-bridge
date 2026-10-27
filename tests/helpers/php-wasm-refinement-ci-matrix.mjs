/**
 * Closed inventory for the admitted PHP-Wasm refinement workflows.
 *
 * @file
 */
import assert from "node:assert/strict";

const genericRun = id => "set -euo pipefail\nsource scripts/env.sh\n"
	+ `bash scripts/run-${id}-ci.sh\n`;
const genericPaths = (id, kind) => Object.freeze([
	`build/${id}-ci/`
	, ...(kind === "measurement" ? [`build/${id}-ci.tap`] : [])
	, `build/${id}-host.log`
	, `build/${id}-runtime.log`
	, `build/${id}-input/php-wasm-runtime/runtime.json`
	, ...(kind === "measurement" ? [`build/${id}-failed-deployments/`] : [])
]);
const workflow = (id, title, ownerNodes, timeoutMinutes, options = {}) =>
	Object.freeze({
		id, title, ownerNodes: Object.freeze(ownerNodes), timeoutMinutes
		, job: options.job ?? id
		, kind: options.kind ?? "acceptance"
		, cells: options.cells ?? 1
		, maxParallel: options.maxParallel ?? 1
		, axes: Object.freeze(options.axes ?? {})
		, acceptanceRun: options.acceptanceRun ?? genericRun(id)
		, acceptanceCommand: options.acceptanceCommand
			?? `bash scripts/run-${id}-ci.sh`
		, artifactName: options.artifactName ?? id + "-${{ github.sha }}"
		, artifactPaths: Object.freeze(options.artifactPaths
			?? genericPaths(id, options.kind ?? "acceptance"))
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
		, "checked Fin and record callbacks", [1460, 1483], 360, {
			acceptanceCommand: "npm run test:callback-refinements-php-wasm 2>&1 | tee build/callback-refinements-php-wasm/run.tap"
			, acceptanceRun: "set -euo pipefail\nsource scripts/env.sh\n"
				+ "npm run test:callback-refinements-php-wasm 2>&1 | tee build/callback-refinements-php-wasm/run.tap\n"
				+ "rg '^# fail 0$' build/callback-refinements-php-wasm/run.tap\n"
				+ "rg '^# skipped 0$' build/callback-refinements-php-wasm/run.tap\n"
				+ "test -s build/callback-refinements-php-wasm/records/index.json\n"
				+ "node scripts/check-callback-refinements-php-wasm-reports.mjs \\\n  --directory build/callback-refinements-php-wasm/records \\\n  --producer \"$GITHUB_SHA\" | tee build/callback-refinements-php-wasm/verification.json\n"
			, artifactPaths: [
				"build/callback-refinements-php-wasm/host.log"
				, "build/callback-refinements-php-wasm/runtime.log"
				, "build/callback-refinements-php-wasm/run.tap"
				, "build/callback-refinements-php-wasm/verification.json"
				, "build/callback-refinements-php-wasm/records"
			]
		}
	)
	, workflow("callback-subtype-php-wasm"
		, "callback Subtypes", [1460, 1471], 240, {
			acceptanceCommand: "npm run test:callback-subtype-php-wasm 2>&1 | tee build/callback-subtype-php-wasm/run.tap"
			, acceptanceRun: "set -euo pipefail\nsource scripts/env.sh\n"
				+ "npm run test:callback-subtype-php-wasm 2>&1 | tee build/callback-subtype-php-wasm/run.tap\n"
				+ "rg '^# fail 0$' build/callback-subtype-php-wasm/run.tap\n"
				+ "rg '^# skipped 0$' build/callback-subtype-php-wasm/run.tap\n"
				+ "test -s build/callback-subtype-php-wasm/records/index.json\n"
				+ "node scripts/check-callback-subtype-php-wasm-reports.mjs \\\n  --directory build/callback-subtype-php-wasm/records \\\n  --producer \"$GITHUB_SHA\" | tee build/callback-subtype-php-wasm/verification.json\n"
			, artifactPaths: [
				"build/callback-subtype-php-wasm/host.log"
				, "build/callback-subtype-php-wasm/runtime.log"
				, "build/callback-subtype-php-wasm/run.tap"
				, "build/callback-subtype-php-wasm/verification.json"
				, "build/callback-subtype-php-wasm/records"
			]
		}
	)
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
		, "owned checked records", [1459, 1484], 180, {
			acceptanceCommand: "npm run test:owned-checked-record-php-wasm 2>&1 | tee build/owned-checked-record-php-wasm.log"
			, acceptanceRun: "set -euo pipefail\nsource scripts/env.sh\n"
				+ "npm run test:owned-checked-record-php-wasm 2>&1 | tee build/owned-checked-record-php-wasm.log\n"
				+ "rg '^# fail 0$' build/owned-checked-record-php-wasm.log\n"
				+ "rg '^# skipped 0$' build/owned-checked-record-php-wasm.log\n"
				+ "test -s build/owned-checked-record-php-wasm/packages.json\n"
				+ "test -s build/owned-checked-record-php-wasm/full.json\n"
				+ "test -s build/owned-checked-record-php-wasm/result-only.json\n"
			, artifactPaths: [
				"build/owned-checked-record-php-wasm.log"
				, "build/owned-checked-record-php-wasm-host.log"
				, "build/owned-checked-record-php-wasm-runtime.log"
				, "build/owned-checked-record-php-wasm/packages.json"
				, "build/owned-checked-record-php-wasm/full.json"
				, "build/owned-checked-record-php-wasm/result-only.json"
				, "build/owned-checked-record-php-wasm/evidence"
			]
		}
	)
	, workflow("owned-subtype-php-wasm"
		, "owned Subtypes", [1459, 1472], 180, {
			acceptanceCommand: "npm run test:owned-subtype-php-wasm 2>&1 | tee build/owned-subtype-php-wasm.log"
			, acceptanceRun: "set -euo pipefail\nsource scripts/env.sh\n"
				+ "npm run test:owned-subtype-php-wasm 2>&1 | tee build/owned-subtype-php-wasm.log\n"
				+ "rg '^# fail 0$' build/owned-subtype-php-wasm.log\n"
				+ "rg '^# skipped 0$' build/owned-subtype-php-wasm.log\n"
				+ "test -s build/owned-subtype-php-wasm/packages.json\n"
			, artifactPaths: [
				"build/owned-subtype-php-wasm.log"
				, "build/owned-subtype-php-wasm-host.log"
				, "build/owned-subtype-php-wasm-runtime.log"
				, "build/owned-subtype-php-wasm/packages.json"
				, "build/owned-subtype-php-wasm/evidence"
			]
		}
	)
	, workflow("recursive-checked-record-php-wasm"
		, "recursive checked records", [1458, 1478], 180)
	, workflow("recursive-subtype-php-wasm"
		, "recursive Subtypes", [1458, 1473], 180)
	, workflow("zero-payload-checked-record-php-wasm"
		, "zero-payload checked records", [1461, 1482], 180)
	, workflow("php-wasm-refinement-entry"
		, "nominal and recursive copied dispatch", [1824], 240
		, { job: "entry-probe", kind: "measurement", cells: 8, maxParallel: 2
			, axes: { family: ["nominal-full", "nominal-result-only"
				, "recursive-subtype", "recursive-checked-record"]
			, route: ["ordinary", "reviewed"] }
			, acceptanceRun: "source scripts/env.sh\nbash scripts/run-php-wasm-refinement-entry-ci.sh\n"
			, acceptanceCommand: "bash scripts/run-php-wasm-refinement-entry-ci.sh"
			, artifactName: "php-wasm-refinement-entry-${{ matrix.family }}-${{ matrix.route }}-${{ github.sha }}"
		}
	)
	, workflow("php-wasm-owned-refinement-entry"
		, "owned dispatch and transfer ordering", [1825], 240
		, { job: "entry-probe", kind: "measurement", cells: 4, maxParallel: 2
			, axes: { family: ["owned-subtype", "owned-checked-record"]
				, route: ["ordinary", "reviewed"] }
			, acceptanceRun: "source scripts/env.sh\nbash scripts/run-php-wasm-owned-refinement-entry-ci.sh\n"
			, acceptanceCommand: "bash scripts/run-php-wasm-owned-refinement-entry-ci.sh"
			, artifactName: "php-wasm-owned-refinement-entry-${{ matrix.family }}-${{ matrix.route }}-${{ github.sha }}"
		}
	)
	, workflow("php-wasm-callback-entry"
		, "synchronous callback dispatch", [1826], 240
		, { job: "callback-entry-probe", kind: "measurement"
			, cells: 3, maxParallel: 2
			, axes: { family: ["callback-fin", "callback-checked-record", "callback-subtype"] }
			, acceptanceRun: "source scripts/env.sh\nbash scripts/run-php-wasm-callback-entry-ci.sh\n"
			, acceptanceCommand: "bash scripts/run-php-wasm-callback-entry-ci.sh"
			, artifactName: "php-wasm-callback-entry-${{ matrix.family }}-${{ github.sha }}"
		}
	)
	, workflow("php-wasm-indexed-refinement-entry"
		, "dependent, indexed and zero-payload dispatch", [1827], 240
		, { job: "entry-probe", kind: "measurement", cells: 12, maxParallel: 2
			, axes: { family: ["dependent-full", "dependent-result-only"
				, "value-index-full", "value-index-result-only"
				, "zero-payload-full", "zero-payload-result-only"]
			, route: ["ordinary", "reviewed"] }
			, acceptanceRun: "source scripts/env.sh\nbash scripts/run-php-wasm-refinement-entry-ci.sh\n"
			, acceptanceCommand: "bash scripts/run-php-wasm-refinement-entry-ci.sh"
			, artifactName: "php-wasm-indexed-refinement-entry-${{ matrix.family }}-${{ matrix.route }}-${{ github.sha }}"
		}
	)
]);

const escape = value => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const count = (source, expression) => [...source.matchAll(expression)].length;
const indented = (source, spaces) => source.split("\n").slice(0, -1)
	.map(line => " ".repeat(spaces) + line).join("\n") + "\n";
const runBlock = job => {
	const identity = job.indexOf("        id: acceptance\n");
	assert.ok(identity >= 0);
	const marker = "        run: |\n";
	const start = job.indexOf(marker, identity);
	assert.ok(start >= 0);
	const body = start + marker.length;
	const end = job.indexOf("      - name:", body);
	assert.ok(end >= 0);
	return job.slice(body, end);
};
const uploadPaths = job => {
	const upload = job.indexOf("        uses: actions/upload-artifact@v7\n");
	assert.ok(upload >= 0);
	const marker = "          path: |\n";
	const start = job.indexOf(marker, upload);
	assert.ok(start >= 0);
	const body = start + marker.length;
	const end = job.indexOf("          if-no-files-found:", body);
	assert.ok(end >= 0);
	return job.slice(body, end);
};
const matrixAxes = job => {
	const marker = "      matrix:\n";
	const start = job.indexOf(marker);
	assert.ok(start >= 0);
	const body = start + marker.length;
	const end = job.indexOf("    env:\n", body);
	assert.ok(end >= 0);
	const source = job.slice(body, end);
	assert.doesNotMatch(source, /^ {8}(?:include|exclude):/mu);
	const axes = {};
	const lines = source.trimEnd().split("\n");
	for(let index = 0; index < lines.length;)
	{
		const head = /^ {8}([a-z][a-z0-9-]*):$/u.exec(lines[index]);
		assert.ok(head, `matrix axis ${lines[index]}`);
		const values = [];
		for(++index; index < lines.length; ++index)
		{
			const value = /^ {10}- ([a-z0-9-]+)$/u.exec(lines[index]);
			if(!value) break;
			values.push(value[1]);
		}
		assert.ok(values.length > 0, head[1]);
		assert.ok(!Object.hasOwn(axes, head[1]), head[1]);
		axes[head[1]] = values;
	}
	return axes;
};

/**
 * Check one dedicated workflow without executing its expensive producer.
 *
 * @param lane - Closed matrix entry.
 * @param source - Complete workflow source.
 */
export const assertPhpWasmRefinementCiWorkflow = (lane, source) => {
	assert.equal(typeof source, "string");
	const triggers = /\non:\n[\s\S]*?\npermissions:\n/u.exec(source);
	assert.ok(triggers);
	assert.deepEqual([...triggers[0].matchAll(
		/^ {2}([a-z][a-z0-9_-]*):\n/gmu
	)].map(match => match[1]), ["workflow_dispatch", "schedule"
		, ...lane.kind === "measurement" ? ["workflow_call"] : []]);
	assert.match(triggers[0]
		, /^\non:\n {2}workflow_dispatch:\n {2}# One lane in the bounded weekly default-branch acceptance sweep\.\n {2}schedule:\n {4}- cron: "[0-9]+ [0-9]+ \* \* [0-6]"\n/mu);
	assert.match(triggers[0], /\npermissions:\n$/u);
	assert.match(source, /\npermissions:\n {2}contents: read\n/u);
	assert.match(source, new RegExp("\\nconcurrency:\\n {2}group: "
		+ escape(lane.id)
		+ (lane.kind === "measurement"
			? "-\\$\\{\\{ github\\.workflow \\}\\}" : "")
		+ "-\\$\\{\\{ github\\.ref \\}\\}\\n"
		+ " {2}cancel-in-progress: true\\n", "u"));
	assert.doesNotMatch(source, /^\s+continue-on-error:/mu);

	const pieces = source.split("\njobs:\n");
	assert.equal(pieces.length, 2);
	const jobs = [...pieces[1].matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)]
		.map(match => match[1]);
	assert.deepEqual(jobs, [lane.job]);
	const job = pieces[1];
	assert.doesNotMatch(job, /^ {4}if:/mu);
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
		const axes = matrixAxes(job);
		assert.deepEqual(axes, lane.axes);
		assert.equal(Object.values(axes)
			.reduce((product, values) => product * values.length, 1), lane.cells);
		assert.equal(count(job, new RegExp("^ {10}LEAN_BRIDGE_PHP_WASM_FAILED_DEPLOYMENTS: "
			+ escape(`build/${lane.id}-failed-deployments`) + "$", "gmu")), 1);
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
	assert.equal(runBlock(job), indented(lane.acceptanceRun, 10));

	assert.equal(count(job, /^ {8}if: always\(\)$/gmu), 1);
	assert.equal(count(job, /^ {8}uses: actions\/upload-artifact@v7$/gmu), 1);
	assert.equal(count(job, new RegExp("^ {10}name: "
		+ escape(lane.artifactName) + "$", "gmu")), 1);
	assert.equal(uploadPaths(job), indented(lane.artifactPaths.join("\n") + "\n", 12));
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
