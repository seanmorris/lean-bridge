/**
 * Restore measured metadata after additive recursive WIT development registration.
 * Executed fixtures, compiled receipts and production logic are not changeable here.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { beforeWitPackageIntegration } from "./wit-package-source-history.mjs";

const recordPath = "docs/evidence/wit-recursive-registration-20260924.json";
const lineagePath = "docs/evidence/recursive-npm-source-lineage-20260922.json";
const metadata = new Set(["package.json", "config/cli-package.v1.json", "config/checked-javascript.json", "nix/perl-engine-source-boundary.json", "src/adoption/test-profiles.mjs", ".github/workflows/consumer-matrix.yml"]);
const checkers = new Set(["tests/helpers/recursive-acceptance-updates.mjs", "tests/helpers/recursive-documentation-history.mjs"]);

/**
 * Reverse an exact metadata addition or named checker edit, never production code.
 *
 * @param source - Entire current text, including any unrelated changes.
 * @param update - Reviewed complete before/after digests and reversible changes.
 */
export const reverseWitGraphRegistration = (source, update) => {
	source = beforeWitPackageIntegration(update.path, source, update.currentSha256);
	assert.ok(metadata.has(update.path) || checkers.has(update.path) || update.path === lineagePath, "Not WIT registration metadata");
	assert.equal(sha256(source), update.currentSha256, update.path);
	if(update.path === lineagePath)
	{
		const history = JSON.parse(source);
		for(const key of ["registrationUpdates", "sourceRegistrationUpdates"])
		{
			assert.ok(update.additions[key].length > 0);
			for(const addition of update.additions[key])
			{
				const matches = history[key].filter(entry => canonicalJson(entry) === canonicalJson(addition));
				assert.equal(matches.length, 1, "Exactly one added registration history item");
				history[key] = history[key].filter(entry => canonicalJson(entry) !== canonicalJson(addition));
			}
		}
		source = JSON.stringify(history, null, 2) + "\n";
	}
	else if(metadata.has(update.path))
	{
		assert.ok(update.addedLines.length > 0);
		assert.equal(new Set(update.addedLines).size, update.addedLines.length);
		for(const line of update.addedLines)
		{
			assert.ok(!line.includes("\n") && !line.includes("\r"));
			assert.match(line, /copied-graph-|wit-copied-graph-/);
			assert.equal(source.split(line + "\n").length, 2, "Exactly one WIT registration addition");
			source = source.replace(line + "\n", "");
		}
	}
	else
	{
		assert.ok(update.edits.length > 0);
		for(const edit of update.edits.toReversed())
		{
			assert.ok(typeof edit.current === "string" && edit.current.length > 0 && typeof edit.previous === "string");
			assert.equal(source.split(edit.current).length, 2, "Exactly one WIT registration checker edit");
			source = source.replace(edit.current, edit.previous);
		}
	}
	assert.equal(sha256(source), update.previousSha256, update.path);
	return source;
};

/**
 * Restore only a known predecessor. Other paths stay subject to their original
 * verifier. This function supplies no substitute for a compiled execution gate.
 *
 * @param path - Exact source path.
 * @param source - Complete current file contents.
 * @param expected - Original digest requested by the historical verifier.
 */
export const beforeWitGraphRegistration = (path, source, expected) => {
	source = beforeWitPackageIntegration(path, source, expected);
	if(sha256(source) === expected || !(metadata.has(path) || checkers.has(path) || path === lineagePath)) return source;
	const record = JSON.parse(readFileSync(recordPath, "utf8"));
	const updates = record.updates.filter(update => update.path === path && update.previousSha256 === expected);
	if(!updates.length) return source;
	assert.equal(updates.length, 1, "One WIT registration predecessor");
	return reverseWitGraphRegistration(source, updates[0]);
};
