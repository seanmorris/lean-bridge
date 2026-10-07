/**
 * Keep each managed host's acceptance and final gate in an independent job.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { assertManagedCiIsolation } from "./helpers/managed-ci-isolation.mjs";

const workflow = () => readFile(".github/workflows/consumer-matrix.yml", "utf8");

test("managed JVM bootstrap downloads Kotlin into a fresh checkout", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-jvm-bootstrap-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const archive = join(directory, "fixture.zip"), content = "local compiler archive fixture\n";
	await writeFile(archive, content);
	const source = await workflow();
	const step = source.split("      - name: Compile ordinary Lean APIs and install Maven packages in Java and Kotlin\n")[1]?.split("      - name: ")[0];
	assert.ok(step);
	const dependencies = source.split("      - name: Install dependencies for ordinary_jvm\n")[1]?.split("      - name: ")[0];
	assert.ok(dependencies);
	assert.ok(dependencies.includes("sudo apt-get install -y maven unzip\n"));
	assert.ok(dependencies.includes("if: matrix.profile == 'jvm'\n"));
	const commands = step.split("        run: |\n")[1]?.split("          echo '")[0];
	assert.ok(commands);
	const download = "https://github.com/JetBrains/kotlin/releases/download/v2.2.0/kotlin-compiler-2.2.0.zip";
	assert.ok(commands.includes(download));
	await processBuildRunner.capture({ command: "bash"
		, args: ["-e", "-c", commands.replace(download, pathToFileURL(archive).href)]
		, cwd: directory, timeoutMs: 30000 });
	assert.equal(await readFile(join(directory, "build/kotlin-compiler.zip"), "utf8"), content);
});

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
		, ["      - name: Install apt dependencies for Prepare the pinned native compiler\n", "      - name: Install apt dependencies for Prepare the pinned native compiler\n        if: matrix.profile == 'dotnet'\n"]
		, ["          sudo apt-get update && sudo apt-get install -y build-essential zstd m4\n", ""]
		, ["steps.type_corpus_jvm.outcome != 'success'))", "steps.type_corpus_jvm.outcome == 'failure'))"]
	]) {
		const changed = body.replace(before, after);
		assert.notEqual(changed, body, before);
		assert.throws(() => assertManagedCiIsolation(source.replace(body, changed)), undefined, before);
	}
});
