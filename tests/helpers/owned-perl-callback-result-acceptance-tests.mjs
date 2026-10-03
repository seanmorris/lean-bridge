/**
 * Require the complete frozen Perl receipt without inflating installed support.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import ts from "typescript";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforePostPerlCallbackStaging } from "./post-perl-callback-staging-history.mjs";
import { unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { assertOwnedPerlCallbackAcceptance, assertOwnedPerlCallbackReport
	, ownedPerlCallbackEvidencePath, ownedPerlCallbackSourcePaths } from "./owned-perl-callback-result-acceptance.mjs";
import { ownedPerlCallbackExecutionPaths, ownedPerlCallbackEvidencePaths } from "./owned-perl-callback-result-ci.mjs";

const receipt = async () => JSON.parse(await readFile(ownedPerlCallbackEvidencePath, "utf8"));
test("Perl acceptance covers the execution and verifier import closure", async () => {
	const paths = new Set(await ownedPerlCallbackSourcePaths());
	const pending = [...ownedPerlCallbackExecutionPaths
		, ...ownedPerlCallbackEvidencePaths
		, "scripts/record-owned-perl-callback-results.mjs"
		, "tests/helpers/owned-perl-callback-result-acceptance-tests.mjs"];
	const visited = new Set();
	while(pending.length)
	{
		const path = pending.pop();
		if(visited.has(path)) continue;
		assert.ok(paths.has(path), `Unrecorded imported source: ${path}`);
		visited.add(path);
		if(!path.endsWith(".mjs")) continue;
		const source = beforePostPerlCallbackStaging(path, await readFile(path, "utf8"));
		const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		const visit = node => {
			const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
				: ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null;
			if(specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith("."))
				pending.push(join(dirname(path), specifier.text));
			ts.forEachChild(node, visit);
		};
		visit(tree);
	}
	for(const path of ["scripts/build-perl-toolchains.mjs", "package-lock.json"])
		assert.ok(paths.has(path), `Unrecorded CI toolchain input: ${path}`);
});

test("Perl acceptance reconstructs all 18 reports and complete executed probes", async () => {
	await assertOwnedPerlCallbackAcceptance(await receipt());
});

test("Perl acceptance rejects skipped runs, changed sources and inflated guarantees", async t => {
	const original = await receipt();
	const mutations = [
		item => item.schemaVersion++
		, item => item.acceptance = "pending"
		, item => item.baselineRevision = "0".repeat(40)
		, item => item.previous.sha256 = "0".repeat(64)
		, item => item.sourceHistory.sha256 = "0".repeat(64)
		, item => item.sources[Object.keys(item.sources)[0]] = "0".repeat(64)
		, item => delete item.sources[Object.keys(item.sources)[0]]
		, item => item.sources["unrecorded-source.mjs"] = "a".repeat(64)
		, item => item.runs.pop()
		, item => item.runs.push(item.runs[0])
		, item => item.runs.reverse()
		, item => item.verification.exitCode = 1
		, item => item.verification.command = "node --test unrelated.test.mjs"
		, item => item.scope.leakFreeClaim = true
		, item => item.scope.explicitNoHostInstalledPackage = true
		, item => item.scope.explicitHostOnlyInstalledPackage = true
		, item => item.scope.prebuiltLeanRuntimeInstrumented = true
		, item => item.scope.installedPrivateCleanupCounters = true
		, item => item.scope.sharedReleaseIndependentRebuild = true
		, item => item.scope.installedSupportPromotions++
		, item => item.scope.retainedHostCallbacks = true
		, item => item.scope.asynchronousDelivery = true
		, item => item.scope.profiles.push("php-native")
		, item => item.scope.perlAbis.pop()
		, item => delete item.archive.reports[Object.keys(item.archive.reports)[0]]
		, item => item.archive.reports[Object.keys(item.archive.reports)[0]].sha256 = "0".repeat(64)
	];
	for(const index of original.runs.keys()) mutations.push(
		item => item.runs[index].exitCode = 1
		, item => item.runs[index].tests++
		, item => { item.runs[index].text = item.runs[index].text.replace("# skipped 0", "# skipped 1"); item.runs[index].sha256 = sha256(item.runs[index].text); }
		, item => { item.runs[index].text = item.runs[index].text.replace(/^# Subtest: /mu, "# Subtest: unrelated "); item.runs[index].sha256 = sha256(item.runs[index].text); }
	);
	for(const change of mutations)
	{
		const item = structuredClone(original); change(item);
		await assert.rejects(() => assertOwnedPerlCallbackAcceptance(item));
	}
	t.diagnostic(`${mutations.length} altered acceptance claims rejected`);
});

test("Perl acceptance binds every report slot to its mode and execution boundary", async t => {
	const reports = unpackOwnedCallbackReports((await receipt()).archive);
	let rejected = 0;
	for(const [path, original] of Object.entries(reports))
	{
		const item = structuredClone(original);
		item.mode = item.mode === "ordinary" ? "reviewed" : "ordinary";
		await assert.rejects(() => assertOwnedPerlCallbackReport(path, item)); rejected++;
		await assert.rejects(() => assertOwnedPerlCallbackReport(path + ".unrecorded", original)); rejected++;
	}
	for(const mode of ["ordinary", "reviewed"])
	{
		const direct = `build/owned-perl-callback-results/${mode}-combined.json`;
		const installed = `build/owned-perl-callback-results/${mode}-combined-package.json`;
		await assert.rejects(() => assertOwnedPerlCallbackReport(installed, reports[direct])); rejected++;
		await assert.rejects(() => assertOwnedPerlCallbackReport(direct, reports[installed])); rejected++;
	}
	t.diagnostic(`${rejected} false report-slot claims rejected`);
});
