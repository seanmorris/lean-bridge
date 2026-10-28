/**
 * Independently replay the ten hosted installed-specialization lanes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, open, readFile, realpath, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nativeArtifactPaths } from "../../src/build/native-artifacts.mjs";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	checkedRecordValueIndexHostedDigest
	, checkedRecordValueIndexHostedSafeZipPath
	, extractCheckedRecordValueIndexHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";
import {
	assertSignatureSpecializationHostedSteps
	, inspectSignatureSpecializationHostedArtifact
	, signatureSpecializationHostedConsumerSha256
	, signatureSpecializationHostedEvidenceDirectory
	, signatureSpecializationHostedLanes
	, signatureSpecializationHostedOriginal
	, signatureSpecializationHostedPhpWasmConsumerSha256
	, signatureSpecializationHostedSourcePath
	, signatureSpecializationHostedSources
} from "./signature-specialization-hosted-archive.mjs";
import {
	validateSignatureSpecializationBrowserReport
} from "./signature-specialization-browser.mjs";
import {
	validateSignatureSpecializationPhpWasmReport
} from "./signature-specialization-php-wasm.mjs";

export const signatureSpecializationHostedIndexPath
	= `${signatureSpecializationHostedEvidenceDirectory}/index.json`;

const profileContract = Object.freeze({
	python: { checks: 2020, extension: "py", target: "pypi" }
	, ruby: { checks: 2020, extension: "rb", target: "rubygems" }
	, rust: { checks: 2011, extension: "rs", target: "cargo" }
	, dotnet: { checks: 2030, extension: "cs", target: "nuget" }
	, java: { checks: 2070, extension: "java", target: "maven" }
	, kotlin: { checks: 2036, extension: "kt", target: "maven" }
	, "php-native": { checks: 2020, extension: "php", target: "php-native" }
	, "wit-wasi": { checks: 2021, extension: "c", target: "wit-wasi" }
	, perl: { checks: 2019, extension: "pl", target: "cpan" }
});
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const object = (value, label) => assert.ok(value && typeof value === "object"
	&& !Array.isArray(value), label);

/**
 * Require the exact successful reviewed-native report and TAP result.
 *
 * @param lane - Closed native lane.
 * @param reportBytes - Exact retained report bytes.
 * @param tapBytes - Exact retained TAP bytes.
 * @param revision - Exact producer revision.
 */
export const validateSignatureSpecializationNativeReport = (
	lane, reportBytes, tapBytes, revision = lane.producerCommit
) => {
	assert.equal(lane.kind, "native");
	const report = JSON.parse(reportBytes);
	assert.equal(reportBytes.toString(), canonicalJson(report));
	assert.deepEqual(Object.keys(report).sort(), [
		"archives", "reports", "reproducible", "schemaVersion"
	]);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.reproducible, true);
	assert.deepEqual(report.reports.map(item => item.profile), lane.profiles);
	object(report.archives, `${lane.id}:archives`);
	assert.ok(Object.keys(report.archives).length > 0);
	const artifacts = new Map();
	for(const item of report.reports)
	{
		const expected = profileContract[item.profile];
		assert.ok(expected && lane.profiles.includes(item.profile));
		assert.deepEqual(Object.keys(item).sort(), [
			"bindingIrSha256", "checks", "compilerFreePath"
			, "consumerSha256", "modelSha256", "offlineInstall"
			, "packages", "path", "profile", "receiptSha256"
			, "reviewedBindingIrSha256", "sourceRemovedBeforeInstallation"
		]);
		assert.equal(item.path, "reviewed-source");
		assert.equal(item.checks, expected.checks);
		for(const flag of [
			"compilerFreePath", "offlineInstall", "sourceRemovedBeforeInstallation"
		]) assert.equal(item[flag], true, `${item.profile}:${flag}`);
		for(const field of [
			"bindingIrSha256", "reviewedBindingIrSha256", "modelSha256"
			, "receiptSha256", "consumerSha256"
		]) digest(item[field]);
		assert.equal(item.consumerSha256
			, signatureSpecializationHostedConsumerSha256(revision
				, `tests/fixtures/specialization-consumers/${item.profile}.${expected.extension}`));
		assert.ok(Array.isArray(item.packages) && item.packages.length > 0);
		assert.ok(item.packages.every(pkg => pkg.target === expected.target));
		for(const pkg of item.packages)
		{
			assert.ok(Array.isArray(pkg.artifacts) && pkg.artifacts.length > 0);
			for(const artifact of pkg.artifacts)
			{
				assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
				digest(artifact.sha256);
				assert.equal(report.archives[artifact.path], artifact.sha256);
				artifacts.set(artifact.path, artifact.sha256);
			}
		}
	}
	assert.deepEqual(Object.keys(report.archives).sort(), [...artifacts.keys()].sort());
	for(const [path, value] of Object.entries(report.archives))
	{
		digest(value); assert.equal(artifacts.get(path), value);
	}
	const tap = tapBytes.toString();
	assert.ok(tap.startsWith("TAP version 13\n"));
	assert.ok(tap.endsWith("\n"));
	assert.doesNotMatch(tap, /^not ok /mu);
	const title = "independently reviewed native packages install every chosen specialization without its generic";
	assert.equal(tap.match(new RegExp(`^ok [0-9]+ - ${title}$`, "gmu"))?.length, 1);
	assert.match(tap, /^# pass 1$/mu);
	assert.match(tap, /^# fail 0$/mu);
	return Object.freeze({
		kind: "native", profiles: [...lane.profiles]
		, checks: Object.fromEntries(report.reports.map(item => [item.profile, item.checks]))
		, reportSha256: sha256(reportBytes), tapSha256: sha256(tapBytes)
		, archives: Object.keys(report.archives).length
	});
};

/**
 * Require every browser or PHP-Wasm observation in its closed report.
 *
 * @param lane - Closed hosted lane.
 * @param reportBytes - Exact retained report bytes.
 * @param tapBytes - Exact retained TAP bytes for native lanes.
 */
export const validateSignatureSpecializationHostedReport = (
	lane, reportBytes, tapBytes = null
) => {
	if(lane.kind === "native")
		return validateSignatureSpecializationNativeReport(
			lane, reportBytes, tapBytes);
	assert.equal(tapBytes, null);
	const report = JSON.parse(reportBytes);
	assert.equal(reportBytes.toString(), canonicalJson(report));
	if(lane.kind === "browser")
	{
		validateSignatureSpecializationBrowserReport(report);
		assert.ok(report.routes.every(item =>
			item.producerCommit === lane.producerCommit));
		for(const item of report.routes)
		{
			digest(item.reviewedBindingIrSha256);
			assert.equal(item.builds.length, 2);
			for(const build of item.builds)
				for(const value of Object.values(build)) digest(value);
		}
		return Object.freeze({
			kind: lane.kind, reportSha256: sha256(reportBytes)
			, routes: report.routes.map(item => item.route)
			, executions: report.routes.reduce((sum, route) => sum
				+ route.browsers.observations.reduce((count, observation) =>
					count + observation.browser.browser.executions.length, 0), 0)
		});
	}
	assert.equal(lane.kind, "php-wasm");
	validateSignatureSpecializationPhpWasmReport(report);
	assert.ok(report.reports.every(item =>
		item.producerCommit === lane.producerCommit));
	const consumer = signatureSpecializationHostedPhpWasmConsumerSha256(
		lane.producerCommit);
	for(const item of report.reports)
	{
		assert.equal(item.consumerSha256, consumer);
		digest(item.driverSha256); digest(item.reviewedBindingIrSha256);
		assert.equal(item.builds.length, 2);
		for(const build of item.builds)
			for(const value of Object.values(build)) digest(value);
	}
	return Object.freeze({
		kind: lane.kind, reportSha256: sha256(reportBytes)
		, paths: report.reports.map(item => item.path)
		, checks: report.reports.map(item => item.checks)
		, executions: report.reports.reduce((sum, item) =>
			sum + item.executions.length, 0)
	});
};

const reconstruct = async (root, parts, target) => {
	const output = await open(target, "wx");
	try
	{
		let offset = 0;
		for(const part of parts)
		{
			assert.equal(part.offset, offset);
			const bytes = await readFile(join(root, part.path));
			assert.equal(bytes.length, part.bytes);
			assert.equal(sha256(bytes), part.sha256);
			await output.write(bytes, 0, bytes.length, offset);
			offset += bytes.length;
		}
		return offset;
	}
	finally
	{ await output.close(); }
};

/**
 * Validate every retained byte, rebuild every ZIP and replay all ten lanes.
 *
 * @param evidenceRoot - Immutable evidence directory.
 */
export const checkSignatureSpecializationHostedEvidence = async (
	evidenceRoot = signatureSpecializationHostedEvidenceDirectory
) => {
	const root = await realpath(evidenceRoot);
	const indexBytes = await readFile(join(root, "index.json"));
	const index = JSON.parse(indexBytes);
	assert.equal(indexBytes.toString(), canonicalJson(index));
	assert.deepEqual(Object.keys(index).sort(), [
		"archiveCommit", "checkerCommit", "files", "kind", "lanes"
		, "limitations", "producerCommits", "schemaVersion", "selectedSources"
	]);
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "signature-specializations-hosted-installed-v1");
	assert.deepEqual(Object.keys(index.producerCommits).sort()
		, signatureSpecializationHostedLanes.map(lane => lane.id).sort());
	assert.deepEqual(index.producerCommits, Object.fromEntries(
		signatureSpecializationHostedLanes.map(lane => [
			lane.id, lane.producerCommit
		])
	));
	for(const key of ["checkerCommit", "archiveCommit"])
		assert.match(index[key], /^[a-f0-9]{40}$/u, key);
	for(const [lane, revision] of Object.entries(index.producerCommits))
		assert.match(revision, /^[a-f0-9]{40}$/u, lane);
	assert.deepEqual(index.lanes.map(lane => lane.id)
		, signatureSpecializationHostedLanes.map(lane => lane.id));
	assert.deepEqual(index.files, [...index.files].sort((left, right) =>
		left.path.localeCompare(right.path)));
	assert.equal(new Set(index.files.map(file => file.path)).size
		, index.files.length);
	assert.deepEqual(await nativeArtifactPaths(root), [
		"index.json", ...index.files.map(file => file.path)
	].sort());
	for(const file of index.files)
	{
		assert.ok(checkedRecordValueIndexHostedSafeZipPath(file.path), file.path);
		const path = join(root, file.path), information = await stat(path);
		assert.equal(information.size, file.bytes, file.path);
		assert.equal(await checkedRecordValueIndexHostedDigest(path)
			, file.sha256, file.path);
	}
	const revisions = {
		producers: [...new Set(Object.values(index.producerCommits))].sort()
		, checker: index.checkerCommit
		, archiver: index.archiveCommit
	};
	assert.deepEqual(index.selectedSources
		, signatureSpecializationHostedSources(revisions));
	for(const source of index.selectedSources)
		assert.deepEqual(
			await readFile(join(root
				, signatureSpecializationHostedSourcePath(source)))
			, signatureSpecializationHostedOriginal(source.revision, source.path)
			, `${source.role}/${source.path}`);

	const temporary = await mkdtemp(join(
		tmpdir(), "lean-bridge-signature-specialization-evidence-"));
	try
	{
		for(const retained of index.lanes)
		{
			const lane = signatureSpecializationHostedLanes.find(
				item => item.id === retained.id);
			assert.ok(lane);
			assert.deepEqual(retained.profiles, lane.profiles);
			const zip = join(temporary, `${lane.id}.zip`);
			const bytes = await reconstruct(
				root, retained.hostedRun.artifact.parts, zip);
			assert.equal(bytes, retained.hostedRun.artifact.bytes);
			assert.equal(await checkedRecordValueIndexHostedDigest(zip)
				, retained.hostedRun.artifact.sha256);
			const apiRoot = join(root, `hosted/api/${lane.id}`);
			const hosted = await inspectSignatureSpecializationHostedArtifact({
				"artifact-zip": zip, "run-json": join(apiRoot, "run.json")
				, "job-json": join(apiRoot, "job.json")
				, "artifact-json": join(apiRoot, "artifact.json")
				, "job-log": join(root, `hosted/${lane.id}/job.log`)
			}, lane);
			assert.equal(hosted.revision, index.producerCommits[lane.id]);
			assertSignatureSpecializationHostedSteps(lane, hosted.api.job.bytes);
			const expectedHosted = {
				...hosted.hostedRun
				, apiRecords: Object.fromEntries(Object.entries(hosted.api).map(
					([name, item]) => [name, {
						bytes: item.bytes.length, sha256: item.sha256
					}]
				))
				, artifact: {
					...hosted.hostedRun.artifact
					, members: retained.hostedRun.artifact.members
					, parts: retained.hostedRun.artifact.parts
				}
			};
			assert.deepEqual(retained.hostedRun, expectedHosted);
			const extracted = await extractCheckedRecordValueIndexHostedArtifact(zip);
			try
			{
				assert.deepEqual(extracted.entries
					, retained.hostedRun.artifact.members);
				const report = await readFile(join(extracted.root, lane.reportPath));
				assert.deepEqual(report, await readFile(join(
					root, `hosted/output/${lane.id}/${lane.reportPath}`)));
				const tap = lane.tapPath
					? await readFile(join(extracted.root, lane.tapPath)) : null;
				if(lane.tapPath) assert.deepEqual(tap, await readFile(join(
					root, `hosted/output/${lane.id}/${lane.tapPath}`)));
				assert.deepEqual(validateSignatureSpecializationHostedReport(
					lane, report, tap), retained.accepted);
			}
			finally
			{ await rm(extracted.root, { recursive: true }); }
			const log = await readFile(join(root, `hosted/${lane.id}/job.log`), "utf8");
			assert.ok(log.length > 0);
			assert.match(log, lane.kind === "native"
				? /independently reviewed native packages/u
				: lane.kind === "browser"
					? /installed ordinary and reviewed specialization packages/u
					: /installed ordinary and reviewed PHP-Wasm packages/u);
		}
	}
	finally
	{ await rm(temporary, { recursive: true }); }
	return index;
};
