/**
 * Close one downloaded hosted nominal entry-measurement artifact before promotion. The
 * per-selection checkers authenticate each route and mode from its original records; this
 * summary additionally requires the complete fixed matrix, exact artifact closure, the
 * producer revision named by the artifact, each selection's own retained check output and
 * the measured/unmeasured split. It never fabricates a record or reads outside the artifact.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkNominalSubtypeEntryNativeCiRecords } from "./nominal-subtype-entry-native-ci-report.mjs";
import { checkNominalSubtypeEntryBrowserCiRecords } from "./nominal-subtype-entry-browser-ci-report.mjs";

export const nominalSubtypeEntryHostedRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nominalSubtypeEntryHostedModes = Object.freeze(["full", "result-only"]);

// The exact upload of each workflow: its CI tree plus the lane-level logs beside it.
export const nominalSubtypeEntryHostedLanes = Object.freeze({
	native: Object.freeze({
		root: "nominal-subtype-entry-native-ci"
		, logs: Object.freeze(["nominal-subtype-entry-native-toolchain.log"])
		, selectionFiles: Object.freeze(["check.log", "run.tap"])
		, observed: "dispatchObserved"
	})
	, browser: Object.freeze({
		root: "nominal-subtype-entry-browser-ci"
		, logs: Object.freeze(["nominal-subtype-entry-browser-engine.log", "nominal-subtype-entry-browser-runtime.log"])
		, selectionFiles: Object.freeze(["check.log", "run.tap", "runtime-after.json", "runtime-before.json"])
		, observed: "entryObserved"
	})
});

const defaultCheckers = Object.freeze({
	native: (options, original) => checkNominalSubtypeEntryNativeCiRecords(options, original)
	, browser: (options, original) => checkNominalSubtypeEntryBrowserCiRecords(options, original)
});

const safePath = path => typeof path === "string" && path.length > 0
	&& !path.startsWith("/") && !path.includes("\\") && !/[\0\r\n]/u.test(path)
	&& posix.normalize(path) === path
	&& path.split("/").every(part => part && part !== "." && part !== "..");

/**
 * Authenticate a complete successful hosted artifact and return its promotion summary.
 *
 * @param lane - "native" (C/C++ dispatch) or "browser" (npm/browser entry).
 * @param artifact - Downloaded artifact contents.
 * @param artifact.name - Artifact name as uploaded by the workflow.
 * @param artifact.producer - Full producer revision the hosted run checked out.
 * @param artifact.paths - Complete sorted regular-file inventory of the artifact.
 * @param artifact.read - Closed reader of one artifact-relative path.
 * @param checkers - Per-selection checkers; the real record checkers unless a control injects others.
 */
export const summarizeNominalSubtypeEntryHostedRun = async (lane, artifact, checkers = defaultCheckers) => {
	const { name, producer, paths, read } = artifact;
	const layout = nominalSubtypeEntryHostedLanes[lane];
	assert.ok(layout && Object.hasOwn(nominalSubtypeEntryHostedLanes, lane), `unknown lane ${lane}`);
	assert.match(producer, /^[a-f0-9]{40}$/u);
	assert.equal(name, `nominal-subtype-entry-${lane}-${producer}`, "artifact name binds the producer revision");
	assert.ok(Array.isArray(paths) && paths.every(safePath), "artifact paths are closed and relative");
	assert.deepEqual(paths, [...new Set(paths)].sort(), "artifact inventory is unique and sorted");
	const expectedTop = new Set(layout.logs);
	const selections = [];
	for(const route of nominalSubtypeEntryHostedRoutes) for(const mode of nominalSubtypeEntryHostedModes)
		selections.push({ route, mode, prefix: `${layout.root}/${route}/${mode}/` });
	for(const path of paths)
	{
		if(expectedTop.has(path)) continue;
		const selection = selections.find(item => path.startsWith(item.prefix));
		assert.ok(selection, `unexpected artifact path ${path}`);
		const rest = path.slice(selection.prefix.length);
		assert.ok(layout.selectionFiles.includes(rest)
			|| rest.startsWith(`records/${selection.route}/${selection.mode}/`), `unexpected selection path ${path}`);
	}
	for(const log of layout.logs) assert.ok(paths.includes(log), `missing ${log}`);
	const bytes = async path => {
		assert.ok(paths.includes(path), `unlisted read ${path}`);
		return Buffer.from(await read(path));
	};
	const results = [];
	for(const { route, mode, prefix } of selections)
	{
		for(const file of layout.selectionFiles) assert.ok(paths.includes(prefix + file), `missing ${prefix + file}`);
		const recordPrefix = `${prefix}records/${route}/${mode}/`;
		const recordPaths = paths.filter(path => path.startsWith(recordPrefix)).map(path => path.slice(recordPrefix.length));
		assert.ok(recordPaths.length > 0, `missing records for ${route} ${mode}`);
		const tap = (await bytes(prefix + "run.tap")).toString();
		const readRecord = path => {
			assert.ok(recordPaths.includes(path), `unlisted record ${path}`);
			return bytes(recordPrefix + path);
		};
		const original = { tap, paths: recordPaths, read: readRecord };
		const options = { route, mode, producer, directory: `/artifact/${recordPrefix}`, tap: `/artifact/${prefix}run.tap` };
		if(lane === "native") options.floor = "2.38";
		else
		{
			const before = await bytes(prefix + "runtime-before.json");
			assert.deepEqual(await bytes(prefix + "runtime-after.json"), before, `${route} ${mode} runtime drift`);
			original.runtime = JSON.parse(before);
			options.runtime = `/artifact/${prefix}runtime-before.json`;
		}
		const checked = await checkers[lane](options, original);
		// The hosted check printed exactly this canonical result; an edited or partial log is not accepted.
		const check = await bytes(prefix + "check.log");
		assert.equal(check.toString(), canonicalJson(checked), `${route} ${mode} check output`);
		assert.equal(checked[layout.observed], mode === "full", `${route} ${mode} measured split`);
		results.push({
			route, mode, observed: mode === "full"
			, recordCount: recordPaths.length
			, tapSha256: sha256(Buffer.from(tap))
			, checkSha256: sha256(check)
		});
	}
	return {
		schemaVersion: 1, kind: `nominal-subtype-entry-${lane}-hosted-v1`
		, lane, producer, artifact: name, selections: results
	};
};
