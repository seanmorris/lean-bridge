/**
 * Closed recursive checked-record CPAN selections and one immutable Perl caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	mutualCheckedRecordConfiguration, mutualCheckedRecordFixtureRoot
	, mutualCheckedRecordModule, mutualCheckedRecordReview
} from "./mutual-checked-record-fixture.mjs";
import {
	recursiveCheckedRecordConfiguration, recursiveCheckedRecordFixtureRoot
	, recursiveCheckedRecordModule, recursiveCheckedRecordReview
} from "./recursive-checked-record-fixture.mjs";

export const recursiveCheckedRecordPerlRoutes = Object.freeze(["ordinary", "reviewed"]);
export const recursiveCheckedRecordPerlFixtures = Object.freeze(["recursive", "mutual"]);
export const recursiveCheckedRecordPerlCallerPath
	= "tests/fixtures/recursive-checked-record-consumers/perl.pl";
const fixtures = Object.freeze({
	recursive: Object.freeze({
		root: recursiveCheckedRecordFixtureRoot
		, leanModule: recursiveCheckedRecordModule
		, module: "LeanBridge::RecursiveCheckedRecords"
		, review: recursiveCheckedRecordReview
		, configuration: recursiveCheckedRecordConfiguration
	})
	, mutual: Object.freeze({
		root: mutualCheckedRecordFixtureRoot, leanModule: mutualCheckedRecordModule
		, module: "LeanBridge::MutualCheckedRecords"
		, review: mutualCheckedRecordReview
		, configuration: mutualCheckedRecordConfiguration
	})
});

/** Exact totals are pinned after the independent caller and native packages execute. */
export const recursiveCheckedRecordPerlExpected = Object.freeze({
	recursive: null
	, mutual: null
});

/**
 * Return immutable CPAN coordinates and source identity for one fixture.
 *
 * @param fixture - Recursive or mutual fixture name.
 */
export const recursiveCheckedRecordPerlPackage = fixture => {
	assert.ok(recursiveCheckedRecordPerlFixtures.includes(fixture));
	return fixtures[fixture];
};

/**
 * Ordinary and reviewed routes differ only in their authenticated source selection.
 *
 * @param route - Ordinary or independently reviewed author route.
 * @param fixture - Recursive or mutual fixture name.
 */
export const recursiveCheckedRecordPerlConfiguration = (route, fixture) => {
	assert.ok(recursiveCheckedRecordPerlRoutes.includes(route));
	const selected = recursiveCheckedRecordPerlPackage(fixture);
	return { ...selected.configuration(route)
		, targets: { cpan: { module: selected.module, version: "1.000" } } };
};

/**
 * Independent reviewed IR for the exact recursive or mutual fixture.
 *
 * @param fixture - Recursive or mutual fixture name.
 */
export const recursiveCheckedRecordPerlReview = fixture => {
	const selected = recursiveCheckedRecordPerlPackage(fixture);
	return selected.review();
};

/** The checked-in caller bytes are identical for all four selections. */
export const loadRecursiveCheckedRecordPerlCaller = () =>
	readFile(recursiveCheckedRecordPerlCallerPath, "utf8");

/**
 * Pass the fixture and route explicitly without rewriting caller source.
 *
 * @param fixture - Recursive or mutual fixture name.
 * @param route - Ordinary or independently reviewed author route.
 */
export const recursiveCheckedRecordPerlCallerArguments = (fixture, route) => {
	assert.ok(recursiveCheckedRecordPerlFixtures.includes(fixture));
	assert.ok(recursiveCheckedRecordPerlRoutes.includes(route));
	return ["consumer.pl", fixture, route];
};

/**
 * Require the complete installed caller envelope and exact pinned totals.
 *
 * @param source - Complete original caller stdout.
 * @param fixture - Recursive or mutual fixture name.
 * @param route - Ordinary or independently reviewed author route.
 */
export const parseRecursiveCheckedRecordPerlResult = (source, fixture, route) => {
	assert.ok(recursiveCheckedRecordPerlFixtures.includes(fixture));
	assert.ok(recursiveCheckedRecordPerlRoutes.includes(route));
	const value = JSON.parse(source);
	assert.deepEqual(Object.keys(value).sort(), [
		"api", "calls", "checks", "failures", "fixture", "hostRejections"
		, "nativeLibraries", "perl", "recoveries", "rejections", "rounds"
		, "route", "snapshotControls", "snapshots", "threaded", "wordBits"
	].sort());
	assert.equal(value.fixture, fixture); assert.equal(value.route, route);
	assert.equal(value.rounds, 64); assert.equal(value.wordBits, 64);
	assert.match(value.perl, /^v5\.(?:36|38)\.\d+$/u);
	assert.equal(typeof value.threaded, "boolean");
	assert.match(value.api, new RegExp(`/LeanBridge/${fixture === "recursive"
		? "Recursive" : "Mutual"}CheckedRecords\\.pm$`, "u"));
	for(const name of [
		"calls", "checks", "hostRejections", "recoveries", "rejections"
		, "snapshotControls", "snapshots"
	]) assert.ok(Number.isSafeInteger(value[name]) && value[name] >= 0, name);
	assert.ok(value.failures && Object.getPrototypeOf(value.failures) === Object.prototype);
	for(const [name, message] of Object.entries(value.failures))
	{
		assert.match(name, /^[a-z][a-z0-9 -]*$/u);
		assert.ok(typeof message === "string" && message.length > 0);
	}
	assert.ok(value.nativeLibraries
		&& Object.getPrototypeOf(value.nativeLibraries) === Object.prototype);
	assert.ok(Object.keys(value.nativeLibraries).length >= 2);
	for(const [path, digest] of Object.entries(value.nativeLibraries))
	{
		assert.match(path, /^(?:[A-Za-z0-9_.+-]+\/)*[A-Za-z0-9_.+-]+$/u);
		assert.match(digest, /^[a-f0-9]{64}$/u);
	}
	const expected = recursiveCheckedRecordPerlExpected[fixture];
	if(expected !== null)
		for(const [name, count] of Object.entries(expected)) assert.equal(value[name], count, name);
	return value;
};
