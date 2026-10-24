/**
 * Independently replay one owned checked-record hosted output tree.
 *
 * The tree is the extracted original artifact: the CI log directory and the
 * packaging directory with its aggregate report and the retained package set
 * for every route. Nothing here trusts the producer's own gates; the Node TAP,
 * the canonical report, every retained archive byte and every consumer source
 * digest are checked against each other and against the lane contract.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	packageSetReceiptName, readVerifiedPackageSetReceipt
} from "../../src/release/package-set-receipt.mjs";
import {
	ownedCheckedRecordHostedLanes, ownedCheckedRecordHostedRoutes
	, ownedCheckedRecordHostedTestNames
} from "./owned-checked-record-hosted-contracts.mjs";
import {
	verifyOwnedCheckedRecordJavaScriptEvidence
} from "./owned-checked-record-javascript-evidence.mjs";

const summaryKeys = Object.freeze(["tests", "suites", "pass", "fail"
	, "cancelled", "skipped", "todo"]);

/**
 * Parse the terminal Node TAP stream written after the npm script preamble.
 *
 * @param text - Complete acceptance log.
 */
export const parseOwnedCheckedRecordTap = text => {
	const lines = text.split("\n");
	const start = lines.indexOf("TAP version 13");
	assert.ok(start >= 0, "Acceptance log must contain Node TAP");
	assert.equal(lines.lastIndexOf("TAP version 13"), start
		, "Acceptance log must contain one TAP stream");
	for(const line of lines.slice(0, start))
		assert.ok(line === "" || line.startsWith("> ")
			, `Unexpected acceptance preamble: ${line}`);
	const tests = [], diagnostics = [], summary = {};
	let plan = null;
	for(const line of lines.slice(start + 1))
	{
		assert.doesNotMatch(line, /^\s*not ok\b/u, line);
		assert.doesNotMatch(line, /^Bail out!/u, line);
		const point = /^ok (\d+) - (.*)$/u.exec(line);
		if(point)
		{
			assert.doesNotMatch(point[2], /#\s*(?:SKIP|TODO)\b/iu, line);
			assert.equal(Number(point[1]), tests.length + 1, line);
			assert.equal(plan, null, "Test points must precede the plan");
			tests.push(point[2]);
			continue;
		}
		const planned = /^1\.\.(\d+)$/u.exec(line);
		if(planned)
		{
			assert.equal(plan, null, "Acceptance TAP must contain one plan");
			plan = Number(planned[1]);
			continue;
		}
		const comment = /^# (.*)$/u.exec(line);
		if(!comment)
		{
			if(line !== "") assert.equal(plan, null
				, `Unexpected TAP line after the plan: ${line}`);
			continue;
		}
		if(comment[1].startsWith("Subtest: ")) continue;
		const counted = /^(\w+) (\d+(?:\.\d+)?)$/u.exec(comment[1]);
		const totals = [...summaryKeys, "duration_ms"];
		if(plan !== null && counted && totals.includes(counted[1]))
		{
			assert.ok(!Object.hasOwn(summary, counted[1]), counted[1]);
			summary[counted[1]] = Number(counted[2]);
			continue;
		}
		assert.equal(plan, null, `Unexpected comment after the plan: ${line}`);
		diagnostics.push(comment[1]);
	}
	assert.equal(plan, tests.length, "TAP plan must count every test point");
	assert.deepEqual(Object.keys(summary).filter(key => key !== "duration_ms")
		.toSorted(), [...summaryKeys].toSorted());
	assert.deepEqual({ ...summary, duration_ms: undefined }, {
		tests: tests.length, suites: 0, pass: tests.length, fail: 0
		, cancelled: 0, skipped: 0, todo: 0, duration_ms: undefined
	});
	return { tests, diagnostics };
};

const regularFiles = async (root, prefix = "") => {
	const files = [];
	for(const entry of await readdir(join(root, prefix), { withFileTypes: true }))
	{
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		const information = await lstat(join(root, path));
		if(information.isDirectory()) files.push(...await regularFiles(root, path));
		else
		{
			assert.ok(information.isFile(), `Hosted output must be regular: ${path}`);
			files.push(path);
		}
	}
	return files.toSorted();
};

const routeShape = route => {
	const match = /^(ordinary|reviewed)-(full|result-only)$/u.exec(route);
	assert.ok(match, route);
	return { authorRoute: match[1], mode: match[2]
		, resultOnly: match[2] === "result-only" };
};

const extensions = Object.freeze({ c: "c", cpp: "cpp", python: "py"
	, ruby: "rb", rust: "rs", dotnet: "cs", java: "java", kotlin: "kt"
	, "php-native": "php" });

/**
 * Reproduce the exact consumer source bytes a lane fed to one profile.
 *
 * @param original - Reader of committed producer source bytes.
 * @param lane - Contract selecting the lane's fixture naming.
 * @param profile - Installed host whose consumer source is selected.
 * @param resultOnly - Whether the route is result-only.
 */
const consumerSource = (original, lane, profile, resultOnly) => {
	const read = name => original(`tests/fixtures/structured-types/${name}`)
		.toString("utf8");
	const installed = resultOnly ? "result-only" : "installed";
	if(lane.kind === "native")
		return read(`owned-checked-record-${installed}.${extensions[profile]}`);
	if(lane.kind === "perl") return read(`owned-checked-record-${installed}.pl`);
	if(profile === "wit-wasi")
		return read(`owned-checked-record-${installed}.c`)
			.replaceAll("owned_checked_records", "owned_checked_records_wasmtime")
			.replaceAll("OWNED_CHECKED_RECORDS", "OWNED_CHECKED_RECORDS_WASMTIME")
			.replace(`owned-checked-record-${resultOnly ? "result-only-" : ""}c:`
				, `owned-checked-record-${resultOnly ? "result-only-" : ""}wit-wasi:`);
	const name = profile === "php-native" ? "php" : profile;
	return read(`owned-checked-record-${resultOnly ? "result-only-" : ""}${name}.${extensions[profile]}`);
};

const positive = value => Number.isSafeInteger(value) && value > 0;

const replayJavaScript = async (lane, root, producer) => {
	const packagingRoot = join(root, lane.packaging);
	const reportPath = join(packagingRoot, lane.report);
	const reportBytes = await readFile(reportPath);
	const report = JSON.parse(reportBytes);
	assert.equal(reportBytes.toString("utf8"), canonicalJson(report)
		, "Hosted report must be canonical");
	const accepted = await verifyOwnedCheckedRecordJavaScriptEvidence(reportPath);
	const acceptance = await readFile(join(root, lane.acceptance), "utf8");
	const tap = parseOwnedCheckedRecordTap(acceptance);
	assert.deepEqual(tap.tests, ownedCheckedRecordHostedTestNames(lane)
		, "Acceptance TAP must contain exactly the JavaScript lane tests in order");
	const verificationBytes = await readFile(join(root, lane.verification));
	const verification = JSON.parse(verificationBytes);
	assert.equal(verificationBytes.toString("utf8"), canonicalJson(verification)
		, "Hosted JavaScript verification must be canonical");
	assert.deepEqual(verification, accepted
		, "Hosted JavaScript verification must equal independent replay");
	const members = [lane.report, lane.acceptance.slice(lane.packaging.length + 1)
		, lane.verification.slice(lane.packaging.length + 1)];
	for(const entry of report.reports)
		members.push(...entry.retainedPackageSet.files.map(file =>
			`${entry.retainedPackageSet.path}/${file}`));
	assert.deepEqual(await regularFiles(packagingRoot), members.toSorted()
		, "Hosted JavaScript output must contain exactly the retained package evidence");
	return {
		schemaVersion: 1, kind: "owned-checked-record-hosted-replay"
		, lane: "javascript", producerCommit: producer
		, reportSha256: sha256(reportBytes)
		, acceptanceLogSha256: sha256(Buffer.from(acceptance))
		, tests: tap.tests.length, routes: accepted.routes
	};
};

const checkObservations = ({ lane, entry, shape, diagnostics, source }) => {
	const route = entry.route;
	if(lane.kind === "native")
	{
		const lines = diagnostics.filter(line => line.startsWith(`{"route":"${route}",`));
		assert.equal(lines.length, 1, `${route}: one native summary diagnostic`);
		const summary = JSON.parse(lines[0]);
		assert.deepEqual(Object.keys(summary), ["route", "c", "cpp", "sanitizer"]);
		assert.deepEqual(Object.keys(entry.observed).toSorted(), ["c", "cpp"]);
		assert.deepEqual(Object.keys(entry.relocated).toSorted(), ["c", "cpp"]);
		for(const profile of ["c", "cpp"])
		{
			const observed = entry.observed[profile];
			assert.ok(positive(observed.checks), `${route}/${profile}`);
			assert.equal(summary[profile], observed.checks, `${route}/${profile}`);
			if(shape.resultOnly)
				assert.equal(observed.checks, profile === "c" ? 14 : 3);
			const digest = sha256(source(profile));
			assert.equal(observed.consumerSha256, digest, `${route}/${profile}`);
			assert.equal(entry.relocated[profile].sourceSha256, digest
				, `${route}/${profile}`);
		}
		assert.equal(summary.sanitizer, !shape.resultOnly, route);
		assert.equal(Boolean(entry.relocated.cpp.sanitizer), !shape.resultOnly
			, route);
		assert.deepEqual(entry.lifecycle, { c: "manual-owner-release"
			, cpp: shape.resultOnly ? "raii" : "raii-plus-sanitizers" });
		return { c: entry.observed.c.checks, cpp: entry.observed.cpp.checks };
	}
	if(lane.kind === "perl")
	{
		const lines = diagnostics.filter(line => line.startsWith(`{"route":"${route}",`))
			.map(line => JSON.parse(line));
		assert.equal(entry.lifecycle, "perl-destruction-plus-explicit-close");
		assert.equal(entry.consumerSha256, sha256(source("perl")), route);
		assert.ok(Array.isArray(entry.observations));
		assert.equal(entry.observations.length, 8, `${route}: four ABIs, two modes`);
		assert.equal(new Set(entry.observations.map(item => item.perl)).size, 4);
		const cells = entry.observations.map(item => {
			assert.ok(["prebuilt-only", "build-xs"].includes(item.mode), item.mode);
			assert.equal(item.runtimeOnlyRuns, 2);
			assert.ok(positive(item.observed.checks));
			return { route, perl: item.perl, mode: item.mode
				, checks: item.observed.checks };
		});
		assert.equal(new Set(cells.map(cell => `${cell.perl}/${cell.mode}`)).size, 8);
		for(const line of lines)
			assert.deepEqual(Object.keys(line), ["route", "perl", "mode", "checks"]);
		const order = cell => canonicalJson(cell);
		assert.deepEqual(lines.map(order).toSorted(), cells.map(order).toSorted()
			, `${route}: Perl diagnostics must match every observation`);
		return Object.fromEntries(cells.map(cell =>
			[`${cell.perl}/${cell.mode}`, cell.checks]));
	}
	const profiles = lane.profiles;
	const label = lane.kind === "managed" ? `${lane.group}/${route}` : route;
	assert.deepEqual(entry.profiles, profiles);
	assert.deepEqual(Object.keys(entry.observations).toSorted()
		, [...profiles].toSorted());
	const checks = {};
	for(const profile of profiles)
	{
		const observed = entry.observations[profile];
		assert.ok(positive(observed.checks), `${label}/${profile}`);
		if(shape.resultOnly && lane.kind === "language")
			assert.equal(observed.checks, lane.resultOnlyChecks[profile]);
		if(shape.resultOnly && lane.kind === "managed" && profile !== "wit-wasi")
			assert.equal(observed.checks, 4);
		assert.equal(observed.consumerSha256, sha256(source(profile))
			, `${label}/${profile}`);
		checks[profile] = observed.checks;
	}
	if(lane.kind === "language")
	{
		assert.deepEqual(entry.lifecycle, lane.lifecycle);
		assert.deepEqual(Object.keys(entry.versions), profiles);
	}
	const expected = `${label}: ${profiles.map(profile =>
		`${profile}=${checks[profile]}`).join(", ")}`;
	assert.equal(diagnostics.filter(line => line === expected).length, 1
		, `${label}: one summary diagnostic`);
	assert.equal(diagnostics.filter(line => line.startsWith(`${label}: `)
		&& /=\d+(?:, |$)/u.test(line)).length, 1, `${label}: no competing summary`);
	return checks;
};

/**
 * Verify one retained package set against the report entry that names it.
 *
 * @param lane - Hosted lane contract.
 * @param packagingRoot - Extracted packaging directory.
 * @param entry - Report entry for one route.
 */
const checkRetainedPackageSet = async (lane, packagingRoot, entry) => {
	const path = `${lane.evidence}/${entry.route}/handoff`;
	assert.equal(entry.retainedPackageSet.path, path, entry.route);
	const root = join(packagingRoot, path);
	const { receipt, result } = await readVerifiedPackageSetReceipt({
		receiptPath: join(root, packageSetReceiptName)
	});
	const artifacts = receipt.packages.flatMap(pkg => pkg.artifacts);
	const files = [packageSetReceiptName, `${packageSetReceiptName}.sha256`
		, ...artifacts.map(artifact => artifact.path)].toSorted();
	assert.deepEqual(await regularFiles(root), files
		, `${entry.route}: retained evidence must be exactly the receipt-named set`);
	assert.deepEqual([...new Set(receipt.packages.map(pkg => pkg.target))]
		.toSorted(), [...lane.targets].toSorted(), `${entry.route}: package targets`);
	const archiveBytes = artifacts.reduce((total, artifact) =>
		total + artifact.bytes, 0);
	assert.deepEqual(entry.retainedPackageSet, { path
		, receiptSha256: result.receiptSha256, archives: result.archives
		, archiveBytes, files }, `${entry.route}: retained package metadata`);
	if(lane.kind === "managed")
		assert.equal(entry.packageSetReceiptSha256, sha256(canonicalJson(receipt))
			, entry.route);
	else assert.deepEqual(entry.packageSetReceipt, receipt, entry.route);
	return { path, receiptSha256: result.receiptSha256
		, archives: result.archives, archiveBytes
		, packages: result.packages };
};

/**
 * Replay a complete hosted output tree for one lane.
 *
 * @param laneName - Lane whose contract the output must satisfy.
 * @param root - Extracted original artifact root.
 * @param producer - Full producer revision named by the hosted run.
 * @param original - Reader of committed source bytes at `producer`.
 */
export const replayOwnedCheckedRecordHostedOutput = async (
	laneName, root, producer, original = path => execFileSync("git"
		, ["show", `${producer}:${path}`], { maxBuffer: 64 * 1024 ** 2 })
) => {
	assert.ok(Object.hasOwn(ownedCheckedRecordHostedLanes, laneName), laneName);
	assert.match(producer, /^[a-f0-9]{40}$/u);
	const lane = ownedCheckedRecordHostedLanes[laneName];
	if(lane.kind === "javascript")
		return replayJavaScript(lane, root, producer);
	const packagingRoot = join(root, lane.packaging);
	const reportPath = `${lane.packaging}/${lane.report}`;
	const reportBytes = await readFile(join(root, reportPath));
	const report = JSON.parse(reportBytes);
	assert.equal(reportBytes.toString("utf8"), canonicalJson(report)
		, "Hosted report must be canonical");
	assert.deepEqual(Object.keys(report).toSorted(), ["profile", "reports"
		, "schemaVersion", ...lane.kind === "language" ? ["selectedProfiles"] : []
		, ...lane.kind === "managed" ? ["group"] : []].toSorted());
	assert.equal(report.schemaVersion, 1);
	assert.equal(report.profile, lane.reportProfile);
	if(lane.kind === "language")
		assert.deepEqual(report.selectedProfiles, lane.profiles);
	if(lane.kind === "managed") assert.equal(report.group, lane.group);
	assert.deepEqual(report.reports.map(entry => entry.route)
		, [...ownedCheckedRecordHostedRoutes]);
	const acceptancePath = `${lane.ci}/acceptance.log`;
	const acceptance = await readFile(join(root, acceptancePath), "utf8");
	const tap = parseOwnedCheckedRecordTap(acceptance);
	assert.deepEqual(tap.tests, ownedCheckedRecordHostedTestNames(lane)
		, "Acceptance TAP must contain exactly the lane's tests in order");
	const read = path => original(path);
	const routes = [], members = [`${lane.ci}/toolchain.log`, acceptancePath
		, reportPath];
	for(const entry of report.reports)
	{
		const shape = routeShape(entry.route);
		assert.deepEqual(Object.keys(entry).toSorted(), [...lane.keys]
			, `${entry.route}: exact report fields`);
		assert.equal(entry.authorRoute, shape.authorRoute, entry.route);
		assert.equal(entry.mode, shape.mode, entry.route);
		if(lane.kind === "managed") assert.equal(entry.group, lane.group);
		for(const key of lane.always) assert.equal(entry[key], true
			, `${entry.route}: ${key}`);
		for(const key of lane.fullOnly) assert.equal(entry[key], !shape.resultOnly
			, `${entry.route}: ${key}`);
		const retained = await checkRetainedPackageSet(lane, packagingRoot, entry);
		members.push(...entry.retainedPackageSet.files.map(file =>
			`${lane.packaging}/${retained.path}/${file}`));
		const checks = checkObservations({ lane, entry, shape
			, diagnostics: tap.diagnostics
			, source: profile => consumerSource(read, lane, profile, shape.resultOnly) });
		routes.push({ route: entry.route, ...retained, checks });
	}
	assert.deepEqual(await regularFiles(root), members.toSorted()
		, "Hosted output must contain exactly the logs, report and retained package sets");
	return {
		schemaVersion: 1, kind: "owned-checked-record-hosted-replay"
		, lane: laneName, producerCommit: producer
		, reportSha256: sha256(reportBytes)
		, acceptanceLogSha256: sha256(Buffer.from(acceptance))
		, tests: tap.tests.length, routes
	};
};
