/**
 * Closed same-run inputs for the complete installed HostNull matrix.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import {
	inspectCheckedRecordValueIndexHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";

export const hostNullCompleteWorkflow
	= ".github/workflows/consumer-matrix.yml";
export const hostNullCompleteRoutes = Object.freeze([
	"ordinary", "reviewed"
]);
export const hostNullCompletePositions = Object.freeze([
	"parameter", "result", "field", "callback-parameter", "callback-result"
]);

const lane = (id, profiles, jobName, artifactPrefix) => Object.freeze({
	id, profiles: Object.freeze(profiles), workflow: hostNullCompleteWorkflow
	, jobName, artifactPrefix
});

export const hostNullCompleteHostedLanes = Object.freeze([
	lane("javascript-browser", [
		"node-javascript", "node-typescript", "browser-javascript"
		, "browser-react", "browser-worker"
	], "Node and browser npm consumers", "host-null-node-browser")
	, lane("php-native", ["php-native"], "Native PHP", "host-null-php-native")
	, lane("php-wasm", ["php-wasm"], "PHP-Wasm corpus (values-graph)"
		, "host-null-php-wasm")
	, lane("dotnet", ["dotnet"], "Managed consumer (dotnet)"
		, "host-null-managed-dotnet")
	, lane("jvm", ["java", "kotlin"], "Managed consumer (jvm)"
		, "host-null-managed-jvm")
	, lane("scripting", ["perl", "python", "ruby"]
		, "Perl / Perl XS (5.38.2-threaded)", "host-null-scripting")
	, lane("systems", ["c", "cpp", "rust", "wit-wasi"]
		, "Systems HostNull acceptance", "host-null-systems")
]);

export const hostNullCompleteProfiles = Object.freeze(
	hostNullCompleteHostedLanes.flatMap(item => item.profiles)
);
const completeCells = [];
for(const route of hostNullCompleteRoutes)
	for(const profile of hostNullCompleteProfiles)
		for(const position of hostNullCompletePositions)
			completeCells.push(Object.freeze({ route, profile, position }));
export const hostNullCompleteCells = Object.freeze(completeCells);

/**
 * Parse the sole canonical hosted-input root.
 *
 * @param args - Command arguments following the script name.
 */
export const parseHostNullCompleteHostedArchiveArgs = args => {
	const usage = "Usage: archive-host-null-complete-evidence.mjs --input-root /absolute/hosted-input";
	assert.deepEqual(Array.isArray(args) ? args.length : null, 2, usage);
	assert.equal(args[0], "--input-root", usage);
	assert.ok(typeof args[1] === "string" && args[1].length > 0
		&& !/[\0\r\n]/u.test(args[1]) && isAbsolute(args[1])
		&& resolve(args[1]) === args[1], usage);
	return args[1];
};

/**
 * Select the four original GitHub inputs for one lane.
 *
 * @param root - Canonical hosted-input directory.
 * @param selectedLane - One closed HostNull artifact lane.
 */
export const hostNullCompleteHostedInputs = (root, selectedLane) => {
	assert.ok(hostNullCompleteHostedLanes.includes(selectedLane));
	const prefix = `${root}/${selectedLane.id}`;
	return {
		"artifact-zip": `${prefix}/artifact.zip`
		, "run-json": `${prefix}/run.json`
		, "job-json": `${prefix}/job.json`
		, "artifact-json": `${prefix}/artifact.json`
	};
};

/**
 * Bind all seven artifacts to one exact run and revision before any byte can
 * enter the aggregate evidence archive.
 *
 * @param root - Canonical hosted-input directory.
 * @param expectedProducer - Optional exact producer revision.
 */
export const inspectHostNullCompleteHostedArtifacts = async (
	root, expectedProducer = null
) => {
	assert.ok(typeof root === "string" && isAbsolute(root)
		&& resolve(root) === root);
	if(expectedProducer !== null)
		assert.match(expectedProducer, /^[a-f0-9]{40}$/u);
	const captures = [];
	for(const selectedLane of hostNullCompleteHostedLanes)
	{
		const selected = hostNullCompleteHostedInputs(root, selectedLane);
		const run = JSON.parse(await readFile(selected["run-json"]));
		assert.ok(["failure", "success"].includes(run.conclusion));
		const hosted = await inspectCheckedRecordValueIndexHostedArtifact(
			selected, {
				workflow: selectedLane.workflow, jobName: selectedLane.jobName
				, artifactPrefix: selectedLane.artifactPrefix
				, conclusions: { run: run.conclusion, job: "success" }
			}
		);
		captures.push(Object.freeze({
			lane: selectedLane.id, profiles: selectedLane.profiles
			, revision: hosted.revision, hostedRun: hosted.hostedRun
		}));
	}
	assert.equal(new Set(captures.map(item => item.revision)).size, 1
		, "Every HostNull artifact must use one producer revision");
	assert.equal(new Set(captures.map(item => item.hostedRun.runId)).size, 1
		, "Every HostNull artifact must come from one workflow run");
	assert.equal(new Set(captures.map(item => item.hostedRun.job.id)).size
		, captures.length, "HostNull lane jobs must be distinct");
	assert.equal(new Set(captures.map(item => item.hostedRun.artifact.id)).size
		, captures.length, "HostNull lane artifacts must be distinct");
	const producerCommit = captures[0].revision;
	if(expectedProducer !== null) assert.equal(producerCommit, expectedProducer);
	assert.equal(hostNullCompleteProfiles.length, 17);
	assert.equal(new Set(hostNullCompleteProfiles).size, 17);
	assert.equal(hostNullCompleteCells.length, 170);
	assert.equal(new Set(hostNullCompleteCells.map(cell =>
		`${cell.route}:${cell.profile}:${cell.position}`)).size, 170);
	return Object.freeze({
		schemaVersion: 1, producerCommit
		, runId: captures[0].hostedRun.runId
		, captures: Object.freeze(captures), cells: hostNullCompleteCells
	});
};
