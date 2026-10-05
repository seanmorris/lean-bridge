/**
 * Check additive source inventories and CI checks without changing old receipts.
 * Neither existing build sources nor existing commands may change through this path.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertTestManifestRegistration } from "./source-registration-upgrade.mjs";
import { assertNativeAssetTamperSourceUpdate } from "./native-asset-tamper-history.mjs";
import { assertInventoryOrderVerification, reverseInventoryFileOrder } from "./source-inventory-order.mjs";
import { beforeWitPackageIntegration } from "./wit-package-source-history.mjs";

const metadata = new Set(["package.json", "config/cli-package.v1.json", "config/checked-javascript.json", "nix/perl-engine-source-boundary.json", ".github/workflows/consumer-matrix.yml", ".github/workflows/perl-consumer.yml"]);
const sourcePath = /^src\/(?:backends|build|release)\/[a-z0-9/-]+\.mjs$/;
const checkerImport = 'import { assertSourceRegistrationUpdate } from "./source-registration-history.mjs";\n';
const checkerCall = '\tif(await assertSourceRegistrationUpdate(path, source, expected)) return;\n';
const allowedLine = (path, line) => {
	if(typeof line !== "string" || line.includes("\n") || line.includes("\r")) return false;
	if(path === ".github/workflows/consumer-matrix.yml" || path === ".github/workflows/perl-consumer.yml") return [
		/^ {10}(?:LEAN_BRIDGE_[A-Z0-9_]+_TEST=1 )+node --test tests\/[a-z0-9-]+\.test\.mjs$/
		, /^ {10}test -s build\/recursive\/[a-z0-9-]+\.json$/
		, /^ {12}build\/recursive\/[a-z0-9-]+\.json$/
		, /^ {14}consumer_command="\$consumer_command && (?:LEAN_BRIDGE_[A-Z0-9_]+_TEST=1 )+node --test tests\/[a-z0-9-]+\.test\.mjs"$/
	].some(pattern => pattern.test(line))
		|| (path === ".github/workflows/consumer-matrix.yml" && line === '          export CARGO_HOME="${CARGO_HOME:-$HOME/.cargo}"');
	if(path === "config/checked-javascript.json")
	{
		if(!/^\t\t\{.*\},$/.test(line)) return false;
		const item = JSON.parse(line.trim().slice(0, -1));
		return Object.keys(item).sort().join(",") === "classification,path"
			&& item.classification === "strict-migration-backlog" && sourcePath.test(item.path);
	}
	if(!/^ {4}"[^"\\]+",$/.test(line)) return false;
	return sourcePath.test(JSON.parse(line.trim().slice(0, -1)));
};

/**
 * Reverse only allowed unique additions, checking every previous source hash.
 *
 * @param path - Exact source inventory or CI workflow path.
 * @param source - Current complete source text.
 * @param expected - Immutable receipt's original SHA-256.
 * @param updates - Append-only addition records.
 */
export const verifyAddedSourceRegistrations = (path, source, expected, updates) => {
	source = beforeWitPackageIntegration(path, source, expected);
	assert.ok(metadata.has(path), `Not an additive source inventory: ${path}`);
	const seen = new Set();
	while(sha256(source) !== expected)
	{
		const current = sha256(source);
		assert.ok(!seen.has(current), "Cyclic source registration lineage"); seen.add(current);
		const candidates = updates.filter(item => item.path === path && item.currentSha256 === current);
		assert.equal(candidates.length, 1, "Missing or ambiguous source registration lineage");
		const update = candidates[0];
		if(update.kind === "reorder-files")
		{
			source = reverseInventoryFileOrder(path, source, update);
			continue;
		}
		assert.ok(Array.isArray(update.addedLines) && update.addedLines.length > 0);
		assert.equal(new Set(update.addedLines).size, update.addedLines.length);
		for(const line of update.addedLines)
		{
			assert.ok(allowedLine(path, line), `Not an additive registration: ${line}`);
			assert.equal(source.split(line + "\n").length, 2, "Registration must occur exactly once");
			source = source.replace(line + "\n", "");
		}
		assert.equal(sha256(source), update.previousSha256, "Source registration changed existing content");
	}
};

/**
 * Return false for production source files. Their original hash remains required.
 * The caller's two-line verification change is itself exactly reversible.
 *
 * @param path - Recorded source path.
 * @param source - Complete current source text.
 * @param expected - Immutable baseline digest.
 */
export const assertSourceRegistrationUpdate = async (path, source, expected) => {
	source = beforeWitPackageIntegration(path, source, expected);
	if(assertInventoryOrderVerification(path, source, expected)) return true;
	if(await assertNativeAssetTamperSourceUpdate(path, source, expected)) return true;
	if(await assertTestManifestRegistration(path, source, expected)) return true;
	if(path === "tests/helpers/test-registration-history.mjs")
	{
		const integration = 'import { assertPerlGraphSourceTransition } from "./native-perl-graph-regression.mjs";\n';
		if(source.includes(integration))
		{
			for(const addition of [integration, '\tif(await assertPerlGraphSourceTransition(path, source, expected)) return;\n'])
			{
				assert.equal(source.split(addition).length, 2, "Exactly one installed-regression verifier addition");
				source = source.replace(addition, "");
			}
			if(sha256(source) === expected) return true;
		}
		for(const addition of [checkerImport, checkerCall])
		{
			assert.equal(source.split(addition).length, 2, "Exactly one additive-source verifier change");
			source = source.replace(addition, "");
		}
		assert.equal(sha256(source), expected, path); return true;
	}
	if(!metadata.has(path)) return false;
	const history = JSON.parse(await readFile("docs/evidence/recursive-npm-source-lineage-20260922.json"));
	verifyAddedSourceRegistrations(path, source, expected, history.sourceRegistrationUpdates);
	return true;
};
