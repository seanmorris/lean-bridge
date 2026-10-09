/**
 * Native acceptance shards retain their gates, commands and exact result rows.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertNativeCiIsolation, nativeCiJob, nativeCiProfiles, nativeCiRecordScript } from "./helpers/native-ci-isolation.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { runCopied } from "./helpers/copied-fixture-install.mjs";
import "./helpers/native-consumer-budget-tests.mjs";
import "./helpers/perl-closure-native-budget-tests.mjs";

const workflow = () => readFile(".github/workflows/consumer-matrix.yml", "utf8");
const baseline = async () => JSON.parse(await readFile("tests/fixtures/ci/native-acceptance-before-isolation.json"));

test("native CI isolates C/C++, Python and Rust without dropping acceptance", async () => {
	assert.deepEqual(assertNativeCiIsolation(await workflow(), await baseline()), {
		profiles: ["c-family", "python", "rust"], timeoutMinutesPerProfile: 240
		, failFast: false, commandsCompared: 6, selectedOutcomeCases: 27
		, selectedConsumers: ["c", "cpp", "python", "rust"]
	});
});

test("native CI rejects incomplete bootstrap, shared artifacts and permissive gates", async () => {
	const source = await workflow(), old = await baseline(), body = nativeCiJob(source);
	for(const [before, after] of [
		["profile: [c-family, python, rust]", "profile: [c-family, python]"]
		, ["fail-fast: false", "fail-fast: true"]
		, ["consumers: c cpp", "consumers: c"]
		, ["if: matrix.profile == 'rust'", "if: matrix.profile == 'python'"]
		, ["if: always() && matrix.profile == 'python'", "if: always()"]
		, ["for consumer in ${{ matrix.consumers }}; do", "for consumer in python rust c cpp; do"]
		, ["name: consumer-results-native-${{ matrix.profile }}-${{ github.sha }}", "name: consumer-results-native-${{ github.sha }}"]
		, ["path: build/consumer-ci/results/native-${{ matrix.profile }}/*.json", "path: build/consumer-ci/results/*.json"]
		, ["      - name: Prepare native compiler for this shard\n", "      - name: Prepare native compiler for this shard\n        if: matrix.profile == 'c-family'\n"]
		, ["steps.type_corpus_rust.outcome != 'success'))", "steps.type_corpus_rust.outcome == 'failure'))"]
		, ["          test -s build/owned-rust-packaging/reviewed.json\n", ""]
	]) {
		const changed = body.replace(before, after); assert.notEqual(changed, body, before);
		assert.throws(() => assertNativeCiIsolation(source.replace(body, changed), old), undefined, before);
	}
});

test("native recording scripts emit only selected rows and reject every incomplete selected step", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-native-ci-routing-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	await saveLakeFile(directory, "scripts/consumer-ci.mjs", "console.log(JSON.stringify(process.argv.slice(2)));\n");
	await symlink(process.execPath, join(directory, "node"));
	const source = await workflow();
	let runs = 0, rows = 0;
	for(const [profile, spec] of Object.entries(nativeCiProfiles))
	{
		const cases = [{}
			, ...["failure", "skipped", "cancelled"].flatMap(outcome =>
			["consumer", spec.ordinary, spec.corpus].map(id => ({ [id]: outcome })))];
		for(const outcomes of cases)
		{
			const script = nativeCiRecordScript(source, profile, outcomes);
			assert.doesNotMatch(script, /\$\{\{/u);
			const result = await runCopied("/bin/bash", ["-euo", "pipefail", "-c", script], directory, { PATH: directory });
			assert.equal(result.stderr, "");
			const parsed = result.stdout.trim().split("\n").map(line => {
				const args = JSON.parse(line); assert.equal(args.shift(), "record");
				return Object.fromEntries(Array.from({ length: args.length / 2 }, (_, index) => [args[index * 2], args[index * 2 + 1]]));
			});
			assert.deepEqual(parsed.map(row => row["--consumer"]), spec.consumers);
			for(const row of parsed)
			{
				const success = Object.keys(outcomes).length === 0, consumer = row["--consumer"];
				assert.equal(row["--test-result"], success ? "passed" : "failed");
				assert.equal(row["--package-installation"], String(success));
				assert.equal(row["--real-lean-execution"], String(success));
				assert.equal(row["--output"], `build/consumer-ci/results/native-${profile}/${consumer}.json`);
				assert.equal(row["--performance"], `build/consumer-ci/performance/${consumer}.json`);
				assert.ok(row["--command"].startsWith("npm run test:consumer:native && "));
				if(profile === "python") assert.ok(row["--command"].includes("LEAN_BRIDGE_PYTHON='/fixture/python312/bin/python3.12'"));
				else assert.ok(!row["--command"].includes("/fixture/python312/bin/python3.12"));
			}
			++runs; rows += parsed.length;
		}
	}
	assert.equal(runs, 30); assert.equal(rows, 40);
	t.diagnostic(`${runs} actual Bash recording runs checked ${rows} result rows.`);
});
