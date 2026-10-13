/**
 * Verify complete nominal WIT batch selections and their original terminal TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";

export const nominalSubtypeWitSelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);

/**
 * Refuse skipped, duplicated, failed or incomplete installed acceptance.
 *
 * @param tap - Complete original TAP text.
 * @param route - Independently selected author route.
 * @param mode - Independently selected API shape.
 */
export const assertNominalSubtypeWitTap = (tap, route, mode) => {
	assert.ok(nominalSubtypeWitSelections.some(selection => selection[0] === route && selection[1] === mode));
	assert.ok(tap.startsWith("TAP version 13\n"));
	assert.ok(tap.includes(`\nok 1 - installed nominal WIT packages reproduce and relocate ${route} ${mode}\n`));
	assert.match(tap, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
	assert.doesNotMatch(tap, /^not ok |# SKIP|# TODO|^Bail out!/gmu);
	assert.equal([...tap.matchAll(/^ok /gmu)].length, 1);
};

/**
 * Bind a complete installed result to the original batch input snapshot and terminal record.
 * This launcher did not record its own pre-launch hash or the entire ambient environment.
 *
 * @param options - Original batch record and independent selection.
 * @param options.start - Pre-launch frozen source snapshot.
 * @param options.end - One original terminal selection record.
 * @param options.tap - Complete original combined TAP bytes.
 * @param options.route - Selected author route.
 * @param options.mode - Selected API mode.
 * @param options.producerCommit - Full immutable producer revision.
 */
export const assertNominalSubtypeWitRun = ({ start, end, tap, route, mode, producerCommit }) => {
	assert.deepEqual(Object.keys(start).sort(), ["args", "head", "selections", "sources", "started"]);
	assert.deepEqual(Object.keys(end).sort(), ["bytes", "changed", "code", "finished", "log", "selection", "sha256", "signal", "sourcesChecked", "started"]);
	assert.match(producerCommit, /^[a-f0-9]{40}$/u); assert.equal(start.head, producerCommit);
	assert.deepEqual(start.args, ["--max-old-space-size=3072", "--test", "--test-concurrency=1", "--test-reporter=tap", "tests/helpers/nominal-subtype-wit-installed-tests.mjs"]);
	assert.ok(start.selections.includes(`${route}/${mode}`)); assert.equal(new Set(start.selections).size, start.selections.length);
	assert.ok(start.selections.every(selection => nominalSubtypeWitSelections.some(pair => pair.join("/") === selection)));
	assert.equal(end.selection, `${route}/${mode}`); assert.deepEqual(end.changed, []);
	assert.equal(end.sourcesChecked, Object.keys(start.sources).length); assert.ok(end.sourcesChecked > 0);
	for(const [path, digest] of Object.entries(start.sources))
	{
		assert.ok(/^(?:src|scripts|tests)\//u.test(path) || [".github/workflows/consumer-matrix.yml", "docs/type-surface.v1.json"].includes(path));
		assert.equal(posix.normalize(path), path); assert.ok(!path.includes("\0")); assert.match(digest, /^[a-f0-9]{64}$/u);
	}
	assert.equal(end.code, 0); assert.equal(end.signal, null);
	assert.equal(end.bytes, tap.length); assert.equal(end.sha256, sha256(tap));
	assert.ok(typeof end.log === "string" && posix.isAbsolute(end.log) && posix.normalize(end.log) === end.log);
	assert.ok(end.log.endsWith(`/${route}-${mode}.tap`));
	assert.ok(Number.isFinite(Date.parse(start.started)) && Date.parse(start.started) <= Date.parse(end.started));
	assert.ok(Date.parse(end.started) <= Date.parse(end.finished));
	assertNominalSubtypeWitTap(tap.toString(), route, mode);
};
