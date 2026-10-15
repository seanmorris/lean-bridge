/**
 * Authenticate the archived recursive checked-Subtype PHP-Wasm package runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";

export const recursiveSubtypePhpWasmEvidence = "docs/evidence/recursive-subtype-php-wasm-20261015";
export const recursiveSubtypePhpWasmEvidenceSha256 = "de8c8066d812f0c301943132d075cab992bfdc9dd88e00a3d4d58f79b11a352b";
export const recursiveSubtypePhpWasmProducer = "a54f8c653af24440754ff274df9095b54680f547";
const expectedSelections = Object.freeze([
	["ordinary", "ordinary-source", "ordinary-source"]
	, ["reviewed", "reviewed-ir", "reviewed-source"]
]);
const expectedExecutions = Object.freeze([
	["node", "embedded", "startup", "weak"]
	, ["node", "embedded", "startup", "strict"]
	, ["node", "embedded", "lazy", "weak"]
	, ["node", "embedded", "lazy", "strict"]
	, ["node", "composer", "startup", "weak"]
	, ["node", "composer", "startup", "strict"]
	, ["node", "composer", "lazy", "weak"]
	, ["node", "composer", "lazy", "strict"]
	, ["chromium", "bundled", "startup", "weak"]
	, ["chromium", "bundled", "startup", "strict"]
	, ["chromium", "bundled", "lazy", "weak"]
	, ["chromium", "bundled", "lazy", "strict"]
]);
const selectedSources = Object.freeze([
	".github/workflows/recursive-subtype-php-wasm.yml"
	, "scripts/run-recursive-subtype-php-wasm-ci.sh"
	, "src/analyze/NativeExports.lean"
	, "src/analyze/checked-refinement-selection.mjs"
	, "src/build/component-refinement-mirrors.mjs"
	, "src/build/component-recursive-lean.mjs"
	, "src/backends/c/native-graph-adapters.mjs"
	, "src/backends/php/copied-graph-zend.mjs"
	, "src/release/php-wasm-copied-package.mjs"
	, "tests/fixtures/onboarding/recursive-subtypes/RecursiveSubtypes.lean"
	, "tests/fixtures/recursive-subtype-consumers/php-wasm.php"
	, "tests/helpers/recursive-subtype-fixture.mjs"
	, "tests/helpers/recursive-subtype-php-wasm-tests.mjs"
	, "tests/recursive-subtype-php-wasm.test.mjs"
]);
const safePath = path => typeof path === "string" && /^[A-Za-z0-9_.+/[\]-]+$/u.test(path)
	&& !path.startsWith("/") && path.split("/").every(part => part && part !== "." && part !== "..");
const json = (bytes, label) => {
	const value = JSON.parse(bytes); assert.equal(bytes.toString(), canonicalJson(value), label); return value;
};
const allFiles = async (root, prefix = "") => {
	const result = [];
	for(const entry of await readdir(join(root, prefix), { withFileTypes: true }))
	{
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		if(entry.isDirectory()) result.push(...await allFiles(root, path));
		else
		{
			assert.ok(entry.isFile(), path); result.push(path);
		}
	}
	return result.sort();
};
const producerSource = path => Buffer.from(execFileSync("git", [
	"show", `${recursiveSubtypePhpWasmProducer}:${path}`
], { maxBuffer: 32 * 1024 * 1024 }));

const checkRefinements = refinements => {
	assert.equal(sha256(JSON.stringify(refinements)),
		"3b817b5465b7a053022609f518cbb0cd1e3bd30ad600d1871767cff37b191f60");
	assert.deepEqual(Object.keys(refinements), [
		"RecursiveSubtypes.echo", "RecursiveSubtypes.echoGroups"
		, "RecursiveSubtypes.first", "RecursiveSubtypes.groups"
		, "RecursiveSubtypes.produce", "RecursiveSubtypes.second"
	]);
	const first = refinements["RecursiveSubtypes.first"].parameters[0].cases[1].fields;
	const second = refinements["RecursiveSubtypes.second"].parameters[0].cases[1].fields;
	assert.deepEqual(first.map(field => field.name), ["value", "digit", "tail"]);
	assert.deepEqual(first[0].refinement,
		{ constructor: "RecursiveSubtypes.plusOne", kind: "subtype" });
	assert.deepEqual(second[0].refinement,
		{ constructor: "RecursiveSubtypes.plusTwo", kind: "subtype" });
	assert.deepEqual(first[1].refinement, { bound: "3", kind: "fin" });
	assert.equal(first[2].refinement, null);
};

const checkReport = (report, route, sourcePath) => {
	assert.equal(report.schemaVersion, 1); assert.equal(report.route, route);
	assert.equal(report.path, route === "ordinary" ? "ordinary-source" : "reviewed-source");
	assert.equal(sourcePath, route === "ordinary" ? "ordinary-source" : "reviewed-ir");
	assert.equal(report.profile, "php-wasm"); assert.equal(report.dispatch, "not measured");
	assert.equal(report.reproducible, true); assert.equal(report.sourceRemovedBeforeInstallation, true);
	assert.deepEqual(report.observation, { checks: 24, php: "8.4.1", word_bits: 32 });
	checkRefinements(report.refinements);
	if(route === "reviewed") assert.match(report.reviewedBindingIrSha256, /^[a-f0-9]{64}$/u);
	else assert.ok(!Object.hasOwn(report, "reviewedBindingIrSha256"));
	const wasm = report.phpWasm;
	assert.equal(wasm.nodeVersion, "v22.23.2");
	assert.equal(wasm.browserVersion, "152.0.7977.75");
	assert.equal(wasm.host.version, "0.1.0"); assert.equal(wasm.npm.version, "10.9.8");
	assert.equal(wasm.composer.composerVersion, "Composer version 2.5.5 2023-03-21 11:50:05");
	for(const name of [
		"compilerFreeExecution"
		, "emptyCaches"
		, "lockedInstall"
		, "offlineInstall"
		, "publicApiOnly", "relocated", "repeatExecution", "unchangedDeployment"])
		assert.equal(wasm[name], true, name);
	assert.deepEqual(wasm.executions.map(item =>
		[item.realm, item.arrangement, item.loading, item.mode]), expectedExecutions);
	for(const execution of wasm.executions)
	{
		assert.deepEqual(execution.observation, { checks: 24, php: "8.4.1", word_bits: 32 });
		assert.deepEqual(execution.phases.map(item => item.stage),
			["ready", "autoload", "invalid", "complete"]);
		for(const phase of execution.phases)
		{
			const loaded = execution.loading === "startup" || phase.stage === "complete";
			assert.equal(phase.libraries.length, loaded ? 2 : 0);
			if(!loaded) continue;
			assert.ok(phase.libraries.some(name => name.startsWith("php8.4-lb_recursivesubtypes_graph_")));
			assert.ok(phase.libraries.some(name => name.startsWith("liblean_bridge_php_wasm_copied_")));
		}
	}
	return report;
};

let cached;
/**
 * Verify every retained byte, receipt, execution tuple, and source snapshot.
 *
 * @param read - File reader replaceable by mutation tests.
 */
export const checkRecursiveSubtypePhpWasmEvidence = async (read = readFile) => {
	if(read === readFile && cached) return cached;
	const checking = (async () => {
		const indexBytes = Buffer.from(await read(`${recursiveSubtypePhpWasmEvidence}/index.json`));
		assert.equal(sha256(indexBytes), recursiveSubtypePhpWasmEvidenceSha256);
		const index = json(indexBytes, "index.json");
		assert.deepEqual(Object.keys(index).sort(), [
			"diskFloorBytes"
			, "files"
			, "kind"
			, "limitations"
			, "loadCeiling"
			, "producerCommit"
			, "runs"
			, "schemaVersion"
			, "selectedSources"].sort());
		assert.equal(index.schemaVersion, 1);
		assert.equal(index.kind, "recursive-subtype-php-wasm-installed-v1");
		assert.equal(index.producerCommit, recursiveSubtypePhpWasmProducer);
		assert.equal(index.loadCeiling, 8); assert.equal(index.diskFloorBytes, 2 * 1024 * 1024 * 1024);
		assert.equal(index.limitations.length, 7); assert.deepEqual(index.selectedSources, selectedSources);
		const files = new Map();
		for(const entry of index.files)
		{
			assert.deepEqual(Object.keys(entry).sort(), ["bytes", "path", "sha256"]);
			assert.ok(safePath(entry.path) && !files.has(entry.path), entry.path);
			const bytes = Buffer.from(await read(`${recursiveSubtypePhpWasmEvidence}/${entry.path}`));
			assert.equal(bytes.length, entry.bytes, entry.path); assert.equal(sha256(bytes), entry.sha256, entry.path);
			files.set(entry.path, bytes);
		}
		if(read === readFile) assert.deepEqual(await allFiles(recursiveSubtypePhpWasmEvidence),
			["index.json", ...files.keys()].sort());
		for(const path of selectedSources)
			assert.deepEqual(files.get("sources/" + path), producerSource(path), path);
		assert.deepEqual(index.runs.map(run => [run.route, run.sourcePath]),
			expectedSelections.map(([route, sourcePath]) => [route, sourcePath]));
		const checked = [];
		for(const [position, run] of index.runs.entries())
		{
			const [route, sourcePath, reportPath] = expectedSelections[position];
			assert.equal(run.reportPath, `${route}/report.json`);
			assert.equal(run.receiptPath, `${route}/package-set-receipt.json`);
			assert.equal(run.checksumPath, `${route}/package-set-receipt.json.sha256`);
			assert.equal(run.executions, 12); assert.equal(run.checks, 24);
			const reportBytes = files.get(run.reportPath), receiptBytes = files.get(run.receiptPath);
			assert.equal(sha256(reportBytes), run.reportSha256);
			assert.equal(sha256(receiptBytes), run.receiptSha256);
			assert.equal(files.get(run.checksumPath).toString(),
				`${run.receiptSha256}  package-set-receipt.json\n`);
			const report = checkReport(json(reportBytes, run.reportPath), route, sourcePath);
			assert.equal(report.path, reportPath); assert.equal(report.receiptSha256, run.receiptSha256);
			const receipt = json(receiptBytes, run.receiptPath);
			assert.equal(receipt.schemaVersion, 1); assert.equal(receipt.kind, "lean-bridge-package-set-receipt");
			assert.deepEqual(receipt.packages, report.packages);
			assert.deepEqual(receipt.packages.map(pkg => [pkg.ecosystem, pkg.role, pkg.profile]), [
				["composer", "api", "php-wasm-copied-v1"]
				, ["npm", "runtime", "php-wasm-copied-v1"]
				, ["npm", "component", "php-wasm-copied-v1"]
			]);
			const artifacts = receipt.packages.flatMap(pkg => pkg.artifacts);
			assert.deepEqual(run.archives, artifacts.map(artifact => ({
				path: `${route}/${artifact.path}`
				, bytes: artifact.bytes
				, sha256: artifact.sha256
			})));
			assert.deepEqual(report.archives, Object.fromEntries(artifacts.map(artifact =>
				[artifact.path, artifact.sha256])));
			for(const artifact of run.archives)
			{
				const bytes = files.get(artifact.path); assert.equal(bytes.length, artifact.bytes);
				assert.equal(sha256(bytes), artifact.sha256);
			}
			checked.push({ route, sourcePath, report, receipt, archives: run.archives });
		}
		const runtime = item => item.archives.find(archive => archive.path.includes("copied-runtime"));
		assert.deepEqual(runtime(checked[0]), { ...runtime(checked[1]), path: runtime(checked[0]).path });
		for(const suffix of ["-php-wasm.zip", ".tgz"])
		{
			const component = item => item.archives.find(archive =>
				!archive.path.includes("copied-runtime") && archive.path.endsWith(suffix));
			assert.notEqual(component(checked[0]).sha256, component(checked[1]).sha256);
		}
		return { index, files: index.files, runs: checked, producerCommit: index.producerCommit };
	})();
	if(read === readFile) cached = checking;
	return checking;
};
