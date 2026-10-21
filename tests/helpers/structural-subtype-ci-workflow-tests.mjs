/**
 * Require both structural author routes on every host without losing earlier gates.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertStructuralSubtypeWorkflow, disableStructuralSubtypeWorkflow, enableStructuralSubtypeWorkflow, structuralSubtypeWorkflowCommand, structuralSubtypeWorkflowGroups, structuralSubtypeWorkflowUpload, structuralSubtypeNodeBlock, structuralSubtypePerlBlock } from "./structural-subtype-ci-workflow.mjs";
import { structuralSubtypeCiWorkflowHistoryPath, structuralSubtypeCiWorkflowPredecessor } from "./structural-subtype-ci-workflow-history.mjs";
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";
import { assertWorkflowRunBudget, workflowExpressionLength, workflowRunScalars } from "./native-observation-split.mjs";

const runner = "bash scripts/run-structural-subtype-ci.sh";
const checkMutation = (source, changed, name, label) => {
	assert.notEqual(changed, source, `mutation must change ${label}`);
	assert.throws(() => assertStructuralSubtypeWorkflow(changed, name), label);
};

test("structural workflow adds twelve enforced lanes and preserves every previous gate and budget", async t => {
	for(const name of ["consumer-matrix.yml", "perl-consumer.yml"])
	{
		const path = `.github/workflows/${name}`, live = await readFile(path, "utf8");
		const current = sourceAtHistoryMilestone(
			structuralSubtypeCiWorkflowHistoryPath, path
		);
		const previous = execFileSync("git", ["show", `${structuralSubtypeCiWorkflowPredecessor}:${path}`], { encoding: "utf8" });
		assertStructuralSubtypeWorkflow(live, name);
		assert.equal(disableStructuralSubtypeWorkflow(current, name), previous);
		assert.equal(enableStructuralSubtypeWorkflow(previous, name), current);
		assert.throws(() => enableStructuralSubtypeWorkflow(current, name));
		assert.throws(() => disableStructuralSubtypeWorkflow(previous, name));
		assert.ok(assertWorkflowRunBudget(current) > 20);
		const maximum = Math.max(...workflowRunScalars(current).map(run => Math.max(run.source.length, workflowExpressionLength(run.source))));
		t.diagnostic(`${name}: maximum expanded run expression ${maximum}/20000 characters`);
		const jobs = source => [...source.matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)].map(match => match[1]);
		assert.deepEqual(jobs(current), jobs(previous));
		assert.deepEqual([...current.matchAll(/^ {4}timeout-minutes: \d+$/gmu)].map(match => match[0]), [...previous.matchAll(/^ {4}timeout-minutes: \d+$/gmu)].map(match => match[0]));
	}
	assert.deepEqual([...structuralSubtypeWorkflowGroups.flatMap(group => group.lanes), "node-browser", "perl"].sort(), ["c-cpp", "python311", "python312", "rust", "ruby", "dotnet", "jvm", "php-native", "wit-wasi", "node-browser", "php-wasm", "perl"].sort());
	for(const lane of ["", "python399", "php", "npm", "all"]) assert.throws(() => structuralSubtypeWorkflowCommand(lane));
	const root = await readFile("tests/structural-subtype-installed.test.mjs", "utf8");
	for(const file of ["workflow-tests", "workflow-history-tests"])
		assert.ok(root.includes(`import "./helpers/structural-subtype-ci-${file}.mjs";`));
});

test("structural workflow rejects missing lanes, wrong hosts, skipped enforcement and partial records", async t => {
	const name = "consumer-matrix.yml", source = await readFile(`.github/workflows/${name}`, "utf8");
	let controls = 0;
	for(const group of structuralSubtypeWorkflowGroups) for(const lane of group.lanes)
	{
		const command = structuralSubtypeWorkflowCommand(lane), line = `          ${command}\n`, upload = structuralSubtypeWorkflowUpload(lane);
		const partitionedPhpWasm = lane === "php-wasm"
			&& source.split("\n  php-wasm-corpus:\n")[1]
				?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0].includes(line);
		const expectedJob = partitionedPhpWasm ? "php-wasm-corpus" : group.job;
		const expectedStep = partitionedPhpWasm
			? "refinements_php_wasm" : group.step;
		const expectedEnforce = partitionedPhpWasm
			? "Enforce PHP-Wasm corpus" : group.enforce;
		const mutations = [source.replace(line, "")
			, source.replace(line, line + line)
			, source.replace(line, "      - name: wrong step\n        run: |\n" + line)
			, source.replace(line, "          set +e\n" + line)
			, source.replace(line, line.trimEnd() + " || true\n")
			, source.replace(line, line.replace("bash ", "true "))
			, source.replace(upload, "")
			, source.replace(upload, upload.replace("/\n", "/ordinary/records/report.json\n"))
			, source.replace(`  ${expectedJob}:\n`, "  wrong-job:\n")
			, source.replace(`        id: ${expectedStep}\n`, "        id: missing\n")
			, source.replace(`        id: ${expectedStep}\n`, `        id: ${expectedStep}\n        if: false\n`)
			, source.replaceAll(`steps.${expectedStep}.outcome != 'success'`, "false")
			, source.replace(" && " + command, "")
			, source.replace(`      - name: ${expectedEnforce}\n`, "      - name: missing enforcement\n")
			, source.replace(`      - name: ${expectedEnforce}\n`, `      - name: ${expectedEnforce}\n        continue-on-error: true\n`)
			, source.replace(line, "          export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.36\n" + line)];
		for(const changed of mutations)
{ checkMutation(source, changed, name, lane); controls++; }
	}
	for(const changed of [source.replaceAll("if: always()", "if: success()")
		, source.replaceAll("if-no-files-found: error", "if-no-files-found: ignore")
		, source.replaceAll("run: exit 1", "run: exit 0")
		, source.replace("LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME=build/php-wasm-subtype-entry-input/php-wasm-runtime " + runner, runner)
		, source.replace("node scripts/prepare-php-wasm-subtype-entry-runtime.mjs", "true missing-runtime")]){ checkMutation(source, changed, name, "enforcement and prepared runtime"); controls++; }
	for(const lane of ["python311", "python312"])
	{
		const command = structuralSubtypeWorkflowCommand(lane);
		for(const changed of [source.replace(command, command.replace(/collection_python\d+/u, "collection_python399"))
			, source.replace(command, command.replace(/LEAN_BRIDGE_PYTHON='[^']+' /u, ""))]){ checkMutation(source, changed, name, lane); controls++; }
	}
	const phpWasm = `          ${structuralSubtypeWorkflowCommand("php-wasm")}\n`;
	const observationAnchor = "          wasm_result=failed\n";
	const receiptOnly = source.replace(phpWasm, "")
		.replace(observationAnchor, observationAnchor + phpWasm);
	checkMutation(source, receiptOnly, name
		, "PHP-Wasm command moved from its producer into observation receipt work");
	controls++;
	t.diagnostic(`${controls} changed native/PHP-Wasm workflow controls rejected`);
});

test("structural Node workflow requires all browsers, locked inputs and both published outcomes", async t => {
	const name = "consumer-matrix.yml", source = await readFile(`.github/workflows/${name}`, "utf8");
	const block = structuralSubtypeNodeBlock;
	const mutations = [source.replace(block, "")
		, source.replace(block, block + block)
		, source.replace(block, block.replace("        id:", "        continue-on-error: true\n        id:"))
		, source.replace(block, block.replace("        id:", "        if: false\n        id:"))
		, source.replace(block, block.replace("build/locked-lake-engine/bin/lean-bridge-component-engine", "/ambient/engine"))
		, source.replace(block, block.replace("build/consumer-ci-runtime/lazy", "build/wrong-runtime"))
		, source.replace(block, block.replace("always()", "success()"))
		, source.replace(block, block.replace("if-no-files-found: error", "if-no-files-found: ignore"))
		, source.replace(block, block.replace("path: build/structural-subtype-ci/node-browser/", "path: build/structural-subtype-ci/node-browser/ordinary/records/report.json"))
		, source.replace("  node-consumers:\n", "  wrong-node-job:\n")
		, source.replace("nix build .#component-build-engine --out-link build/locked-lake-engine", "true missing-engine")
		, source.replaceAll("steps.structural_subtype_npm.outcome", "steps.unmeasured.outcome")
		, source.replace(" && " + runner + " node-browser", "")];
	for(const changed of mutations) checkMutation(source, changed, name, "node-browser");
	const shell = await readFile("scripts/run-structural-subtype-ci.sh", "utf8");
	assert.ok(shell.includes("LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit"));
	assert.ok(shell.includes("for route in ordinary reviewed; do"));
	const statements = source.split("\n").filter(line => /--consumer node-(?:javascript|typescript) /u.test(line));
	assert.equal(statements.length, 2);
	const assignments = source.split("      - name: Record Node observations\n")[1].split("      - name: ")[0]
		.split("\n").filter(line => /^ {10}(?:test_result|executed)=/u.test(line)).join("\n");
	assert.equal(assignments.split("\n").length, 2);
	let executions = 0;
	for(const outcome of ["success", "failure", "skipped", "cancelled"]) for(const line of statements)
	{
		const script = (assignments + "\n" + line).replaceAll(/\$\{\{(.*?)\}\}/gu, (_, expression) => {
			if(expression === " github.sha ") return "a".repeat(40);
			const resolved = expression.replaceAll(/steps\.([a-z_]+)\.outcome/gu, (_, id) => JSON.stringify(id === "structural_subtype_npm" ? outcome : "success"));
			assert.match(resolved, /^[\s'"a-z=&|!]+$/u);
			return String(Function(`"use strict"; return (${resolved});`)());
		});
		const result = spawnSync("bash", ["--noprofile", "--norc", "-euo", "pipefail", "-c", 'node() { printf "%s\\0" "$@"; };\n' + script], { encoding: "utf8", env: { PATH: "/usr/bin:/bin" } });
		assert.equal(result.status, 0, result.stderr);
		const args = result.stdout.split("\0");
		const field = flag => args[args.indexOf(flag) + 1];
		assert.equal(field("--test-result"), outcome === "success" ? "passed" : "failed");
		for(const flag of ["--package-installation", "--real-lean-execution"]) assert.equal(field(flag), String(outcome === "success"));
		assert.ok(field("--command").includes(runner + " node-browser")); executions++;
	}
	t.diagnostic(`${mutations.length} Node mutations rejected; ${executions} real Bash observation executions`);
});

test("structural Perl workflow requires all four ABIs, complete records and the combined gate", async t => {
	const name = "perl-consumer.yml", source = await readFile(`.github/workflows/${name}`, "utf8"), block = structuralSubtypePerlBlock;
	const mutations = [source.replace(block, "")
		, source.replace(block, block + block)
		, source.replace(block, block.replace("        env:", "        if: false\n        env:"))
		, source.replace(block, block.replace("        env:", "        continue-on-error: true\n        env:"))
		, source.replace(block, block.replace(runner, "true missing-runner"))
		, source.replace(block, block.replace("source scripts/env.sh", "true missing-compiler"))
		, source.replace(block, block.replace("always()", "success()"))
		, source.replace(block, block.replace("if-no-files-found: error", "if-no-files-found: ignore"))
		, source.replace(block, block.replace("path: build/structural-subtype-ci/perl/", "path: build/structural-subtype-ci/perl/ordinary/records/report.json"))
		, source.replace("  checked-records:\n", "  wrong-job:\n")
		, source.replace("      - checked-records\n", "")
		, source.replaceAll("needs.checked-records.result == 'success'", "true")
		, source.replace(block, "    continue-on-error: true\n" + block)
		, source.replace(block, block.replace(runner, "export LEAN_BRIDGE_STRUCTURAL_SUBTYPE_PERLS=other; " + runner))
		, ...["5.36.3 threaded", "5.36.3 unthreaded", "5.38.2 threaded", "5.38.2 unthreaded"].map(abi => source.replace(`          node scripts/build-perl-toolchains.mjs ${abi}\n`, ""))];
	for(const changed of mutations) checkMutation(source, changed, name, "perl");
	t.diagnostic(`${mutations.length} Perl workflow mutations rejected`);
});
