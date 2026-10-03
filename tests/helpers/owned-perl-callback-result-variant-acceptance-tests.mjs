/**
 * Authenticate the optional installed extension without changing its predecessor.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { packOwnedCallbackReports, unpackOwnedCallbackReports } from "./owned-callback-result-evidence.mjs";
import { assertPerlVariantAcceptance, perlVariantEvidencePath, perlVariantSourcePaths
	, perlVariantScope, perlVariantHandoffIdentity } from "./owned-perl-callback-result-variant-acceptance.mjs";
import { perlVariantPredecessor } from "./owned-perl-callback-result-variant-history.mjs";
import { assertOwnedPerlCallbackVariantTap } from "./owned-perl-callback-result-variant-evidence.mjs";

const receipt = async () => JSON.parse(await readFile(perlVariantEvidencePath, "utf8"));
const zero = "0".repeat(64);
const raw = (run, change) => { run.text = change(run.text); run.sha256 = sha256(run.text); };
const logMutations = [
	text => text.replace(/^ {2}.*\n/gmu, "")
	, text => text.replace("TAP version 13\n", "TAP version 13\nTAP version 13\n")
	, text => text.replace(/^ {2}duration_ms: .*\n/mu, "")
	, text => text.replace("  ---\n", "")
	, text => text.replace("  type: 'test'\n", "")
	, text => text.replace("  ...\n", "")
	, text => text.replace(/ {2}duration_ms: [^\n]+/u, "  duration_ms: ...")
	, ...["NaN", "Infinity", "-1", "0", "01.2", "1e3"].flatMap(value => [
		text => text.replace(/ {2}duration_ms: [^\n]+/u, "  duration_ms: " + value)
		, text => text.replace(/# duration_ms [^\n]+/u, "# duration_ms " + value)
	])
	, text => text.replace(/^# Subtest: [\s\S]*?^ {2}\.\.\.\n/mu, block => block + block)
	, text => text.replace(/^# tests [0-9]+\n/mu, line => line + line)
	, text => text.replace("ACTUAL_NODE_EXIT=0\n", "ACTUAL_NODE_EXIT=0\nACTUAL_NODE_EXIT=0\n")
	, text => text.replace(/^# pass [0-9]+\n/mu, "")
	, text => text.replace(/^# duration_ms .*\n/mu, "")
	, text => text.replace(/^(# Subtest: [\s\S]*?^ {2}\.\.\.\n)(# Subtest: [\s\S]*?^ {2}\.\.\.\n)/mu, "$2$1")
];

test("Perl optional TAP grammar rejects incomplete and reordered synthetic parser fixtures", t => {
	// A parser-only fixture, never recorded or described as execution evidence.
	const blocks = ["first", "second"].map(title => ({ title, diagnostics: [] }));
	const fixture = "TAP version 13\n" + blocks.map(({ title }, index) =>
		`# Subtest: ${title}\nok ${index + 1} - ${title}\n  ---\n  duration_ms: 1.5\n  type: 'test'\n  ...\n`).join("")
		+ "1..2\n# tests 2\n# suites 0\n# pass 2\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 4.5\nACTUAL_NODE_EXIT=0\n";
	assertOwnedPerlCallbackVariantTap(fixture, blocks);
	for(const mutate of logMutations)
	{
		const changed = mutate(fixture); assert.notEqual(changed, fixture, String(mutate));
		assert.throws(() => assertOwnedPerlCallbackVariantTap(changed, blocks));
	}
	t.diagnostic(`${logMutations.length} malformed parser-only TAP fixtures rejected.`);
});

test("Perl optional acceptance closes exact installed evidence and preserves the combined predecessor", async () => {
	const record = await receipt(); await assertPerlVariantAcceptance(record);
	const prior = await readFile(perlVariantPredecessor.path);
	assert.equal(sha256(prior), perlVariantPredecessor.sha256);
	assert.equal(JSON.parse(prior).scope.explicitNoHostInstalledPackage, false);
	assert.equal(JSON.parse(prior).scope.explicitHostOnlyInstalledPackage, false);
	assert.deepEqual(record.scope, perlVariantScope);
	const paths = new Set(await perlVariantSourcePaths());
	for(const path of [".github/workflows/consumer-matrix.yml", "package.json"
		, "scripts/record-owned-perl-callback-variants.mjs"
		, "scripts/update-owned-perl-callback-variant-history.mjs"
		, "tests/helpers/owned-perl-callback-result-variant-producer.mjs"
		, "tests/helpers/owned-perl-callback-result-variant-packaging-tests.mjs"
		, "tests/helpers/owned-perl-callback-result-variant-archives.mjs"
		, "tests/helpers/owned-perl-callback-result-variant-evidence.mjs"
		, "tests/helpers/owned-perl-callback-result-variant-evidence-tests.mjs"
		, "tests/helpers/owned-perl-callback-result-variant-history.mjs"
		, "tests/fixtures/structured-types/owned-perl-callback-results-variants-installed.pl"])
		assert.ok(paths.has(path), path);
});

test("Perl optional acceptance rejects forged logs, archives, exclusions and scope", async t => {
	const original = await receipt(), names = Object.keys(original.archive.reports);
	const mutations = [
		item => item.schemaVersion++, item => item.kind += "-forged"
		, item => item.acceptance = "pending"
		, item => item.baselineRevision = "0".repeat(40)
		, item => item.previous.sha256 = zero, item => item.previous.path += ".forged"
		, item => item.sourceHistory.sha256 = zero
		, item => item.sourceHistory.path += ".forged"
		, item => item.extraClaim = true, item => item.excluded.pop()
		, item => item.excluded.reverse(), item => item.excluded[0].sha256 = zero
		, item => item.excluded[0].reason = "accepted"
		, item => item.sources[Object.keys(item.sources)[0]] = zero
		, item => delete item.sources[Object.keys(item.sources)[0]]
		, item => item.sources["unrecorded.mjs"] = zero
		, item => item.runs.pop(), item => item.runs.reverse()
		, item => item.runs.push(item.runs[0])
		, item => item.verification.exitCode = 1
		, item => item.verification.command = "node --test unrelated.mjs"
		, item => item.verification.sha256 = zero
		, item => item.verification.extraClaim = true
		, item => raw(item.verification, text => text.replace("# skipped 0", "# skipped 1"))
		, item => raw(item.verification, text => text.replace("438 coordinated", "439 coordinated"))
		, item => raw(item.verification, text => text.replace("ACTUAL_NODE_EXIT=0", "ACTUAL_NODE_EXIT=1"))
		, item => raw(item.verification, text => text + "extra output\n")
		, item => item.archive.format += "-forged"
		, item => item.archive.extraClaim = true
		, item => delete item.archive.reports[names[0]]
		, item => item.archive.reports["ordinary-combined-package.json"] = item.archive.reports[names[0]]
		, item => item.archive.reports[names[0]].sha256 = zero
		, item => item.archive.reports[names[0]].bytes++
		, item => item.archive.reports[names[0]].extraClaim = true
		, item => item.archive.reports = Object.fromEntries(Object.entries(item.archive.reports).reverse())
		, item => item.archive.nodes[zero] = { extra: true }
		, item => delete item.handoffs[names[0]]
		, item => item.handoffs["unrecorded.json"] = item.handoffs[names[0]]
		, item => item.handoffs[names[0]].receipt.sha256 = zero
		, item => item.handoffs[names[0]].receipt.bytes++
		, item => item.handoffs[names[0]].sidecar.sha256 = zero
		, item => item.handoffs[names[0]].extraClaim = true
		, item => item.handoffs[names[0]].archives.reverse()
		, item => item.handoffs[names[0]].archives.pop()
		, item => item.handoffs[names[0]].archives[0].bytes++
		, item => item.handoffs[names[0]].archives[0].sha256 = zero
		, item => item.handoffs[names[0]].archives[0].path = "../unrecorded.tar.gz"
		, item => item.handoffs[names[0]].archives[0].files++
	];
	for(const [name, value] of Object.entries(perlVariantScope)) mutations.push(item => {
		item.scope[name] = typeof value === "boolean" ? !value : typeof value === "number" ? value + 1 : null;
	});
	for(const index of original.runs.keys()) mutations.push(
		item => item.runs[index].exitCode = 1
		, item => item.runs[index].reports.pop()
		, item => item.runs[index].name += "-forged"
		, item => item.runs[index].extraClaim = true
		, item => item.runs[index].sha256 = zero
		, item => raw(item.runs[index], text => text.replace("# skipped 0", "# skipped 1"))
		, item => raw(item.runs[index], text => text.replace("# Subtest: ", "# Subtest: forged "))
		, item => raw(item.runs[index], text => text.replace('"checks":39', '"checks":40').replace('"checks":64', '"checks":65'))
		, item => raw(item.runs[index], text => text.replace("ACTUAL_NODE_EXIT=0", "ACTUAL_NODE_EXIT=255"))
		, item => raw(item.runs[index], text => text + "ACTUAL_NODE_EXIT=0\n")
		, item => raw(item.runs[index], text => text.replace("independent second real producer", "first real producer"))
	);
	for(const mutate of logMutations.slice(0, -1)) mutations.push(item => raw(item.verification, mutate));
	mutations.push(item => raw(item.verification, logMutations.at(-1)));
	for(const index of original.runs.keys()) for(const mutate of logMutations.slice(0, -1))
		mutations.push(item => raw(item.runs[index], mutate));
	mutations.push(item => raw(item.runs[1], text => {
		const blocks = [...text.matchAll(/^# Subtest: [\s\S]*?(?=^# Subtest: |^1\.\.)/gmu)];
		return text.replace(blocks[0][0] + blocks[1][0], blocks[1][0] + blocks[0][0]);
	}));
	mutations.push(item => raw(item.runs[1], text => text.replace(/^(# ordinary\/host: .*\n)(# ordinary\/host: .*\n)/mu, "$2$1")));
	for(const mutate of mutations)
	{
		const candidate = structuredClone(original); mutate(candidate);
		assert.notEqual(JSON.stringify(candidate), JSON.stringify(original), String(mutate));
		await assert.rejects(() => assertPerlVariantAcceptance(candidate), String(mutate));
	}
	let coordinated = 0;
	for(const mutate of [
		item => item.mode = "reviewed"
		, item => item.variant = "host"
		, item => item.observations.pop()
		, item => item.producerExecutions[0].signal = "SIGSEGV"
		, item => {
			const run = item.observations[0].executions[0];
			run.observation.checks--; run.stdout = JSON.stringify(run.observation) + "\n";
		}
		, item => {
			const source = item.cli.files.find(value => value.path === "src/build/native-project.mjs");
			assert.ok(source);
			source.sha256 = zero;
		}
	]) {
		const candidate = structuredClone(original), reports = unpackOwnedCallbackReports(candidate.archive);
		mutate(reports[names[0]]); candidate.archive = packOwnedCallbackReports(reports);
		candidate.handoffs[names[0]] = perlVariantHandoffIdentity(reports[names[0]]);
		assert.notEqual(JSON.stringify(candidate), JSON.stringify(original), String(mutate));
		await assert.rejects(() => assertPerlVariantAcceptance(candidate), String(mutate)); coordinated++;
	}
	t.diagnostic(`${mutations.length} receipt/log/archive claims and ${coordinated} coordinated report forgeries rejected.`);
});
