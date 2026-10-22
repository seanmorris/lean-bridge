/**
 * Recheck every downloaded PHP-Wasm refinement-entry artifact from its original
 * retained records before promoting the complete matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkPhpWasmCallbackEntryReport } from "./php-wasm-callback-entry-report.mjs";
import {
	checkPhpWasmRefinementEntryMatrix
	, phpWasmRefinementEntryMatrix
	, phpWasmRefinementEntryMatrixLocation
} from "./php-wasm-refinement-entry-matrix.mjs";
import { checkPhpWasmRefinementEntryReport } from "./php-wasm-refinement-entry-report.mjs";

export const phpWasmRefinementEntryArtifactLayouts = Object.freeze({
	copied: Object.freeze({
		root: "php-wasm-refinement-entry-ci"
		, support: Object.freeze([
			"php-wasm-refinement-entry-ci.tap"
			, "php-wasm-refinement-entry-host.log"
			, "php-wasm-refinement-entry-runtime.log"
			, "php-wasm-refinement-entry-input/php-wasm-runtime/runtime.json"
		])
	})
	, owned: Object.freeze({
		root: "php-wasm-owned-refinement-entry-ci"
		, support: Object.freeze([
			"php-wasm-owned-refinement-entry-ci.tap"
			, "php-wasm-owned-refinement-entry-host.log"
			, "php-wasm-owned-refinement-entry-runtime.log"
			, "php-wasm-owned-refinement-entry-input/php-wasm-runtime/runtime.json"
		])
	})
	, callback: Object.freeze({
		root: "php-wasm-callback-entry-ci"
		, support: Object.freeze([
			"php-wasm-callback-entry-ci.tap"
			, "php-wasm-callback-entry-host.log"
			, "php-wasm-callback-entry-runtime.log"
			, "php-wasm-callback-entry-input/php-wasm-runtime/runtime.json"
		])
	})
	, indexed: Object.freeze({
		root: "php-wasm-indexed-refinement-entry-ci"
		, support: Object.freeze([
			"php-wasm-indexed-refinement-entry-ci.tap"
			, "php-wasm-indexed-refinement-entry-host.log"
			, "php-wasm-indexed-refinement-entry-runtime.log"
			, "php-wasm-indexed-refinement-entry-input/php-wasm-runtime/runtime.json"
		])
	})
});

const defaultCheckers = Object.freeze({
	entry: (records, selection) => checkPhpWasmRefinementEntryReport(records, selection)
	, callback: (records, selection) => checkPhpWasmCallbackEntryReport(records, selection)
});
const safePath = path => typeof path === "string" && path.length > 0
	&& !path.startsWith("/") && !path.includes("\\") && !/[\0\r\n]/u.test(path)
	&& posix.normalize(path) === path
	&& path.split("/").every(part => part && part !== "." && part !== "..");
const exact = (value, keys, label) => {
	assert.ok(value && typeof value === "object" && !Array.isArray(value), label);
	assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), `${label} fields`);
};
const terminalTap = (source, expectedTest) => {
	assert.ok(source.startsWith("TAP version 13\n"), "artifact TAP header");
	assert.deepEqual(source.split("\n").filter(line => /^ok [0-9]+ - /u.test(line))
		, [`ok 1 - ${expectedTest}`], "artifact TAP selected test");
	const terminal = source.match(/\n1\.\.(\d+)\n# tests (\d+)\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped (\d+)\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
	assert.ok(terminal, "artifact TAP has one passing terminal result");
	assert.equal(Number(terminal[1]), Number(terminal[2]));
	assert.equal(Number(terminal[2]), 1 + Number(terminal[3]));
};
const tapTestName = cells => cells[0].kind === "callback"
	? "instrumented PHP-Wasm callbacks close and execute every selected entry"
	: cells[0].kind === "owned"
		? `instrumented owned PHP-Wasm package closes ${cells[0].family} ${cells[0].route} dispatch and transfer order`
		: `instrumented PHP-Wasm copied package closes ${cells[0].family} ${cells[0].route} compiler entries`;

/**
 * Close the verifier source checkout and supported Node reporter major before
 * any hosted artifact is read.
 *
 * @param producerCommit - Full common producer revision.
 * @param state - Git source-path observations and the active Node version.
 */
export const checkPhpWasmRefinementEntryVerifier = (producerCommit, state) => {
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	exact(state, ["verifierCommit", "modifiedSourcePaths", "untrackedSourcePaths"
		, "nodeVersion"], "hosted verifier state");
	assert.equal(state.verifierCommit, producerCommit
		, "artifact verification must run at the producer revision");
	assert.deepEqual(state.modifiedSourcePaths, [], "verifier source paths are unmodified");
	assert.deepEqual(state.untrackedSourcePaths, [], "verifier source paths contain no untracked files");
	assert.match(state.nodeVersion, /^22\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/u
		, "hosted verifier uses the supported Node 22 TAP reporter");
	return Object.freeze({
		verifierCommit: producerCommit, sourcePathsClean: true
		, sourcePaths: Object.freeze(["src", "tests", "scripts"])
		, nodeVersion: state.nodeVersion, nodeMajor: 22
	});
};

/**
 * Return the exact hosted artifact names in aggregate-verifier order.
 *
 * @param producerCommit - Full producer Git revision.
 */
export const phpWasmRefinementEntryArtifactNames = producerCommit =>
	[...new Set(phpWasmRefinementEntryMatrix.map(item =>
		phpWasmRefinementEntryMatrixLocation(item, producerCommit).artifact))];

/**
 * Re-run every per-route verifier over a closed set of extracted hosted
 * artifacts, bind the retained check output, then close the aggregate matrix.
 *
 * @param producerCommit - Full common producer revision.
 * @param artifacts - Ordered extracted artifacts with exact names and readers.
 * @param verification - Clean source-checkout and Node reporter evidence.
 * @param checkers - Real per-route verifiers unless a unit control injects fakes.
 */
export const summarizePhpWasmRefinementEntryHostedArtifacts = async (
	producerCommit, artifacts, verification, checkers = defaultCheckers
) => {
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	exact(verification, ["verifierCommit", "sourcePathsClean", "sourcePaths"
		, "nodeVersion", "nodeMajor"], "hosted verifier evidence");
	assert.equal(verification.verifierCommit, producerCommit);
	assert.equal(verification.sourcePathsClean, true);
	assert.deepEqual(verification.sourcePaths, ["src", "tests", "scripts"]);
	assert.equal(verification.nodeMajor, 22);
	assert.match(verification.nodeVersion, /^22\./u);
	assert.ok(Array.isArray(artifacts));
	const expectedNames = phpWasmRefinementEntryArtifactNames(producerCommit);
	assert.deepEqual(artifacts.map(item => item.name), expectedNames
		, "artifact order and identity");
	const observations = [], retained = [];
	for(const artifact of artifacts)
	{
		exact(artifact, ["name", "paths", "read"], `artifact ${artifact.name}`);
		assert.ok(Array.isArray(artifact.paths) && artifact.paths.every(safePath)
			, `${artifact.name} paths are closed and relative`);
		assert.deepEqual(artifact.paths, [...new Set(artifact.paths)].sort()
			, `${artifact.name} inventory is unique and sorted`);
		const cells = phpWasmRefinementEntryMatrix.filter(item =>
			phpWasmRefinementEntryMatrixLocation(item, producerCommit).artifact
				=== artifact.name);
		assert.ok(cells.length === 1 || cells.length === 2);
		assert.ok(cells.every(item => item.kind === cells[0].kind));
		const layout = phpWasmRefinementEntryArtifactLayouts[cells[0].kind];
		const locations = cells.map(item => ({
			item, location: phpWasmRefinementEntryMatrixLocation(item, producerCommit)
			, prefix: `${layout.root}/${item.recordPath}/`
			, check: `${layout.root}/${item.recordPath}.check.json`
		}));
		const callbackIndex = cells[0].kind === "callback"
			? `${layout.root}/index.json` : null;
		for(const path of artifact.paths)
		{
			const admitted = layout.support.includes(path) || path === callbackIndex
				|| locations.some(value => path === value.check
					|| path.startsWith(value.prefix));
			assert.ok(admitted, `unexpected artifact path ${artifact.name}/${path}`);
		}
		const bytes = async path => {
			assert.ok(artifact.paths.includes(path), `unlisted artifact read ${path}`);
			const value = await artifact.read(path);
			assert.ok(Buffer.isBuffer(value), path);
			return value;
		};
		for(const path of layout.support)
		{
			assert.ok(artifact.paths.includes(path), `missing ${artifact.name}/${path}`);
			assert.ok((await bytes(path)).length > 0, `empty ${artifact.name}/${path}`);
		}
		const tapPath = layout.support.find(path => path.endsWith(".tap"));
		terminalTap((await bytes(tapPath)).toString(), tapTestName(cells));
		const callbackReports = [];
		for(const { item, location, prefix, check } of locations)
		{
			assert.ok(artifact.paths.includes(check), `missing ${artifact.name}/${check}`);
			const paths = artifact.paths.filter(path => path.startsWith(prefix))
				.map(path => path.slice(prefix.length));
			assert.ok(paths.length > 0, `missing records for ${item.id}`);
			const records = { paths
				, read: path => {
					assert.ok(paths.includes(path), `unlisted record ${path}`);
					return bytes(prefix + path);
				}
			};
			const selection = {
				family: item.family, route: item.route, producerCommit
			};
			const result = await checkers[item.checker](records, selection);
			const checked = await bytes(check);
			assert.equal(checked.toString(), canonicalJson(result)
				, `${item.id} retained check output`);
			observations.push({ cell: item.id
				, ...location, result });
			if(item.kind === "callback") callbackReports.push({
				family: item.family, route: item.route
				, reportSha256: sha256(await bytes(prefix + "report.json"))
				, executions: result.executions
			});
		}
		if(callbackIndex !== null)
		{
			assert.ok(artifact.paths.includes(callbackIndex)
				, `missing ${artifact.name}/${callbackIndex}`);
			const indexBytes = await bytes(callbackIndex);
			assert.equal(indexBytes.toString(), canonicalJson({
				schemaVersion: 1, kind: "php-wasm-callback-entry-installed-v1"
				, producerCommit, reports: callbackReports
			}), `${artifact.name} callback index`);
		}
		retained.push({
			name: artifact.name, files: artifact.paths.length, cells: cells.length
			, tapSha256: sha256(await bytes(tapPath))
		});
	}
	const matrix = checkPhpWasmRefinementEntryMatrix(producerCommit, observations);
	return Object.freeze({
		schemaVersion: 1, kind: "php-wasm-refinement-entry-hosted-v1"
		, producerCommit, verification, artifacts: retained, matrix
	});
};
