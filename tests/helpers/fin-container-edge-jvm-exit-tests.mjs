/**
 * Exercise diagnostic Python without treating mocks as installed JVM acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { finContainerEdgeJvmExitDiagnostics, withoutFinContainerEdgeJvmExitDiagnostics } from "./fin-container-edge-jvm-exit.mjs";
import { finContainerEdgeJvmGdbScript } from "./fin-container-edge-jvm-gdb.mjs";
import { assertFinContainerEdgeReport } from "./fin-container-edge-report.mjs";
import { syntheticFinContainerEdgeReport } from "./fin-container-edge-report-fixtures.mjs";
import "./fin-jvm-diagnostics-history-tests.mjs";

test("JVM diagnostics preserve the strict exit guard and add no retry or status substitution", () => {
	const script = finContainerEdgeJvmGdbScript({ nativeDirectory: "/verified", extractionRoot: "/fresh", libraries: { "component.so": "1".repeat(64) } });
	assert.equal(script.split(finContainerEdgeJvmExitDiagnostics).length, 2);
	assert.ok(script.includes('if signal is not None or code is None or gdb.selected_inferior().pid != 0:\n    jvm_log_exit_state()\n    stop(72, "the inferior did not exit normally")'));
	assert.equal(script.split('gdb.execute("continue")').length, 2);
	assert.ok(script.includes('gdb.execute("quit " + str(int(code)))'));
	assert.ok(script.includes('stop(71, state["failure"])'));
});

test("removing only diagnostic statements reproduces the original archived observer byte for byte", async () => {
	const root = "docs/evidence/fin-jvm-exit-diagnostics-20261010";
	const config = JSON.parse(await readFile(`${root}/gdb15-r1/run-0.json`));
	const baseline = JSON.parse(await readFile(`${root}/preparation/baseline-dispatch.json`)).publicHostDispatch;
	const source = finContainerEdgeJvmGdbScript({ nativeDirectory: config.root
		, extractionRoot: config.argv[2].slice("-Djava.io.tmpdir=".length)
		, libraries: baseline.libraries });
	const original = withoutFinContainerEdgeJvmExitDiagnostics(source);
	assert.equal(original, await readFile(`${root}/gdb15-r1/run-0.py`, "utf8"));
	assert.equal(sha256(original), "ba4991e24d1a7d06e8c5fd762bb6e031dae521a31c3acbcdc1ea1a3e814ccefc");
	assert.throws(() => withoutFinContainerEdgeJvmExitDiagnostics(original));
});

test("report checks accept both exact logging revisions and refuse every unrecorded script", async () => {
	const report = await syntheticFinContainerEdgeReport(["java", "kotlin"]);
	await assertFinContainerEdgeReport(report, ["java", "kotlin"]);
	for(const item of report.reports)
	{
		const host = item.dispatch.publicHost;
		for(const run of host.runs)
		{
			const script = finContainerEdgeJvmGdbScript({ nativeDirectory: host.libraryDirectory
				, extractionRoot: run.extractionRoot, libraries: host.libraries });
			const original = run.scriptSha256;
			run.scriptSha256 = sha256(withoutFinContainerEdgeJvmExitDiagnostics(script));
			await assertFinContainerEdgeReport(report, ["java", "kotlin"]);
			for(const bytes of [script + "\n", script.replace('stop(72, "the inferior did not exit normally")', "pass"), withoutFinContainerEdgeJvmExitDiagnostics(script) + "\n"])
			{
				run.scriptSha256 = sha256(bytes);
				await assert.rejects(assertFinContainerEdgeReport(report, ["java", "kotlin"]), /one exact JVM observer version/u);
			}
			run.scriptSha256 = original;
		}
	}
});

test("JVM diagnostics retain bounded exit events, thread and process state without deciding acceptance", () => {
	const harness = String.raw`import json
import os
from types import SimpleNamespace
messages = []
callbacks = []
variables = {"_exitcode": None, "_exitsignal": None}
thread = SimpleNamespace(num=3, ptid=(123, 124, 0), is_stopped=lambda: True,
                         is_running=lambda: False, is_exited=lambda: False)
inferior = SimpleNamespace(pid=os.getpid(), threads=lambda: [thread] * 80)
gdb = SimpleNamespace(VERSION="test-only", STDERR=2, convenience_variable=lambda name: variables[name],
                      selected_inferior=lambda: inferior, write=lambda message, stream: messages.append(message),
                      events=SimpleNamespace(exited=SimpleNamespace(connect=callbacks.append)))
state = {"pid": os.getpid()}
${finContainerEdgeJvmExitDiagnostics}
assert len(callbacks) == 1
for code in range(12):
    callbacks[0](SimpleNamespace(exit_code=code, inferior=SimpleNamespace(pid=code + 1)))
jvm_log_exit_state()
report = json.loads(messages.pop().split(": ", 1)[1])
assert report["exitCode"] is None and report["exitSignal"] is None
assert report["observedPid"] == os.getpid() and report["pid"] == os.getpid()
assert report["threadCount"] == 80 and len(report["threads"]) == 64
assert [event["code"] for event in report["exitEvents"]] == list(range(4, 12))
assert report["threads"][0] == {"num": 3, "ptid": [123, 124, 0], "stopped": True, "running": False, "exited": False}
assert sorted(report["processStatus"]) == ["State", "Threads", "TracerPid"]
assert report["kernel"] and report["gdb"] == "test-only"
variables["_exitsignal"] = 11
jvm_log_exit_state()
assert json.loads(messages.pop().split(": ", 1)[1])["exitSignal"] == "11"
variables.update({"_exitcode": 7, "_exitsignal": None})
inferior.pid = 0
jvm_log_exit_state()
assert messages == []  # Actual nonzero exit still propagates through the unchanged caller.
variables["_exitcode"] = 0
jvm_log_exit_state()
assert messages == []
variables["_exitcode"] = None
state["pid"] = 0
jvm_log_exit_state()
assert "processStatusError" in json.loads(messages.pop().split(": ", 1)[1])
gdb.selected_inferior = lambda: (_ for _ in ()).throw(RuntimeError("unavailable inferior"))
jvm_log_exit_state()
assert messages.pop() == "fin JVM exit diagnostics unavailable: unavailable inferior\n"
print("diagnostics checked; no installed acceptance claimed")
`;
	const result = spawnSync("/usr/bin/python3", ["-c", harness], { encoding: "utf8", timeout: 10_000 });
	assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
	assert.equal(result.stdout, "diagnostics checked; no installed acceptance claimed\n");
});
