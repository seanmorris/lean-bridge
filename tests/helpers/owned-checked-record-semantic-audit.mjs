/**
 * Join the owned checked-record source contracts to their retained executions.
 *
 * The complete hosted replay proves archive and package integrity. This audit
 * answers the separate semantic question: did the exact consumer source that
 * ran contain every claimed mixed-transport case, and did result-only routes
 * omit the input, transfer and callback surface? Every byte is read from the
 * selected immutable Git archive and checked against its index before use.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import {
	ownedCheckedRecordHostedLaneNames, ownedCheckedRecordHostedLanes
	, ownedCheckedRecordHostedRoutes
} from "./owned-checked-record-hosted-contracts.mjs";
import {
	ownedCheckedRecordPromotionProfiles
	, ownedCheckedRecordPromotionSelectionPath
} from "./owned-checked-record-promotion.mjs";

const sourceProfiles = Object.freeze({
	native: Object.freeze({
		c: ["owned-checked-record-installed.c", "owned-checked-record-result-only.c"]
		, cpp: ["owned-checked-record-installed.cpp", "owned-checked-record-result-only.cpp"]
	})
	, perl: Object.freeze({
		perl: ["owned-checked-record-installed.pl", "owned-checked-record-result-only.pl"]
	})
	, python: Object.freeze({
		python: ["owned-checked-record-python.py", "owned-checked-record-result-only-python.py"]
	})
	, ruby: Object.freeze({
		ruby: ["owned-checked-record-ruby.rb", "owned-checked-record-result-only-ruby.rb"]
	})
	, rust: Object.freeze({
		rust: ["owned-checked-record-rust.rs", "owned-checked-record-result-only-rust.rs"]
	})
	, dotnet: Object.freeze({
		dotnet: ["owned-checked-record-dotnet.cs", "owned-checked-record-result-only-dotnet.cs"]
	})
	, jvm: Object.freeze({
		java: ["owned-checked-record-java.java", "owned-checked-record-result-only-java.java"]
		, kotlin: ["owned-checked-record-kotlin.kt", "owned-checked-record-result-only-kotlin.kt"]
	})
	, php: Object.freeze({
		"php-native": ["owned-checked-record-php.php", "owned-checked-record-result-only-php.php"]
	})
	, wit: Object.freeze({
		"wit-wasi": ["owned-checked-record-installed.c", "owned-checked-record-result-only.c"]
	})
	, "php-wasm": Object.freeze({
		"php-wasm": ["owned-checked-record-php-wasm.php"
			, "owned-checked-record-result-only-php-wasm.php"]
	})
});

const sourceRoot = "tests/fixtures/structured-types/";
const javascriptConsumer = "tests/owned-checked-record-javascript-packaging.test.mjs";
const fullOperations = Object.freeze([
	"echoBooking", "echoClaims", "pairClaim", "transferClaim"
	, "transferPairClaim", "transferWithClaimCallback"
	, "withClaimCallback", "claimClosure", "retain", "claimFor"
]);
const resultOnlyOperations = Object.freeze(["claimFor", "newTicket"]);
const forbiddenResultOnlyOperations = Object.freeze([
	"echoBooking", "echoClaims", "pairClaim", "transferClaim"
	, "transferPairClaim", "transferWithClaimCallback"
	, "withClaimCallback", "claimClosure", "retain"
]);
const nativeFullFlags = Object.freeze([
	"callbackRecovery", "earlyAndLateRejection", "outputAtomicity"
	, "unchangedRejectedInputs"
]);
const perlFullFlags = Object.freeze([
	"callbackRecovery", "earlyAndLateRejection", "unchangedRejectedInputs"
]);
const languageFullFlags = Object.freeze([
	"constructorRejectionAndRecovery", "earlyAndLateRejection"
	, "hostCallbackRecovery", "mixedOwnedAndCopiedTransport"
	, "returnedClosureRecovery", "transferredInputCheckedBeforeHandoff"
	, "unchangedRejectedInputs"
]);

const identifier = value => value.toLowerCase().replaceAll(/[^a-z0-9]/gu, "");
const occurrences = (source, operation) => {
	const needle = identifier(operation), normalized = identifier(source);
	return normalized.split(needle).length - 1;
};
const operationCounts = source => Object.fromEntries(
	[...new Set([...fullOperations, ...resultOnlyOperations])]
		.map(operation => [operation, occurrences(source, operation)]));

/**
 * Audit one executable consumer source without trusting prose or a report flag.
 *
 * @param source - Exact consumer source bytes decoded as UTF-8.
 * @param options - Source identity and API mode.
 * @param options.label - Diagnostic identity.
 * @param options.resultOnly - Whether this is the deliberately narrow API.
 */
export const auditOwnedCheckedRecordConsumerSource = (source, {
	label, resultOnly
}) => {
	assert.equal(typeof source, "string", `${label}: source text`);
	assert.ok(source.length > 0, `${label}: non-empty source`);
	const operations = operationCounts(source);
	if(resultOnly)
	{
		for(const operation of resultOnlyOperations)
			assert.ok(operations[operation] > 0
				, `${label}: missing result-only operation ${operation}`);
		for(const operation of forbiddenResultOnlyOperations)
			assert.equal(operations[operation], 0
				, `${label}: result-only source exposes ${operation}`);
	}
	else
	{
		for(const operation of fullOperations)
			assert.ok(operations[operation] > 0
				, `${label}: missing full operation ${operation}`);
		assert.ok(operations.echoClaims >= 4
			, `${label}: arrays need success, late failure, empty and recovery`);
		assert.ok(operations.transferClaim >= 2
			, `${label}: transfer needs rejection and success`);
		assert.ok(operations.transferPairClaim >= 2
			, `${label}: paired transfer needs rollback and commit`);
		assert.ok(operations.transferWithClaimCallback >= 2
			, `${label}: post-transfer callback needs failure and recovery`);
		assert.ok(operations.withClaimCallback > operations.transferWithClaimCallback
			, `${label}: borrowed callback coverage is separate from transfer`);
		assert.ok(operations.pairClaim > operations.transferPairClaim
			, `${label}: borrowed pair coverage is separate from transfer`);
	}
	assert.ok(/(?:close|release|dispose|drop|use)/iu.test(source)
		, `${label}: explicit or automatic cleanup coverage`);
	return Object.freeze({ mode: resultOnly ? "result-only" : "full"
		, operations: Object.freeze(operations) });
};

const exactKeys = (value, keys, label) => assert.deepEqual(
	Object.keys(value).toSorted(), [...keys].toSorted(), label);
const routeShape = route => {
	const match = /^(ordinary|reviewed)-(full|result-only)$/u.exec(route);
	assert.ok(match, route);
	return { authorRoute: match[1], mode: match[2]
		, resultOnly: match[2] === "result-only" };
};
const positive = value => Number.isSafeInteger(value) && value > 0;
const transformedWit = (source, resultOnly) => source
	.replaceAll("owned_checked_records", "owned_checked_records_wasmtime")
	.replaceAll("OWNED_CHECKED_RECORDS", "OWNED_CHECKED_RECORDS_WASMTIME")
	.replace(`owned-checked-record-${resultOnly ? "result-only-" : ""}c:`
		, `owned-checked-record-${resultOnly ? "result-only-" : ""}wit-wasi:`);

const flagsFor = lane => lane.kind === "native" ? nativeFullFlags
	: lane.kind === "perl" ? perlFullFlags
		: lane.kind === "language" ? languageFullFlags : [];

const reportChecks = (lane, entry, shape, sources) => {
	const flags = flagsFor(lane);
	for(const flag of flags)
		assert.equal(entry[flag], !shape.resultOnly, `${entry.route}: ${flag}`);
	const profiles = lane.kind === "native" ? ["c", "cpp"]
		: lane.kind === "perl" ? ["perl"] : lane.profiles;
	const result = {};
	for(const profile of profiles)
	{
		const observed = lane.kind === "native" ? entry.observed[profile]
			: lane.kind === "perl" ? null : entry.observations[profile];
		const checks = lane.kind === "perl"
			? entry.observations.map(item => item.observed.checks) : [observed.checks];
		assert.ok(checks.length > 0 && checks.every(positive)
			, `${entry.route}/${profile}: executed checks`);
		const source = sources.get(`${profile}/${shape.mode}`);
		assert.ok(source, `${entry.route}/${profile}: selected source`);
		const expectedDigest = lane.group === "wit"
			? sha256(transformedWit(source.text, shape.resultOnly)) : source.sha256;
		if(lane.kind === "perl")
			assert.equal(entry.consumerSha256, expectedDigest, `${entry.route}/${profile}`);
		else assert.equal(observed.consumerSha256, expectedDigest
			, `${entry.route}/${profile}`);
		result[profile] = { checks: Math.min(...checks), executions: checks.length
			, consumerSha256: expectedDigest };
	}
	return result;
};

const javascriptRoutes = report => report.reports.map(entry => {
	const shape = routeShape(entry.route), observed = entry.observed;
	assert.equal(entry.authorRoute, shape.authorRoute, entry.route);
	assert.equal(entry.mode, shape.mode, entry.route);
	assert.ok(positive(observed.checks), `${entry.route}: executed checks`);
	if(shape.resultOnly)
	{
		exactKeys(observed, ["checks", "disposed", "fullApiOmitted"
			, "produced", "retained"], entry.route);
		for(const flag of ["disposed", "fullApiOmitted", "produced", "retained"])
			assert.equal(observed[flag], true, `${entry.route}: ${flag}`);
	}
	else
	{
		exactKeys(observed, ["bookingRejected", "callbackCalls"
			, "callbackRejected", "callbackThrown", "checks", "claimRejected"
			, "closureRejected", "lateRejected", "retainedRejected"
			, "transferRejected", "transferred"], entry.route);
		for(const flag of ["bookingRejected", "callbackRejected"
			, "callbackThrown", "claimRejected", "closureRejected"
			, "lateRejected", "retainedRejected", "transferRejected", "transferred"])
			assert.equal(observed[flag], true, `${entry.route}: ${flag}`);
		assert.equal(observed.callbackCalls, 1, `${entry.route}: callback calls`);
	}
	return { route: entry.route, mode: shape.mode
		, profiles: { javascript: { checks: observed.checks, executions: 1 } } };
});

const phpWasmChecks = observation => {
	const node = observation.executions.flatMap(run => [run]);
	const browser = observation.browser.observations.flatMap(item => item.executions);
	const executions = [...node, ...browser];
	assert.ok(executions.length > 0, "PHP-Wasm must retain executions");
	const checks = executions.map(run => {
		assert.equal(run.requestRecovery, true, "PHP-Wasm request recovery");
		assert.ok(positive(run.observed.checks), "PHP-Wasm executed checks");
		return run.observed.checks;
	});
	return { checks: Math.min(...checks), executions: checks.length };
};

const phpWasmRoutes = (report, sources) => {
	const routes = new Map();
	for(const entry of report.reports)
	{
		assert.ok(["full", "result-only"].includes(entry.mode), entry.mode);
		const source = sources.get(`php-wasm/${entry.mode}`);
		assert.ok(source, `PHP-Wasm ${entry.mode} source`);
		assert.deepEqual(entry.observations.map(item => item.reviewed), [false, true]);
		for(const observation of entry.observations)
		{
			assert.equal(observation.consumerSha256, source.sha256);
			const route = `${observation.reviewed ? "reviewed" : "ordinary"}-${entry.mode}`;
			routes.set(route, {
				route
				, mode: entry.mode
				, profiles: {
					"php-wasm": {
						...phpWasmChecks(observation)
						, consumerSha256: source.sha256
					}
				}
			});
		}
	}
	return ownedCheckedRecordHostedRoutes.map(route => routes.get(route));
};

const defaultReadGit = (revision, path) => execFileSync("git"
	, ["show", `${revision}:${path}`], { maxBuffer: 64 * 1024 ** 2 });

const boundArchiveReader = (root, index, readGit, revision) => {
	const files = new Map(index.files.map(file => [file.path, file]));
	assert.equal(files.size, index.files.length, `${index.lane}: duplicate files`);
	return path => {
		const descriptor = files.get(path);
		assert.ok(descriptor, `${index.lane}: unindexed ${path}`);
		const bytes = readGit(revision, `${root}/${path}`);
		assert.equal(bytes.length, descriptor.bytes, `${index.lane}: ${path} bytes`);
		assert.equal(sha256(bytes), descriptor.sha256, `${index.lane}: ${path} digest`);
		return { bytes, descriptor };
	};
};

const selectedConsumer = (index, path) => {
	const matches = index.selectedSources.filter(source =>
		source.role === "consumer" && source.path === path);
	assert.equal(matches.length, 1, `${index.lane}: selected consumer ${path}`);
	assert.equal(matches[0].revision, index.consumerCommit
		, `${index.lane}: consumer revision ${path}`);
	return matches[0];
};

const auditSources = (laneName, index, readBound) => {
	if(laneName === "javascript")
	{
		selectedConsumer(index, javascriptConsumer);
		const relative = `sources/consumer/${javascriptConsumer}`;
		const { bytes } = readBound(relative), text = bytes.toString("utf8");
		const operations = operationCounts(text);
		for(const operation of ["echoBooking", "pairClaim", "transferClaim"
			, "withClaimCallback", "claimClosure", "retain", "claimFor"])
			assert.ok(operations[operation] > 0
				, `javascript/full: missing operation ${operation}`);
		assert.ok(/(?:release|dispose)/u.test(text)
			, "javascript/full: cleanup coverage");
		assert.ok(occurrences(text, "fullApiOmitted") > 0
			, "javascript/result-only: omitted API assertion");
		const source = { profile: "javascript"
			, mode: "combined", path: javascriptConsumer, bytes: bytes.length
			, sha256: sha256(bytes), operations };
		return { map: new Map(), sources: [source] };
	}
	const profiles = sourceProfiles[laneName];
	assert.ok(profiles, `${laneName}: semantic source profile`);
	const map = new Map(), sources = [];
	for(const [profile, names] of Object.entries(profiles))
		for(const [index_, name] of names.entries())
		{
			const mode = index_ === 0 ? "full" : "result-only";
			const path = `${sourceRoot}${name}`;
			selectedConsumer(index, path);
			const { bytes } = readBound(`sources/consumer/${path}`);
			const text = bytes.toString("utf8");
			const audited = auditOwnedCheckedRecordConsumerSource(text, {
				label: `${laneName}/${profile}/${mode}`, resultOnly: index_ === 1
			});
			const value = { profile, mode, path, bytes: bytes.length
				, sha256: sha256(bytes), operations: audited.operations, text };
			map.set(`${profile}/${mode}`, value);
			sources.push(Object.fromEntries(Object.entries(value)
				.filter(([key]) => key !== "text")));
		}
	return { map, sources };
};

const auditLane = (selectionEntry, indexBytes, readGit, revision) => {
	assert.equal(sha256(indexBytes), selectionEntry.index.sha256
		, `${selectionEntry.lane}: selected index digest`);
	const index = JSON.parse(indexBytes);
	assert.equal(indexBytes.toString("utf8"), canonicalJson(index)
		, `${selectionEntry.lane}: canonical index`);
	assert.equal(index.lane, selectionEntry.lane);
	assert.equal(index.producerCommit, index.consumerCommit
		, `${index.lane}: execution and consumer revision`);
	const root = dirname(selectionEntry.index.path);
	const readBound = boundArchiveReader(root, index, readGit, revision);
	const auditedSources = auditSources(index.lane, index, readBound);
	const lane = ownedCheckedRecordHostedLanes[index.lane];
	const reportPath = `hosted/output/${lane.packaging}/${lane.report}`;
	const reportBytes = readBound(reportPath).bytes;
	const report = JSON.parse(reportBytes);
	assert.equal(reportBytes.toString("utf8"), canonicalJson(report)
		, `${index.lane}: canonical report`);
	if(index.lane === "php-wasm")
		assert.deepEqual(report.reports.map(entry => entry.mode)
			, ["full", "result-only"], `${index.lane}: report modes`);
	else assert.deepEqual(report.reports.map(entry => entry.route)
		, ownedCheckedRecordHostedRoutes, `${index.lane}: report routes`);
	let routes;
	if(index.lane === "javascript") routes = javascriptRoutes(report);
	else if(index.lane === "php-wasm")
		routes = phpWasmRoutes(report, auditedSources.map);
	else routes = report.reports.map(entry => {
		const shape = routeShape(entry.route);
		assert.equal(entry.authorRoute, shape.authorRoute, entry.route);
		assert.equal(entry.mode, shape.mode, entry.route);
		return { route: entry.route, mode: shape.mode
			, profiles: reportChecks(lane, entry, shape, auditedSources.map) };
	});
	assert.deepEqual(routes.map(entry => entry.route), ownedCheckedRecordHostedRoutes);
	return {
		lane: index.lane, producerCommit: index.producerCommit
		, profiles: [...ownedCheckedRecordPromotionProfiles[index.lane]]
		, index: selectionEntry.index
		, report: { path: `${root}/${reportPath}`, bytes: reportBytes.length
			, sha256: sha256(reportBytes) }
		, sources: auditedSources.sources, routes
	};
};

/**
 * Audit the complete selected eleven-lane matrix from immutable Git bytes.
 *
 * @param options - Reader and selection override for tests.
 * @param options.selectionPath - Committed selection to audit.
 * @param options.revision - Git revision containing the selection and archives.
 * @param options.readGit - Exact Git blob reader.
 */
export const auditOwnedCheckedRecordSemanticMatrix = ({
	selectionPath = ownedCheckedRecordPromotionSelectionPath
	, revision = "HEAD", readGit = defaultReadGit
} = {}) => {
	const selectionBytes = readGit(revision, selectionPath);
	const selection = JSON.parse(selectionBytes);
	assert.equal(selectionBytes.toString("utf8"), canonicalJson(selection)
		, "Semantic audit selection must be canonical");
	assert.deepEqual(selection.archives.map(entry => entry.lane)
		, ownedCheckedRecordHostedLaneNames);
	const lanes = selection.archives.map(entry => auditLane(entry
		, readGit(revision, entry.index.path), readGit, revision));
	const coverage = {
		lanes: lanes.length
		, profiles: new Set(lanes.flatMap(lane => lane.profiles)).size
		, routes: lanes.reduce((total, lane) => total + lane.routes.length, 0)
		, consumerSources: lanes.reduce((total, lane) => total + lane.sources.length, 0)
		, executedCells: lanes.reduce((total, lane) => total + lane.routes.reduce(
			(sum, route) => sum + Object.keys(route.profiles).length, 0), 0)
	};
	assert.deepEqual(coverage, { lanes: 11, profiles: 17, routes: 44
		, consumerSources: 25, executedCells: 52 });
	return {
		schemaVersion: 1
		, kind: "owned-checked-record-semantic-audit-v1"
		, selection: { path: selectionPath, bytes: selectionBytes.length
			, sha256: sha256(selectionBytes) }
		, requirements: {
			full: [...fullOperations]
			, resultOnly: [...resultOnlyOperations]
			, resultOnlyForbidden: [...forbiddenResultOnlyOperations]
		}
		, coverage, lanes
		, boundary: "This joins exact retained consumer source to executed hosted reports. The complete aligned matrix verifier separately authenticates package bytes, source-free installation, API records, artifact ZIPs and report structure. The audit covers the tested acyclic Booking, Window, Claim, Ticket and Grant corpus; it does not claim recursive owned graphs, retained or asynchronous callbacks, arbitrary predicates, dispatch cost or peak memory."
	};
};
