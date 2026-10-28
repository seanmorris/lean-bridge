/**
 * Authenticate one hosted reviewed callback-Fin browser artifact and select
 * the exact producer, checker and archiver sources retained with it.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
	inspectCheckedRecordValueIndexHostedArtifact
	, parseCheckedRecordValueIndexHostedArchiveArgs
} from "./checked-record-value-index-hosted-archive.mjs";

export const reviewedCallbackFinBrowserHostedEvidenceDirectory
	= "docs/evidence/reviewed-callback-fin-browser-hosted-20261028";

const sourceRoles = Object.freeze({
	producer: Object.freeze([
		".github/workflows/callback-checked-record-browser.yml"
		, "scripts/run-reviewed-callback-fin-browser-ci.sh"
		, "tests/reviewed-callback-fin.test.mjs"
		, "tests/helpers/reviewed-callback-fin-browser-ci.mjs"
		, "tests/helpers/reviewed-callback-fin-consumer.mjs"
		, "tests/helpers/reviewed-callback-fin-fixture.mjs"
		, "tests/helpers/reviewed-callback-fin-guards.mjs"
	])
	, checker: Object.freeze([
		"scripts/check-reviewed-callback-fin-browser-ci.mjs"
		, "tests/helpers/reviewed-callback-fin-browser-ci.mjs"
		, "tests/helpers/reviewed-callback-fin-consumer.mjs"
		, "tests/helpers/reviewed-callback-fin-fixture.mjs"
		, "src/binding-ir/canonical.mjs"
		, "src/capsule/node.mjs"
	])
	, archiver: Object.freeze([
		"scripts/archive-reviewed-callback-fin-browser-evidence.mjs"
		, "tests/helpers/reviewed-callback-fin-browser-hosted-archive.mjs"
		, "tests/helpers/checked-record-value-index-hosted-archive.mjs"
		, "tests/helpers/reviewed-callback-fin-browser-ci.mjs"
		, "src/build/native-artifacts.mjs"
		, "src/capsule/node.mjs"
	])
});

/**
 * Select the closed source snapshot for every evidence-producing role.
 *
 * @param revisions - Exact producer, checker and archiver commits.
 */
export const reviewedCallbackFinBrowserHostedSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort()
		, ["archiver", "checker", "producer"].sort());
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	return Object.entries(sourceRoles).flatMap(([role, paths]) => paths.map(
		path => Object.freeze({ role, path, revision: revisions[role] })
	));
};

/**
 * Read one exact Git object without consulting the mutable working tree.
 *
 * @param revision - Exact Git commit.
 * @param path - Repository-relative source path.
 */
export const reviewedCallbackFinBrowserHostedOriginal = (
	revision, path
) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.ok(typeof path === "string" && path.length > 0
		&& !path.startsWith("/") && !path.includes("\\")
		&& path.split("/").every(part => part && part !== "." && part !== ".."));
	return execFileSync("git", ["show", `${revision}:${path}`], {
		maxBuffer: 64 * 1024 ** 2
	});
};

/**
 * Reject ambiguous archiver arguments.
 *
 * @param args - Command arguments after the script name.
 */
export const parseReviewedCallbackFinBrowserHostedArchiveArgs = args =>
	parseCheckedRecordValueIndexHostedArchiveArgs(args
		, "Usage: archive-reviewed-callback-fin-browser-evidence.mjs --artifact-zip /absolute/artifact.zip --run-json /absolute/run.json --job-json /absolute/job.json --artifact-json /absolute/artifact.json");

/**
 * Bind the original ZIP to the exact successful recurring workflow job.
 *
 * @param selected - Four canonical absolute hosted input paths.
 */
export const inspectReviewedCallbackFinBrowserHostedArtifact = selected =>
	inspectCheckedRecordValueIndexHostedArtifact(selected, {
		workflow: ".github/workflows/callback-checked-record-browser.yml"
		, jobName: "Callback checked records in Node and three browsers"
		, artifactPrefix: "callback-checked-record-browser"
	});

/**
 * Require the hosted checker source to be the source replayed by the archiver.
 *
 * @param revision - Exact hosted checker commit.
 */
export const assertReviewedCallbackFinBrowserHostedChecker = async (
	revision
) => {
	for(const path of sourceRoles.checker)
		assert.deepEqual(await readFile(path)
			, reviewedCallbackFinBrowserHostedOriginal(revision, path)
			, `Current checker differs from hosted checker: ${path}`);
};
