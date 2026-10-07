/**
 * Select the CLI package configuration a recorded report was built from, using only
 * the current configuration and its exact recorded source predecessors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "./source-history-digest.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeFinDistributionSource } from "./fin-distribution-source-history.mjs";
import { beforeCombinedLineageSource } from "./combined-lineage-source-history.mjs";
import { beforeDiagnosticFollowupSource } from "./diagnostic-followup-source-history.mjs";
import { beforeNpmFinDiagnosticsSource } from "./npm-fin-diagnostics-source-history.mjs";
import { beforeNativeFinSource } from "./native-fin-source-history.mjs";
import { beforePerlEvidenceRepairSource } from "./perl-evidence-repair-source-history.mjs";
import { beforeCallbackFinSource } from "./callback-fin-source-history.mjs";
import { beforeNominalFinSource } from "./nominal-fin-source-history.mjs";
import { beforeRefinementClosureSource } from "./refinement-closure-source-history.mjs";
import { beforeNestedFinSource } from "./nested-fin-source-history.mjs";

export const cliPackageConfigPath = "config/cli-package.v1.json";
// The ordinary CLI bundle adds only its generated README and manifest.
export const cliPackageExtras = Object.freeze(["README.md", "package.json"]);
// Newest first. Each step reverses only a transition whose current digest was recorded.
const lineage = [
	beforeFinDistributionSource
	, beforeCombinedLineageSource
	, beforeDiagnosticFollowupSource
	, beforeNpmFinDiagnosticsSource
	, beforeNativeFinSource
	, beforePerlEvidenceRepairSource
	, beforeCallbackFinSource
	, beforeNominalFinSource
	, beforeRefinementClosureSource
	, beforeNestedFinSource
	, (path, source) => beforeFinRefinementSource(path, source)
];

/**
 * Current configuration plus every distinct exact predecessor in the recorded lineage.
 *
 * @param readSource - Current or authenticated historical source reader.
 */
export const authenticatedCliPackageConfigs = async (readSource = readFile) => {
	let text = (await readSource(cliPackageConfigPath)).toString();
	const candidates = new Map([[sha256(text), text]]);
	for(const step of lineage)
	{
		const previous = step(cliPackageConfigPath, text);
		text = typeof previous === "string" ? previous : previous.toString();
		if(!candidates.has(sha256(text))) candidates.set(sha256(text), text);
	}
	return [...candidates].map(([digest, source]) => ({ sha256: digest, config: JSON.parse(source) }));
};

/**
 * Choose the single authenticated configuration matching a recorded CLI inventory.
 * The report only selects among recorded configurations; it never introduces one.
 *
 * @param cli - Recorded CLI inventory.
 * @param readSource - Current or authenticated historical source reader.
 * @param root0 - Trusted bundle profile fixed by the calling validator.
 * @param root0.extras - Exact generated or bundled paths beyond the configured sources.
 */
export const selectCliPackageConfig = async (cli, readSource = readFile, { extras = cliPackageExtras } = {}) => {
	const recorded = [...(cli?.files ?? []).map(file => file.path)].sort();
	const candidates = await authenticatedCliPackageConfigs(readSource);
	const matching = candidates.filter(({ config }) =>
		cli?.package?.name === config.name && cli?.package?.version === config.version
		&& cli?.sourceDateEpoch === config.sourceDateEpoch
		&& JSON.stringify(recorded) === JSON.stringify([...config.files, ...extras].sort()));
	// With no match, report the recorded list against the current closure as before.
	if(matching.length === 0) assert.deepEqual(recorded, [...candidates[0].config.files, ...extras].sort(), "recorded CLI inventory must match exactly one authenticated configuration");
	assert.equal(matching.length, 1, "recorded CLI inventory must match exactly one authenticated configuration");
	return matching[0].config;
};

/**
 * Rewrite a recorded CLI inventory to another authenticated configuration's closure.
 * Recorded entries stay as recorded, files only the target ships are added at
 * current bytes, and the rest are dropped, so selection moves only between recorded configurations.
 *
 * @param cli - Recorded CLI inventory.
 * @param config - Authenticated configuration whose closure the result must select.
 * @param readSource - Reader for target files the recorded inventory lacks.
 * @param root0 - Trusted bundle profile fixed by the calling validator.
 * @param root0.extras - Exact generated or bundled paths beyond the configured sources.
 */
export const retargetCliInventory = async (cli, config, readSource = readFile, { extras = cliPackageExtras } = {}) => {
	const wanted = new Set([...config.files, ...extras]);
	const files = cli.files.filter(file => wanted.has(file.path));
	for(const path of config.files.filter(path => !files.some(file => file.path === path)))
	{
		const bytes = await readSource(path);
		files.push({ path, bytes: bytes.length, sha256: sha256(bytes), mode: 0o644 });
	}
	return { ...cli, files: files.sort((left, right) => left.path.localeCompare(right.path)) };
};
