/**
 * Independently validate and replay retained dependent-signature evidence.
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
	validateComponentPackageReceipt
} from "../../src/release/component-package-receipt.mjs";
import {
	checkedRecordValueIndexHostedDigest
	, checkedRecordValueIndexHostedSafeZipPath
	, extractCheckedRecordValueIndexHostedArtifact
} from "./checked-record-value-index-hosted-archive.mjs";
import {
	assertDependentSignatureHostedSteps
	, dependentSignatureHostedEvidenceDirectory
	, dependentSignatureHostedLanes
	, dependentSignatureHostedOriginal
	, dependentSignatureHostedProducer
	, dependentSignatureHostedRunConclusions
	, dependentSignatureHostedSourcePath
	, dependentSignatureHostedSources
	, inspectDependentSignatureHostedArtifact
} from "./dependent-signature-hosted-archive.mjs";
import {
	dependentFinExtensions, dependentFinRefinements, dependentFinTargets
} from "./managed-dependent-fin.mjs";
import {
	dependentFinJavascriptExpected, dependentFinJavascriptProfiles
} from "./dependent-fin-javascript.mjs";

export const dependentSignatureHostedIndexPath
	= `${dependentSignatureHostedEvidenceDirectory}/index.json`;
const digest = (value, label) => assert.match(value, /^[a-f0-9]{64}$/u
	, label);
const object = (value, label) => assert.ok(value && typeof value === "object"
	&& !Array.isArray(value), label);
const exactKeys = (value, expected, label) => {
	object(value, label);
	assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label);
};
const trueFlags = (value, names) => {
	for(const name of names) assert.equal(value[name], true, name);
};

const consumerSourceSha256 = profile => {
	const fixtureProfile = profile === "php-wasm" ? "php-native" : profile;
	let source = dependentSignatureHostedOriginal(
		dependentSignatureHostedProducer
		, `tests/fixtures/dependent-fin-consumers/${fixtureProfile}.${dependentFinExtensions[profile]}`
	).toString();
	if(profile === "php-wasm")
		source = source.replace("require 'vendor/autoload.php';", "");
	return sha256(source);
};
const validatePackages = (item, archives) => {
	assert.ok(Array.isArray(item.packages) && item.packages.length > 0);
	const target = dependentFinTargets[item.profile][0];
	for(const pkg of item.packages)
	{
		object(pkg, `${item.profile}:package`);
		assert.equal(pkg.target, target, item.profile);
		assert.ok(Array.isArray(pkg.artifacts) && pkg.artifacts.length > 0);
		for(const artifact of pkg.artifacts)
		{
			assert.ok(Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0);
			digest(artifact.sha256, artifact.path);
			assert.equal(archives[artifact.path], artifact.sha256, artifact.path);
		}
	}
};
const validatePhpWasm = item => {
	assert.equal(typeof item.browserVersion, "string");
	assert.ok(item.browserVersion.length > 0);
	digest(item.driverSha256, "driverSha256");
	trueFlags(item, ["unchangedDeployment", "handoffRemovedBeforeExecution"]);
	object(item.deployment, "deployment");
	assert.ok(Object.keys(item.deployment).length > 0);
	for(const [path, file] of Object.entries(item.deployment))
	{
		exactKeys(file, ["bytes", "sha256"], path);
		assert.ok(Number.isSafeInteger(file.bytes) && file.bytes > 0);
		digest(file.sha256, path);
	}
	assert.equal(item.executions.length, 12);
	assert.deepEqual(item.executions.map(run => [
		run.realm, run.arrangement, run.loading, run.mode
	]), [
		...(["embedded", "composer"].flatMap(arrangement =>
			["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(
				mode => ["node", arrangement, loading, mode]))))
		, ...(["startup", "lazy"].flatMap(loading => ["weak", "strict"].map(
			mode => ["chromium", "bundled", loading, mode])))
	]);
	for(const run of item.executions)
	{
		assert.equal(run.checks, item.checks);
		assert.equal(run.libraries, 2);
		assert.ok(Array.isArray(run.libraryNames)
			&& run.libraryNames.length === 2);
		assert.equal(new Set(run.libraryNames).size, 2);
	}
};

/**
 * Validate one ordinary or independently reviewed managed-host report.
 *
 * @param lane - Closed hosted lane.
 * @param reportBytes - Exact canonical report bytes.
 * @param route - Ordinary or independently reviewed author route.
 */
export const validateDependentSignatureManagedReport = (
	lane, reportBytes, route
) => {
	assert.equal(lane.kind, "managed");
	assert.ok(["ordinary-source", "reviewed-ir"].includes(route));
	const report = JSON.parse(reportBytes);
	assert.equal(reportBytes.toString(), canonicalJson(report));
	exactKeys(report, ["archives", "reports", "reproducible", "schemaVersion"]
		, `${lane.id}:${route}`);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.reproducible, true);
	object(report.archives, `${lane.id}:archives`);
	assert.ok(Object.keys(report.archives).length > 0);
	assert.deepEqual(report.reports.map(item => item.profile), lane.profiles);
	const artifactPaths = new Set();
	for(const item of report.reports)
	{
		const extra = item.profile === "php-wasm" ? [
			"browserVersion", "deployment", "driverSha256", "executions"
			, "handoffRemovedBeforeExecution", "unchangedDeployment"
		] : [];
		exactKeys(item, [
			"bindingIrSha256", "checks", "compilerFreePath"
			, "consumerSha256", "dispatch"
			, "handoffRelocatedBeforeInstallation", "modelSha256"
			, "offlineInstall", "packages", "path", "profile"
			, "receiptSha256", "refinements"
			, "sourceRemovedBeforeInstallation", "sourceTreeSha256"
			, ...route === "reviewed-ir" ? ["reviewedSourceSha256"] : []
			, ...extra
		], `${lane.id}:${route}:${item.profile}`);
		assert.ok(lane.profiles.includes(item.profile));
		assert.equal(item.path, route);
		assert.ok(Number.isSafeInteger(item.checks) && item.checks > 2000);
		trueFlags(item, [
			"compilerFreePath", "offlineInstall"
			, "sourceRemovedBeforeInstallation"
			, "handoffRelocatedBeforeInstallation"
		]);
		for(const field of [
			"bindingIrSha256", "consumerSha256", "modelSha256"
			, "receiptSha256", "sourceTreeSha256"
			, ...route === "reviewed-ir" ? ["reviewedSourceSha256"] : []
		]) digest(item[field], `${item.profile}:${field}`);
		assert.equal(item.consumerSha256, consumerSourceSha256(item.profile));
		assert.deepEqual(item.refinements, dependentFinRefinements);
		assert.deepEqual(item.dispatch, {
			observed: false
			, reason: "the dependent comparison runs in the bundled C adapter before Lean; its rejection text and recovery are observed through the public host API"
		});
		validatePackages(item, report.archives);
		for(const pkg of item.packages) for(const artifact of pkg.artifacts)
			artifactPaths.add(artifact.path);
		if(item.profile === "php-wasm") validatePhpWasm(item);
	}
	assert.deepEqual(Object.keys(report.archives).sort()
		, [...artifactPaths].sort());
	for(const value of Object.values(report.archives)) digest(value, "archive");
	return Object.freeze({
		route, profiles: [...lane.profiles], reportSha256: sha256(reportBytes)
		, checks: Object.fromEntries(report.reports.map(item => [
			item.profile, item.checks
		]))
		, archives: Object.keys(report.archives).length
	});
};

const variantsFor = profile => profile === "browser-react"
	? ["production", "strict"] : ["production"];
const lifecycleFor = (profile, variant) => profile === "browser-react"
	? variant === "strict"
		? { effects: 6, cleanups: 5, ignored: 3, commits: 3 }
		: { effects: 3, cleanups: 2, ignored: 0, commits: 3 }
	: profile === "browser-worker"
		? { created: 2, terminated: 2, live: 0 }
		: { rerun: true };
const expectedJavascriptResult = route => ({
	module: "dependentfin", route, ...dependentFinJavascriptExpected
});
const validateBrowserHarness = (entry, route) => {
	assert.ok(dependentFinJavascriptProfiles.includes(entry.profile));
	assert.ok(entry.profile.startsWith("browser-"));
	exactKeys(entry, ["browser", "profile"], entry.profile);
	exactKeys(entry.browser, ["browser", "observation"], entry.profile);
	const browser = entry.browser.browser;
	exactKeys(browser, [
		"deployments", "executions", "externalNetworkBlocked", "framework"
		, "installedAssets", "installedSourcesRemoved", "requestedEngines"
	], entry.profile);
	trueFlags(browser, ["externalNetworkBlocked", "installedSourcesRemoved"]);
	assert.deepEqual(browser.requestedEngines, ["chromium", "firefox", "webkit"]);
	assert.deepEqual(browser.framework.map(item => item.name)
		, entry.profile === "browser-react"
			? ["react", "react-dom", "scheduler"] : []);
	assert.equal(browser.installedAssets.length, 2);
	for(const asset of browser.installedAssets)
	{
		exactKeys(asset, ["bytes", "path", "sha256"], asset.path);
		assert.ok(Number.isSafeInteger(asset.bytes) && asset.bytes > 0);
		digest(asset.sha256, asset.path);
	}
	const variants = variantsFor(entry.profile);
	assert.deepEqual(browser.deployments.map(item => item.variant), variants);
	for(const deployment of browser.deployments)
	{
		exactKeys(deployment, [
			"files", "modulePaths", "sha256", "variant", "viteVersion"
		], `${entry.profile}:deployment`);
		assert.equal(deployment.sha256, sha256(canonicalJson(deployment.files)));
		assert.ok(deployment.modulePaths.includes(
			"node_modules/dependentfin/index.mjs"));
		assert.ok(deployment.modulePaths.includes(
			"node_modules/@lean-bridge/runtime/index.mjs"));
	}
	assert.deepEqual(browser.executions.map(({ engine, variant }) => ({
		engine, variant
	})), ["chromium", "firefox", "webkit"].flatMap(engine =>
		variants.map(variant => ({ engine, variant }))));
	assert.deepEqual(entry.browser.observation
		, browser.executions[0].observation);
	for(const execution of browser.executions)
	{
		assert.equal(execution.failedAssetRecovery, true);
		assert.deepEqual(execution.lifecycle
			, lifecycleFor(entry.profile, execution.variant));
		if(entry.profile === "browser-react")
			assert.equal(execution.pendingUnmount, true);
		assert.equal(typeof execution.observation.hostVersion, "string");
		assert.ok(execution.observation.hostVersion.length > 0);
		assert.deepEqual(execution.observation, {
			schemaVersion: 1, profile: entry.profile, module: "dependentfin"
			, realm: entry.profile === "browser-worker"
				? "dedicated-worker" : "window"
			, results: expectedJavascriptResult(route)
			, hostVersion: execution.observation.hostVersion
		});
		assert.ok(execution.assets.length >= 2);
		for(const asset of execution.assets)
		{
			exactKeys(asset, ["bytes", "mime", "path", "sha256", "status"]
				, asset.path);
			assert.equal(asset.status, 200);
			assert.match(asset.mime, /^application\/wasm/u);
			digest(asset.sha256, asset.path);
		}
	}
};

/**
 * Validate one JavaScript-family author route.
 *
 * @param lane - Closed JavaScript lane.
 * @param reportBytes - Exact canonical report bytes.
 * @param route - Ordinary or independently reviewed author route.
 */
export const validateDependentSignatureJavascriptReport = (
	lane, reportBytes, route
) => {
	assert.equal(lane.kind, "javascript");
	const report = JSON.parse(reportBytes);
	assert.equal(reportBytes.toString(), canonicalJson(report));
	exactKeys(report, [
		"browsers", "compilerFreePath", "facts", "independentBuilds"
		, "kind", "node", "offlineInstall", "producerBuildsRemovedBeforeInstallation"
		, "producerCommit", "receipt", "reproducible", "route"
		, "schemaVersion", "sourceRemovedBeforeInstallation"
	], `javascript:${route}`);
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.kind, "dependent-fin-javascript-installed-v1");
	assert.equal(report.route, route);
	assert.equal(report.producerCommit, dependentSignatureHostedProducer);
	assert.equal(report.independentBuilds, 2);
	trueFlags(report, [
		"compilerFreePath", "offlineInstall", "reproducible"
		, "sourceRemovedBeforeInstallation"
		, "producerBuildsRemovedBeforeInstallation"
	]);
	exactKeys(report.facts, [
		"adapterPlanSha256", "bindingIrSha256", "metadataSha256"
		, ...route === "reviewed-ir" ? ["reviewedSourceSha256"] : []
	], `javascript:${route}:facts`);
	for(const [name, value] of Object.entries(report.facts)) digest(value, name);
	validateComponentPackageReceipt(report.receipt);
	assert.equal(report.receipt.bindingIrSha256, report.facts.bindingIrSha256);
	exactKeys(report.node, ["executions", "typescript"], "javascript:node");
	assert.deepEqual(report.node.executions.map(item => item.profile)
		, ["node-javascript", "node-typescript"]);
	for(const execution of report.node.executions)
	{
		assert.equal(typeof execution.hostVersion, "string");
		assert.ok(execution.hostVersion.length > 0);
		assert.deepEqual(execution.result, expectedJavascriptResult(route));
	}
	exactKeys(report.node.typescript, [
		"compilerSha256", "declarationsSha256", "skipLibCheck"
		, "sourceSha256", "strict"
	], "javascript:typescript");
	assert.equal(report.node.typescript.strict, true);
	assert.equal(report.node.typescript.skipLibCheck, false);
	for(const name of ["compilerSha256", "declarationsSha256", "sourceSha256"])
		digest(report.node.typescript[name], name);
	assert.deepEqual(report.browsers.map(item => item.profile), [
		"browser-javascript", "browser-react", "browser-worker"
	]);
	for(const item of report.browsers) validateBrowserHarness(item, route);
	return Object.freeze({
		route, profiles: [...lane.profiles], reportSha256: sha256(reportBytes)
		, nodeExecutions: report.node.executions.length
		, browserExecutions: report.browsers.reduce((sum, item) =>
			sum + item.browser.browser.executions.length, 0)
	});
};

/**
 * Validate both report bytes selected from one hosted artifact.
 *
 * @param lane - Closed hosted lane.
 * @param reports - Exact reports keyed by archive member path.
 */
export const validateDependentSignatureHostedReports = (
	lane, reports
) => {
	assert.deepEqual(Object.keys(reports).sort(), [...lane.reportPaths].sort());
	const routes = ["ordinary-source", "reviewed-ir"];
	const accepted = lane.reportPaths.map((path, index) => lane.kind === "javascript"
		? validateDependentSignatureJavascriptReport(lane, reports[path], routes[index])
		: validateDependentSignatureManagedReport(lane, reports[path], routes[index]));
	assert.deepEqual(accepted[1].profiles, accepted[0].profiles);
	assert.deepEqual(accepted[1].checks, accepted[0].checks);
	return accepted;
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
 * Validate every retained byte, rebuild every ZIP and replay all 14 lanes.
 *
 * @param evidenceRoot - Immutable retained evidence root.
 */
export const checkDependentSignatureHostedEvidence = async (
	evidenceRoot = dependentSignatureHostedEvidenceDirectory
) => {
	const root = await realpath(evidenceRoot);
	const indexBytes = await readFile(join(root, "index.json"));
	const index = JSON.parse(indexBytes);
	assert.equal(indexBytes.toString(), canonicalJson(index));
	exactKeys(index, [
		"archiveCommit", "checkerCommit", "files", "kind", "lanes"
		, "limitations", "producerCommit", "runConclusions", "schemaVersion"
		, "selectedSources"
	], "index");
	assert.equal(index.schemaVersion, 1);
	assert.equal(index.kind, "dependent-signatures-hosted-installed-v1");
	assert.equal(index.producerCommit, dependentSignatureHostedProducer);
	assert.deepEqual(index.runConclusions
		, dependentSignatureHostedRunConclusions);
	assert.deepEqual(index.lanes.map(item => item.id)
		, dependentSignatureHostedLanes.map(item => item.id));
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
		producer: index.producerCommit, checker: index.checkerCommit
		, archiver: index.archiveCommit
	};
	assert.deepEqual(index.selectedSources
		, dependentSignatureHostedSources(revisions));
	for(const source of index.selectedSources)
		assert.deepEqual(await readFile(join(root
			, dependentSignatureHostedSourcePath(source)))
		, dependentSignatureHostedOriginal(source.revision, source.path));
	const temporary = await mkdtemp(join(
		tmpdir(), "lean-bridge-dependent-signature-evidence-"));
	try
	{
		for(const retained of index.lanes)
		{
			const lane = dependentSignatureHostedLanes.find(
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
			const hosted = await inspectDependentSignatureHostedArtifact({
				"artifact-zip": zip, "run-json": join(apiRoot, "run.json")
				, "job-json": join(apiRoot, "job.json")
				, "artifact-json": join(apiRoot, "artifact.json")
				, "job-log": join(root, `hosted/${lane.id}/job.log`)
			}, lane);
			assertDependentSignatureHostedSteps(lane, hosted.api.job.bytes);
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
				const reports = {};
				for(const path of lane.reportPaths)
				{
					reports[path] = await readFile(join(extracted.root, path));
					assert.deepEqual(reports[path], await readFile(join(
						root, `hosted/output/${lane.id}/${path}`)));
				}
				assert.deepEqual(validateDependentSignatureHostedReports(
					lane, reports), retained.accepted);
			}
			finally
			{ await rm(extracted.root, { recursive: true }); }
			assert.ok((await readFile(join(
				root, `hosted/${lane.id}/job.log`))).length > 0);
		}
	}
	finally
	{ await rm(temporary, { recursive: true }); }
	return index;
};
