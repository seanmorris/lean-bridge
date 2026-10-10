/**
 * Keep the installed zero-bound supplement mandatory in every native consumer selection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { finRecordZeroTargets } from "./fin-record-zero-fixture.mjs";
import { assertFinRecordZeroWorkflow, disableFinRecordZeroWorkflow, enableFinRecordZeroWorkflow, finRecordZeroCiBlock, finRecordZeroCiCheck, finRecordZeroCiInvocation, finRecordZeroCiSelections } from "./fin-record-zero-ci.mjs";
import { beforeFinZeroCiSource } from "./fin-record-zero-ci-history.mjs";

test("Fin 0 CI covers all native consumers, both Python selections and the four Perl configurations", async () => {
	assert.deepEqual([...new Set(finRecordZeroCiSelections.flatMap(item => item.profiles.split(",")))].sort(), Object.keys(finRecordZeroTargets).sort());
	assert.deepEqual(finRecordZeroCiSelections.filter(item => item.python).map(item => item.python), ["3.11", "3.12"]);
	for(const name of ["consumer-matrix.yml", "perl-consumer.yml"])
	{
		const path = ".github/workflows/" + name, workflow = await readFile(path, "utf8");
		assertFinRecordZeroWorkflow(workflow, name);
		const previous = beforeFinZeroCiSource(path, workflow);
		assert.notEqual(previous, workflow);
		assert.equal(disableFinRecordZeroWorkflow(workflow, name), previous);
		assert.equal(enableFinRecordZeroWorkflow(previous, name), workflow);
		if(name === "perl-consumer.yml")
			for(const version of ["5.36.3", "5.38.2"]) for(const abi of ["threaded", "unthreaded"]) assert.ok(workflow.includes(version + "-" + abi));
	}
});

test("Fin 0 CI refuses skipped producers, missing route reports, wrong selections and unenforced steps", async () => {
	for(const name of ["consumer-matrix.yml", "perl-consumer.yml"])
	{
		const workflow = await readFile(".github/workflows/" + name, "utf8");
		for(const item of finRecordZeroCiSelections.filter(item => item.workflow === name))
		{
			const call = finRecordZeroCiInvocation(item), check = finRecordZeroCiCheck(item);
			for(const changed of [
				workflow.replace(finRecordZeroCiBlock(item), "")
				, workflow.replace(`          ${call}\n`, `          ${call} || true\n`)
				, workflow.replace(`          ${check}\n`, "")
				, workflow.replace(`            build/native-fin-record-zero/reviewed-${item.label}.json\n`, "")
				, workflow.replace(call, call.replace(`LEAN_BRIDGE_FIN_RECORD_ZERO_PROFILES=${item.profiles}`, "LEAN_BRIDGE_FIN_RECORD_ZERO_PROFILES="))
			]) assert.throws(() => assertFinRecordZeroWorkflow(changed, name), item.label);
		}
	}
});
