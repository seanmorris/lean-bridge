/**
 * Exact package retention for hosted owned Subtype acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	appendFile, mkdir, mkdtemp, readFile, rm, writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import {
	packageSetReceiptName, writePackageSetReceipt
} from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import {
	clearOwnedSubtypeRetainedPackages, retainOwnedSubtypeRoute
	, verifyOwnedSubtypeRetainedPackages
	, writeOwnedSubtypeRetainedPackages
} from "./helpers/owned-subtype-retained-packages.mjs";

const digest = value => value.repeat(64);

const producedRelease = async (root, route) => {
	const profile = { id: "native-library-v1"
		, bindingIrSha256: digest("1"), runtimeIdentity: digest("2") };
	const packages = [];
	for(const target of ["c", "cpp"])
	{
		const path = `archives/${target}/owned-subtypes-${route}.fixture`;
		const bytes = Buffer.from(`Inert ${target} archive for ${route}\n`);
		await saveLakeFile(root, path, bytes);
		packages.push({ target, ecosystem: target, name: "owned-subtypes"
			, version: "1.0.0", profile: profile.id, role: "component"
			, runtimeIdentity: profile.runtimeIdentity
			, runtimeDelivery: "embedded", requires: []
			, artifacts: [{ path, bytes: bytes.length, sha256: sha256(bytes) }] });
	}
	return writePackageSetReceipt({ root
		, component: { id: "owned-subtypes@1.0.0", name: "owned-subtypes"
			, version: "1.0.0" }
		, source: { treeSha256: digest("9") }
		, profiles: [profile], packages });
};

const retainedLane = async (t, { hashOnly = false } = {}) => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-subtype-retained-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const output = join(root, "lane/report.json");
	await clearOwnedSubtypeRetainedPackages(output);
	const entries = [], reports = [];
	for(const route of ["ordinary", "reviewed"])
	{
		const release = join(root, `${route}-release`);
		await producedRelease(release, route);
		const handoff = join(root, `${route}-handoff`);
		const { receipt, entry } = await retainOwnedSubtypeRoute({
			output, route, source: release, handoff });
		entries.push(entry);
		assert.equal(sha256(await readFile(join(handoff, packageSetReceiptName)))
			, entry.receiptSha256);
		reports.push(hashOnly
			? { route, packageSetReceiptSha256: entry.receiptSha256 }
			: { reviewed: route === "reviewed", packageSetReceipt: receipt });
	}
	await writeOwnedSubtypeRetainedPackages(output, entries.toReversed());
	return { root, output, outputRoot: dirname(output)
		, report: { schemaVersion: 1, reports } };
};

test("owned Subtype retention authenticates full and digest-only reports", async t => {
	for(const hashOnly of [false, true])
	{
		const lane = await retainedLane(t, { hashOnly });
		const summary = await verifyOwnedSubtypeRetainedPackages(
			lane.outputRoot, lane.report);
		assert.deepEqual(summary.routes.map(route => route.route)
			, ["ordinary", "reviewed"]);
		for(const route of summary.routes)
			assert.ok(route.archives === 2 && route.archiveBytes > 0);
	}
});

test("owned Subtype retention rejects package and inventory tampering", async t => {
	const rejects = async (change, pattern) => {
		const lane = await retainedLane(t);
		await change(lane);
		await assert.rejects(verifyOwnedSubtypeRetainedPackages(
			lane.outputRoot, lane.report), pattern);
	};
	await rejects(({ outputRoot }) => appendFile(join(outputRoot
		, "evidence/ordinary/handoff/archives/c/owned-subtypes-ordinary.fixture")
	, "x"), /Archive differs|archive-mismatch/u);
	await rejects(({ outputRoot }) => writeFile(join(outputRoot
		, "evidence/reviewed/handoff/extra.txt"), "extra\n")
	, /receipt-named/u);
	await rejects(({ outputRoot }) => mkdir(join(outputRoot
		, "evidence/ordinary/handoff/empty")), /empty directories/u);
	await rejects(async ({ outputRoot }) => {
		const path = join(outputRoot, "retained-packages.json");
		await writeFile(path, JSON.stringify(JSON.parse(await readFile(path))));
	}, /must be canonical/u);
	await rejects(async ({ outputRoot }) => {
		await saveLakeFile(outputRoot, "evidence/stale/handoff/extra.txt", "stale\n");
	}, /only the two route package sets/u);
	await rejects(async ({ report }) => {
		report.reports[0].packageSetReceipt.packages[0].name = "forged";
	}, /report contains the retained receipt/u);
});

test("owned Subtype workflows upload retained package directories", async () => {
	for(const [workflow, root] of [
		["native", "owned-subtype-native-packaging"]
		, ["perl", "owned-subtype-perl-packaging"]
		, ["languages", "owned-subtype-language-packaging"]
		, ["remaining", "owned-subtype-remaining-packaging"]
	]) {
		const source = await readFile(`.github/workflows/owned-subtype-${workflow}.yml`
			, "utf8");
		assert.ok(source.includes(`test -s build/${root}/retained-packages.json`)
			, workflow);
		assert.ok(source.includes("node scripts/check-owned-subtype-ci.mjs")
			, workflow);
		assert.ok(source.includes(`build/${root}/verification.json`), workflow);
		assert.ok(source.includes(`build/${root}/`), workflow);
	}
	for(const path of [
		"tests/owned-subtype-native-packaging.test.mjs"
		, "tests/owned-subtype-perl-packaging.test.mjs"
		, "tests/owned-subtype-language-packaging.test.mjs"
		, "tests/owned-subtype-remaining-packaging.test.mjs"
	]) {
		const source = await readFile(path, "utf8");
		assert.match(source, /await retainOwnedSubtypeRoute\(\{/u, path);
		assert.match(source, /await writeOwnedSubtypeRetainedPackages\(/u, path);
		assert.doesNotMatch(source, /copyPackageSetHandoff\(/u, path);
	}
});
