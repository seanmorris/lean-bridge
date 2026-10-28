/**
 * Authenticate hosted Python/Ruby/Rust and Perl callback-Fin artifacts and
 * select the exact producer, checker and archiver sources retained with them.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, posix, resolve } from "node:path";
import {
	inspectCheckedRecordValueIndexHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";
import { moduleSpecifiers } from "./module-closure.mjs";

export const callbackFinNativeHostedEvidenceDirectory
	= "docs/evidence/callback-fin-native-hosts-hosted-20261028";
export const callbackFinNativeHostedLanes = Object.freeze([
	Object.freeze({
		id: "languages", profiles: Object.freeze(["python", "ruby", "rust"])
		, workflow: ".github/workflows/callback-checked-record-languages.yml"
		, jobName: "Checked Fin callbacks in three installed language packages"
		, artifactPrefix: "callback-fin-languages"
		, outputRoot: "callback-fin-languages-ci"
		, logs: Object.freeze(["callback-fin-languages-toolchain.log"])
	})
	, Object.freeze({
		id: "perl", profiles: Object.freeze(["perl"])
		, workflow: ".github/workflows/callback-checked-record-perl.yml"
		, jobName: "Checked Fin callbacks on all four Perl ABIs"
		, artifactPrefix: "callback-fin-perl"
		, outputRoot: null, logs: Object.freeze([])
	})
]);

const sourceEntries = Object.freeze({
	producer: Object.freeze([
		".github/workflows/callback-checked-record-languages.yml"
		, ".github/workflows/callback-checked-record-perl.yml"
		, "scripts/run-callback-fin-languages-ci.sh"
		, "scripts/run-callback-fin-perl-ci.sh"
		, "tests/callback-fin-language-installed.test.mjs"
		, "tests/callback-fin-perl-installed.test.mjs"
		, "tests/helpers/callback-fin-language-ci.mjs"
		, "tests/helpers/callback-fin-perl-ci.mjs"
		, "tests/helpers/callback-fin-fixture.mjs"
		, "tests/helpers/callback-fin-packages.mjs"
		, "tests/helpers/callback-fin-retained-packages.mjs"
	])
	, checker: Object.freeze([
		"scripts/check-callback-fin-languages-ci.mjs"
		, "scripts/check-callback-fin-perl-ci.mjs"
		, "tests/helpers/callback-fin-language-ci.mjs"
		, "tests/helpers/callback-fin-perl-ci.mjs"
		, "tests/helpers/callback-fin-retained-packages.mjs"
		, "tests/helpers/callback-checked-record-retained-packages.mjs"
		, "tests/helpers/package-set.mjs"
		, "src/capsule/node.mjs"
	])
	, archiver: Object.freeze([
		"scripts/archive-callback-fin-native-hosted.mjs"
		, "tests/helpers/callback-fin-native-hosted-archive.mjs"
		, "tests/helpers/callback-fin-native-hosted-evidence.mjs"
		, "tests/helpers/checked-record-value-index-hosted-archive.mjs"
		, "tests/helpers/callback-fin-language-ci.mjs"
		, "tests/helpers/callback-fin-perl-ci.mjs"
		, "tests/helpers/callback-fin-retained-packages.mjs"
		, "src/build/native-artifacts.mjs"
		, "src/capsule/node.mjs"
	])
});

const sourceCache = new Map();

const original = (revision, path) => {
	const key = `${revision}:${path}`;
	if(!sourceCache.has(key)) sourceCache.set(key, execFileSync(
		"git", ["show", key], { maxBuffer: 256 * 1024 ** 2 }
	));
	return sourceCache.get(key);
};

const closure = (revision, entries) => {
	const paths = new Set();
	const visit = path => {
		if(paths.has(path)) return;
		const bytes = original(revision, path);
		paths.add(path);
		if(!/\.[cm]?js$/u.test(path)) return;
		for(const specifier of moduleSpecifiers(bytes.toString(), path))
		{
			const joined = posix.normalize(posix.join(
				posix.dirname(path), specifier));
			visit(extname(joined) === "" ? `${joined}.mjs` : joined);
		}
	};
	for(const entry of entries) visit(entry);
	return [...paths].sort();
};

/**
 * Parse the one closed hosted-input directory.
 *
 * @param args - Command arguments after the script name.
 */
export const parseCallbackFinNativeHostedArchiveArgs = args => {
	const usage = "Usage: archive-callback-fin-native-hosted.mjs --input-root /absolute/hosted-input";
	assert.deepEqual(Array.isArray(args) ? args.length : null, 2, usage);
	assert.equal(args[0], "--input-root", usage);
	assert.ok(typeof args[1] === "string" && args[1].length > 0
		&& !/[\0\r\n]/u.test(args[1]) && isAbsolute(args[1])
		&& resolve(args[1]) === args[1], usage);
	return args[1];
};

/**
 * Select the original hosted inputs for one lane.
 *
 * @param root - Canonical hosted-input directory.
 * @param lane - Closed lane descriptor.
 */
export const callbackFinNativeHostedInputs = (root, lane) => {
	assert.ok(callbackFinNativeHostedLanes.includes(lane));
	const prefix = `${root}/${lane.id}`;
	return {
		"artifact-zip": `${prefix}/artifact.zip`
		, "run-json": `${prefix}/run.json`
		, "job-json": `${prefix}/job.json`
		, "artifact-json": `${prefix}/artifact.json`
	};
};

/**
 * Bind one artifact to its successful workflow and lane.
 *
 * @param selected - Original ZIP and API records.
 * @param lane - Closed lane descriptor.
 */
export const inspectCallbackFinNativeHostedArtifact = (selected, lane) => {
	assert.ok(callbackFinNativeHostedLanes.includes(lane));
	return inspectCheckedRecordValueIndexHostedArtifact(selected, {
		workflow: lane.workflow, jobName: lane.jobName
		, artifactPrefix: lane.artifactPrefix
	});
};

/**
 * Select the closed source snapshot for every evidence-producing role.
 *
 * @param revisions - Exact role-to-commit map.
 */
export const callbackFinNativeHostedSources = revisions => {
	assert.deepEqual(Object.keys(revisions).sort()
		, ["archiver", "checker", "producer"].sort());
	for(const revision of Object.values(revisions))
		assert.match(revision, /^[a-f0-9]{40}$/u);
	return Object.entries(sourceEntries).flatMap(
		([role, entries]) => closure(revisions[role], entries).map(path =>
			Object.freeze({ role, path, revision: revisions[role] }))
	);
};

/**
 * Read one exact immutable Git object.
 *
 * @param revision - Exact source commit.
 * @param path - Repository-relative source path.
 */
export const callbackFinNativeHostedOriginal = (revision, path) => {
	assert.match(revision, /^[a-f0-9]{40}$/u);
	assert.ok(typeof path === "string" && path.length > 0
		&& !path.startsWith("/") && !path.includes("\\")
		&& path.split("/").every(part => part && part !== "." && part !== ".."));
	return original(revision, path);
};

/**
 * Require the local checker bytes to equal the hosted checker bytes.
 *
 * @param revision - Exact hosted producer/checker commit.
 */
export const assertCallbackFinNativeHostedChecker = async revision => {
	for(const path of closure(revision, sourceEntries.checker))
		assert.deepEqual(await readFile(path)
			, callbackFinNativeHostedOriginal(revision, path)
			, `Current checker differs from hosted checker: ${path}`);
};
