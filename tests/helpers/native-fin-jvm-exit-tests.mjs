/**
 * Check scalar JVM exit observation with real child processes and a controlled GDB view.
 * These cases reproduce the old refusal condition, not the hosted debugger race.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { nativeFinGdbExtractedScript, nativeFinGdbExtractedWaitScript } from "./native-fin-dispatch-gdb-extracted.mjs";
import { withFinContainerJvmEntryWait } from "./fin-container-jvm-entry-wait.mjs";
import { finContainerEdgeJvmWaitSupport } from "./fin-container-edge-jvm-wait.mjs";

test("scalar JVM exit observation preserves all six original counters and deployment checks", () => {
	assert.equal(sha256(nativeFinGdbExtractedScript), "2c6ed95844b5c73c77985974e3e43038aa00d048108c34301726cf24c0963ac3");
	const current = nativeFinGdbExtractedWaitScript;
	assert.equal(current, withFinContainerJvmEntryWait(nativeFinGdbExtractedScript));
	assert.equal(current.split('gdb.execute("continue")').length, 2);
	assert.ok(current.indexOf("    jvm_watch_exit()") < current.indexOf('gdb.execute("continue")'));
	assert.ok(current.includes('stop(71, state["failure"])'));
	const section = source => source.slice(source.indexOf("def write():\n"), source.indexOf("if not fresh(parent):\n"));
	assert.equal(section(current), section(nativeFinGdbExtractedScript));
	assert.throws(() => withFinContainerJvmEntryWait(current));
	assert.throws(() => withFinContainerJvmEntryWait(nativeFinGdbExtractedScript.repeat(2)));
});

test("scalar JVM observer requires this child's actual exit and refuses missing or unsuccessful exits", { skip: process.platform !== "linux" }, t => {
	const original = nativeFinGdbExtractedScript.slice(nativeFinGdbExtractedScript.lastIndexOf("signal, code = "));
	const current = nativeFinGdbExtractedWaitScript.slice(nativeFinGdbExtractedWaitScript.lastIndexOf("try:\n    jvm_exit = jvm_observe_exit()"));
	const harness = String.raw`import json
import os
import subprocess
import sys
import tempfile
from types import SimpleNamespace
${finContainerEdgeJvmWaitSupport}
results = []

def stop(code, message):
    raise SystemExit(code)

def execute(command):
    assert command.startswith("quit ")
    raise SystemExit(int(command[5:]))

def jvm_log_exit_state():
    pass

for mode, expected in [("original", 72), ("pending", 0), ("nonzero", 7),
                       ("signal", 72), ("reaped", 72), ("normal-gdb", 0),
                       ("missing-manifest", 71), ("foreign-manifest", 71)]:
    with tempfile.TemporaryDirectory(prefix="lean-bridge-scalar-jvm-exit-") as directory:
        jvm_exit_pidfd, jvm_exit_pid = None, None
        jvm_exit_events = []
        status = 7 if mode == "nonzero" else 0
        child = subprocess.Popen([sys.executable, "-c", "import os; os.read(0, 1); os._exit(" + str(status) + ")"], stdin=subprocess.PIPE)
        try:
            state = {"pid": child.pid, "failure": None}
            variables = {"_exitcode": None, "_exitsignal": None}
            inferior = SimpleNamespace(pid=child.pid, threads=lambda: [])
            gdb = SimpleNamespace(convenience_variable=lambda key: variables[key],
                                  selected_inferior=lambda: inferior, execute=execute,
                                  write=lambda text: None)
            config = {"armed": directory + "/armed.json", "nonce": "original-run"}
            if mode != "missing-manifest":
                with open(config["armed"], "x") as out:
                    json.dump({"pid": child.pid, "nonce": "foreign" if mode == "foreign-manifest" else config["nonce"]}, out)
            jvm_watch_exit()
            if mode == "signal":
                child.send_signal(jvm_signals.SIGTERM)
            else:
                child.stdin.write(b"x")
                child.stdin.flush()
            pending = select.poll()
            pending.register(jvm_exit_pidfd, select.POLLIN)
            assert pending.poll(1000)
            if mode in ("reaped", "normal-gdb"):
                assert child.wait(timeout=5) == 0
            if mode == "normal-gdb":
                variables["_exitcode"] = 0
                inferior.pid = 0
            outcome = None
            try:
                exec(${JSON.stringify(original)} if mode == "original" else ${JSON.stringify(current)})
            except SystemExit as error:
                outcome = error.code
            assert outcome == expected, (mode, outcome, expected)
            manifest = None
            if os.path.exists(config["armed"]):
                with open(config["armed"]) as source:
                    manifest = json.load(source)
            if outcome == 0:
                receipt = manifest["jvmExit"]
                assert receipt["pid"] == child.pid and receipt["code"] == 0
                assert receipt["kind"] == ("gdb-exit" if mode == "normal-gdb" else "linux-pidfd-waitid")
            else:
                assert manifest is None or "jvmExit" not in manifest
            results.append([mode, outcome])
        finally:
            child.wait(timeout=5)
            child.stdin.close()
            if jvm_exit_pidfd is not None:
                try:
                    os.close(jvm_exit_pidfd)
                except OSError:
                    pass
print(json.dumps(results))
`;
	const result = spawnSync("/usr/bin/python3", ["-c", harness], { encoding: "utf8", timeout: 15_000 });
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.signal, null); assert.equal(result.stderr, "");
	assert.deepEqual(JSON.parse(result.stdout), [
		["original", 72], ["pending", 0], ["nonzero", 7], ["signal", 72]
		, ["reaped", 72], ["normal-gdb", 0]
		, ["missing-manifest", 71], ["foreign-manifest", 71]
	]);
	t.diagnostic("Real child exits; simulated lost-thread GDB state: " + result.stdout.trim());
});
