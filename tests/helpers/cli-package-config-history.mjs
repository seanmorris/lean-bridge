/**
 * Select the CLI package configuration a recorded report was built from, using only
 * the current configuration and its exact recorded source predecessors.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeDiagnosticFollowupSource } from "./diagnostic-followup-source-history.mjs";
import { beforeNpmFinDiagnosticsSource } from "./npm-fin-diagnostics-source-history.mjs";
import { beforeNativeFinSource } from "./native-fin-source-history.mjs";
import { beforePerlEvidenceRepairSource } from "./perl-evidence-repair-source-history.mjs";
import { beforeCallbackFinSource } from "./callback-fin-source-history.mjs";
import { beforeNominalFinSource } from "./nominal-fin-source-history.mjs";
import { beforeRefinementClosureSource } from "./refinement-closure-source-history.mjs";
import { beforeNestedFinSource } from "./nested-fin-source-history.mjs";

export const cliPackageConfigPath = "config/cli-package.v1.json";
// Newest first. Each step reverses only a transition whose current digest was recorded.
const lineage = [
	beforeDiagnosticFollowupSource
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
 */
export const selectCliPackageConfig = async (cli, readSource = readFile) => {
	const recorded = [...(cli?.files ?? []).map(file => file.path)].sort();
	const matching = (await authenticatedCliPackageConfigs(readSource)).filter(({ config }) =>
		cli?.package?.name === config.name && cli?.package?.version === config.version
		&& cli?.sourceDateEpoch === config.sourceDateEpoch
		&& JSON.stringify(recorded) === JSON.stringify([...config.files, "README.md", "package.json"].sort()));
	assert.equal(matching.length, 1, "recorded CLI inventory must match exactly one authenticated configuration");
	return matching[0].config;
};
