/**
 * Authenticate the four hosted managed/WIT callback-Fin artifacts and select
 * the exact producer, checker and archiver sources retained with them.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import {
	inspectCheckedRecordValueIndexHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";

export const callbackFinRemainingHostedEvidenceDirectory
	= "docs/evidence/callback-fin-remaining-hosted-20261028";

export const callbackFinRemainingHostedLanes = Object.freeze([
	Object.freeze({
		id: "dotnet", profiles: Object.freeze(["dotnet"])
		, jobName: "Checked Fin callbacks in dotnet"
	})
	, Object.freeze({
		id: "jvm", profiles: Object.freeze(["java", "kotlin"])
		, jobName: "Checked Fin callbacks in jvm"
	})
	, Object.freeze({
		id: "php-native", profiles: Object.freeze(["php-native"])
		, jobName: "Checked Fin callbacks in php-native"
	})
	, Object.freeze({
		id: "wit-wasi", profiles: Object.freeze(["wit-wasi"])
		, jobName: "Checked Fin callbacks in wit-wasi"
	})
]);

const sourceRoles = Object.freeze({
	producer: Object.freeze([
		".github/workflows/callback-checked-record-remaining.yml"
		, "scripts/run-callback-fin-remaining-ci.sh"
		, "tests/callback-fin-remaining-installed.test.mjs"
		, "tests/helpers/callback-fin-fixture.mjs"
		, "tests/helpers/callback-fin-packages.mjs"
		, "tests/helpers/callback-fin-remaining-ci.mjs"
		, "tests/helpers/callback-fin-retained-packages.mjs"
	])
	, checker: Object.freeze([
		"scripts/check-callback-fin-remaining-ci.mjs"
		, "tests/helpers/callback-fin-remaining-ci.mjs"
		, "tests/helpers/callback-fin-retained-packages.mjs"
		, "tests/helpers/callback-checked-record-retained-packages.mjs"
		, "tests/helpers/package-set.mjs"
		, "src/capsule/node.mjs"
	])
	, archiver: Object.freeze([
		"scripts/archive-callback-fin-remaining-evidence.mjs"
		, "tests/helpers/callback-fin-remaining-hosted-archive.mjs"
		, "tests/helpers/checked-record-value-index-hosted-archive.mjs"
		, "tests/helpers/callback-fin-remaining-ci.mjs"
		, "tests/helpers/callback-fin-retained-packages.mjs"
		, "src/build/native-artifacts.mjs"
		, "src/capsule/node.mjs"
	])
});

/**
 * Parse the one closed hosted input root.
 *
 * @param args - Command arguments after the script name.
 */
export const parseCallbackFinRemainingHostedArchiveArgs = args => {
	const usage = "Usage: archive-callback-fin-remaining-evidence.mjs --input-root /absolute/hosted-input";
	assert.deepEqual(Array.isArray(args) ? args.length : null, 2, usage);
	assert.equal(args[0], "--input-root", usage);
	assert.ok(typeof args[1] === "string" && args[1].length > 0
		&& !/[\0\r\n]/u.test(args[1]) && isAbsolute(args[1])
		&& resolve(args[1]) === args[1], usage);
	return args[1];
};

/**
 * Select the four canonical files inspected for one lane.
 *
 * @param root - Canonical absolute hosted input root.
 * @param lane - Closed lane descriptor.
 */
export const callbackFinRemainingHostedLaneInputs = (root, lane) => {
	assert.ok(callbackFinRemainingHostedLanes.includes(lane));
	const prefix = `${root}/${lane.id}`;
	return {
		"artifact-zip": `${prefix}/artifact.zip`
		, "run-json": `${root}/run.json`
		, "job-json": `${prefix}/job.json`
		, "artifact-json": `${prefix}/artifact.json`
	};
};

/**
 * Bind one original ZIP to its successful matrix job.
 *
 * @param selected - Four canonical absolute hosted input paths.
 * @param lane - Closed lane descriptor.
 */
export const inspectCallbackFinRemainingHostedArtifact = (
	selected, lane
) => {
	assert.ok(callbackFinRemainingHostedLanes.includes(lane));
	return inspectCheckedRecordValueIndexHostedArtifact(selected, {
		workflow: ".github/workflows/callback-checked-record-remaining.yml"
		, jobName: lane.jobName
		, artifactPrefix: `callback-fin-remaining-${lane.id}`
	});
};

/**
 * Select the closed source snapshot for every evidence-producing role.
 *
 * @param revisions - Exact producer, checker and archiver commits.
 */
export const callbackFinRemainingHostedSources = revisions => {
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
export const callbackFinRemainingHostedOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.ok(typeof path === "string" && path.length > 0
		&& !path.startsWith("/") && !path.includes("\\")
		&& path.split("/").every(part => part && part !== "." && part !== ".."));
	return execFileSync("git", ["show", `${revision}:${path}`], {
		maxBuffer: 64 * 1024 ** 2
	});
};

/**
 * Require the hosted checker source to be the source replayed by the archiver.
 *
 * @param revision - Exact hosted checker commit.
 */
export const assertCallbackFinRemainingHostedChecker = async revision => {
	for(const path of sourceRoles.checker)
		assert.deepEqual(await readFile(path)
			, callbackFinRemainingHostedOriginal(revision, path)
			, `Current checker differs from hosted checker: ${path}`);
};
