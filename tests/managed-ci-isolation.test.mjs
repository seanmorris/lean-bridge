/**
 * Keep each managed host's acceptance and final gate in an independent job.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertManagedCiIsolation } from "./helpers/managed-ci-isolation.mjs";

const workflow = () => readFile(".github/workflows/consumer-matrix.yml", "utf8");

test("managed CI isolates timeout budgets, profile gates and artifact names", async () => {
	assert.deepEqual(assertManagedCiIsolation(await workflow()), {
		profiles: ["dotnet", "jvm", "ruby"], timeoutMinutesPerProfile: 240
		, failFast: false, selectedOutcomeCases: 27
		, artifactNamesIncludeProfile: true, commandsCompared: 0
	});
});

test("managed CI rejects dropped gates, shared artifacts and incomplete bootstrap", async () => {
	const source = await workflow();
	const match = /^ {2}managed-consumers:\n[\s\S]*?(?=^ {2}[a-z][a-z0-9-]*:\n)/mu.exec(source);
	assert.ok(match);
	const body = match[0];
	for(const [before, after] of [
		["profile: [dotnet, jvm, ruby]", "profile: [dotnet, jvm]"]
		, ["fail-fast: false", "fail-fast: true"]
		, ["if: matrix.profile == 'jvm'", "if: matrix.profile == 'dotnet'"]
		, ["if: always() && matrix.profile == 'ruby'", "if: always()"]
		, ["for consumer in ${{ matrix.profile }}; do", "for consumer in dotnet jvm ruby; do"]
		, ["name: consumer-results-managed-${{ matrix.profile }}-${{ github.sha }}", "name: consumer-results-managed-${{ github.sha }}"]
		, ["path: build/consumer-ci/results/${{ matrix.profile }}.json", "path: build/consumer-ci/results/*.json"]
		, ["      - name: Prepare the pinned native compiler\n", "      - name: Prepare the pinned native compiler\n        if: matrix.profile == 'dotnet'\n"]
		, ["steps.type_corpus_jvm.outcome != 'success'))", "steps.type_corpus_jvm.outcome == 'failure'))"]
	]) {
		const changed = body.replace(before, after);
		assert.notEqual(changed, body, before);
		assert.throws(() => assertManagedCiIsolation(source.replace(body, changed)), undefined, before);
	}
});
