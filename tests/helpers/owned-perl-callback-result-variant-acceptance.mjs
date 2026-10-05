/**
 * Freeze only the four optional installed Perl matrices and their predecessor.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import ts from "typescript";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { packOwnedCallbackReports, unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { beforePostPerlCallbackStaging } from "./post-perl-callback-staging-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { assertOwnedPerlCallbackVariantMatrix, assertOwnedPerlCallbackVariantLog
	, assertOwnedPerlCallbackVariantTap
	, ownedPerlCallbackVariantReports } from "./owned-perl-callback-result-variant-evidence.mjs";
import { assertOwnedPerlCallbackResultCi, ownedPerlCallbackExecutionPaths
	, ownedPerlCallbackEvidencePaths } from "./owned-perl-callback-result-ci.mjs";
import { perlVariantBaseline, perlVariantHistoryPath, perlVariantHistorySha256
	, perlVariantPredecessor, perlVariantChangedPaths, readPerlVariantHistory } from "./owned-perl-callback-result-variant-history.mjs";

const keys = (value, names) => assert.deepEqual(Object.keys(value).sort(), names.split(" ").sort());
const freeze = value => {
	if(value && typeof value === "object")
	{ Object.values(value).forEach(freeze); Object.freeze(value); }
	return value;
};
export const perlVariantEvidencePath = "docs/evidence/owned-perl-callback-result-variants-20261003.json";
export const perlVariantEvidenceDocument = "docs/evidence/owned-perl-callback-result-variants-20261003.md";
export const perlVariantCounts = freeze({ configurations: 4, producers: 8, prefixes: 32, runs: 64, checks: 3296, assetRejections: 192 });
export const perlVariantScope = freeze({
	profiles: ["perl"], sourcePaths: ["ordinary-source", "reviewed-ir"]
	, installedConfigurations: ["no-host", "host"]
	, explicitNoHostInstalledPackage: true, explicitHostOnlyInstalledPackage: true
	, installModes: ["prebuilt-only", "build-xs"]
	, perlAbis: ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"]
	, producerInterfaces: { "no-host": "installed native build API", host: "installed CLI build command" }
	, counts: perlVariantCounts, independentProducerBuilds: true
	, deterministicReassembly: true
	, sourceFreeConsumption: true, relocatedPublicReruns: true
	, combinedConfigurationsAdded: false, sharedCrossLanguageRelease: false
	, nativeAllocationOrOwnerCounters: false, forkOrThreadLifetimeAdded: false
	, callbackInputTransfers: false, retainedHostCallbacks: false
	, asynchronousDelivery: false, registryPublication: false
	, installedSupportPromotions: 0
});
export const perlVariantExcluded = freeze([
	{ path: "build-perl-callback-variants-ordinary-no-host.log"
		, sha256: "94c8e99a2d38797470fe31aa22762b6968fd61b4a8ad9cdb04137ec503c18b6a" }
	, { path: "build/owned-perl-callback-result-variants/ordinary-no-host-package-handoff-tQRk8o/observations.partial.json"
		, sha256: "3b795067d23154ba5bd4f76b40e4dfa46341fc901181112731017b406f365845" }
].map(value => ({ ...value, reason: "failed preliminary harness; no installed acceptance counted" })));
export const perlVariantRunSlots = freeze([
	{ name: "ordinary-no-host", reports: ownedPerlCallbackVariantReports.slice(0, 1) }
	, { name: "remaining-three", reports: ownedPerlCallbackVariantReports.slice(1) }
]);
export const perlVariantVerificationCommand = "LEAN_BRIDGE_OWNED_PERL_CALLBACK_RESULT_EVIDENCE_TEST=1 node --test tests/helpers/owned-perl-callback-result-variant-evidence-tests.mjs";
const helper = name => `tests/helpers/owned-perl-callback-result-variant-${name}.mjs`;
export const perlVariantClosureRoots = freeze([
	...ownedPerlCallbackExecutionPaths, ...ownedPerlCallbackEvidencePaths
	, ...["acceptance", "acceptance-tests", "history", "history-tests"].map(helper)
	, helper("producer")
	, "scripts/update-owned-perl-callback-variant-history.mjs"
	, "scripts/record-owned-perl-callback-variants.mjs"
]);

/** Bind predecessor coverage, installed CLI inputs, and the full local import closure. */
export const perlVariantSourcePaths = async () => {
	const predecessor = await readFile(perlVariantPredecessor.path);
	assert.equal(sha256(predecessor), perlVariantPredecessor.sha256);
	const paths = new Set([...Object.keys(JSON.parse(predecessor).sources)
		, ...perlVariantChangedPaths, perlVariantHistoryPath
		, perlVariantPredecessor.path
		, perlVariantEvidenceDocument, "config/cli-package.v1.json"
		, "docs/evidence/post-perl-callback-staging-source-history-20261003.json"
		, "docs/evidence/wit-callback-runtime-staging-source-history-20261003.json"
		, "tests/fixtures/structured-types/owned-perl-callback-results-variants-installed.pl"
		, ...JSON.parse(beforeFinRefinementSource("config/cli-package.v1.json", await readFile("config/cli-package.v1.json", "utf8"))).files]);
	const pending = [...perlVariantClosureRoots], visited = new Set();
	while(pending.length)
	{
		const path = pending.pop();
		if(visited.has(path)) continue;
		visited.add(path); paths.add(path);
		if(!path.endsWith(".mjs")) continue;
		const tree = ts.createSourceFile(path, beforeFinRefinementSource(path, await readFile(path, "utf8")), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
		const visit = node => {
			const specifier = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
				: ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0] : null;
			if(specifier && ts.isStringLiteral(specifier) && specifier.text.startsWith(".")) pending.push(join(dirname(path), specifier.text));
			ts.forEachChild(node, visit);
		};
		visit(tree);
	}
	assert.equal(paths.delete("tests/helpers/php-callback-installed-staging-history.mjs"), true);
	assert.equal(paths.delete("tests/helpers/php-callback-acceptance-history.mjs"), true);
	assert.equal(paths.delete("tests/helpers/php-wasm-callback-result-acceptance-history.mjs"), true);
	assert.equal(paths.delete("tests/helpers/wit-callback-acceptance-history.mjs"), true);
	assert.equal(paths.delete("tests/helpers/wit-callback-installed-acceptance-history.mjs"), true);
	assert.equal(paths.has(perlVariantEvidencePath), false);
	return [...paths].sort();
};

/**
 * Describe exact handoff bytes; the recorder separately reads each real archive.
 *
 * @param item - Complete independently checked report.
 */
export const perlVariantHandoffIdentity = item => {
	const receipt = canonicalJson(item.packageSetReceipt), sidecar = sha256(receipt) + "  package-set-receipt.json\n";
	const identity = text => ({ bytes: Buffer.byteLength(text), sha256: sha256(text) });
	return { receipt: identity(receipt), sidecar: identity(sidecar)
		, archives: ["runtime", "component"].map(role => {
			const artifact = item.packageSetReceipt.packages.find(value => value.role === role).artifacts[0];
			return { role, path: artifact.path, bytes: artifact.bytes
				, sha256: artifact.sha256
				, files: Object.keys((role === "runtime" ? item.runtimeManifest : item.manifest).files).length + 1 };
		})
	};
};

/**
 * Require the complete original two-test semantic and archive verifier run.
 *
 * @param run - Actual unmodified TAP plus independently observed exit.
 */
export const assertPerlVariantVerification = async run => {
	keys(run, "command exitCode sha256 text"); assert.equal(run.command, perlVariantVerificationCommand);
	assert.equal(run.exitCode, 0); assert.equal(run.sha256, sha256(run.text));
	const source = await readFile(helper("evidence-tests"), "utf8");
	const titles = [...source.matchAll(/^test\("([^"\n]+)"/gmu)].map(match => match[1]);
	assert.equal(titles.length, 2);
	assertOwnedPerlCallbackVariantTap(run.text, titles.map((title, index) => ({ title
		, diagnostics: index === 1 ? ["# 438 coordinated optional-package forgeries rejected"] : [] })));
};

/**
 * Validate the chained receipt without depending on retained untracked paths.
 * This verifies recorded archive identities, not a fresh archive execution.
 *
 * @param record - Candidate immutable optional-install extension.
 */
export const assertPerlVariantAcceptance = async record => {
	keys(record, "schemaVersion kind acceptance baselineRevision previous scope sourceHistory excluded sources runs verification handoffs archive");
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-perl-callback-result-variants");
	assert.equal(record.acceptance, "passed"); assert.equal(record.baselineRevision, perlVariantBaseline);
	assert.deepEqual(record.previous, perlVariantPredecessor); assert.deepEqual(record.scope, perlVariantScope);
	assert.deepEqual(record.excluded, perlVariantExcluded);
	assert.deepEqual(record.sourceHistory, { path: perlVariantHistoryPath, sha256: perlVariantHistorySha256 });
	readPerlVariantHistory();
	assert.equal(sha256(await readFile(record.previous.path)), record.previous.sha256);
	assert.equal(sha256(await readFile(record.sourceHistory.path)), record.sourceHistory.sha256);
	keys(record.archive, "format nodes reports");
	assert.deepEqual(Object.keys(record.archive.reports), ownedPerlCallbackVariantReports);
	for(const value of Object.values(record.archive.reports)) keys(value, "bytes sha256 data");
	const reports = unpackOwnedCallbackReports(record.archive);
	assert.deepEqual(record.archive, packOwnedCallbackReports(reports));
	assert.deepEqual(Object.keys(record.handoffs), ownedPerlCallbackVariantReports);
	for(const name of ownedPerlCallbackVariantReports) assert.deepEqual(record.handoffs[name], perlVariantHandoffIdentity(reports[name]));
	assert.equal(record.runs.length, perlVariantRunSlots.length);
	for(const [index, run] of record.runs.entries())
	{
		keys(run, "name reports exitCode sha256 text");
		const { name, reports: names, ...raw } = run;
		assert.deepEqual({ name, reports: names }, perlVariantRunSlots[index]);
		assertOwnedPerlCallbackVariantLog(raw, names, reports);
	}
	await assertPerlVariantVerification(record.verification);
	assert.deepEqual(Object.keys(record.sources), await perlVariantSourcePaths());
	for(const [path, digest] of Object.entries(record.sources))
		assert.equal(sha256(beforePostPerlCallbackStaging(path, await readFile(path), digest)), digest, path);
	assertOwnedPerlCallbackResultCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"), JSON.parse(await readFile("package.json", "utf8")));
	const expected = new Map(reports[ownedPerlCallbackVariantReports[0]].cli.files.map(value => [value.path, value.sha256]));
	const readSource = async path => {
		assert.ok(Object.hasOwn(record.sources, path), path);
		const bytes = await readFile(path), digest = expected.get(path) ?? record.sources[path];
		return beforePostPerlCallbackStaging(path, bytes, digest);
	};
	assert.deepEqual(await assertOwnedPerlCallbackVariantMatrix(reports, readSource), perlVariantCounts);
};
