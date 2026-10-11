/**
 * Exercise real Linux child exit states and strict receipt verification.
 * The GDB view here is simulated; these tests are not installed JVM acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { finContainerEdgeJvmGdbScript, finContainerEdgeJvmWaitGdbScript } from "./fin-container-edge-jvm-gdb.mjs";
import { assertFinContainerEdgeJvmExit, finContainerEdgeJvmWaitSupport, withFinContainerEdgeJvmWait } from "./fin-container-edge-jvm-wait.mjs";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertFinContainerEdgeReport } from "./fin-container-edge-report.mjs";
import { syntheticFinContainerEdgeReport } from "./fin-container-edge-report-fixtures.mjs";
import "./jvm-pending-exit-history-tests.mjs";

test("JVM exit recovery observes real kernel children without consuming their exit status", { skip: process.platform !== "linux" }, t => {
	const harness = String.raw`import ctypes
import os
import sys
import subprocess
import time
from types import SimpleNamespace
${finContainerEdgeJvmWaitSupport}
variables = {"_exitcode": None, "_exitsignal": None}
inferior = SimpleNamespace(pid=0, threads=lambda: [])
gdb = SimpleNamespace(convenience_variable=lambda key: variables[key], selected_inferior=lambda: inferior)
state = {"pid": 0, "failure": None}
jvm_exit_events = []
results = []

def start(code=0, traced=False):
    global jvm_exit_pidfd, jvm_exit_pid
    jvm_exit_pidfd = None
    jvm_exit_pid = None
    variables.update({"_exitcode": None, "_exitsignal": None})
    jvm_exit_events.clear()
    trace = "import ctypes, signal; assert ctypes.CDLL(None).ptrace(0, 0, None, None) == 0; os.kill(os.getpid(), signal.SIGSTOP); " if traced else ""
    child = subprocess.Popen([sys.executable, "-c", "import os; " + trace + "os.read(0, 1); os._exit(" + str(code) + ")"], stdin=subprocess.PIPE)
    state.update({"pid": child.pid, "failure": None})
    inferior.pid = child.pid
    inferior.threads = lambda: []
    jvm_watch_exit()
    assert not os.get_inheritable(jvm_exit_pidfd)
    if traced:
        pid, status = os.waitpid(child.pid, os.WUNTRACED)
        assert pid == child.pid and os.WIFSTOPPED(status)
        assert ctypes.CDLL(None).ptrace(7, child.pid, None, None) == 0
    return child

def release(child):
    child.stdin.write(b"x")
    child.stdin.flush()

def finish(child):
    global jvm_exit_pidfd
    if child.poll() is None:
        child.kill()
    child.wait(timeout=5)
    child.stdin.close()
    if jvm_exit_pidfd is not None:
        os.close(jvm_exit_pidfd)
        jvm_exit_pidfd = None

def refused(label):
    try:
        jvm_observe_exit()
    except (RuntimeError, OSError):
        results.append(label)
        return
    raise AssertionError(label + " was accepted")

for code, traced in [(0, False), (7, False), (255, False), (0, True), (7, True)]:
    child = start(code, traced)
    try:
        release(child)
        observed = jvm_observe_exit()
        assert observed["kind"] == "linux-pidfd-waitid" and observed["code"] == code
        assert observed["pid"] == child.pid and observed["wait"]["status"] == code
        assert observed["wait"]["reason"] == os.CLD_EXITED
        # WNOWAIT must leave the same authoritative status pending for GDB.
        for unused in range(2):
            pending = os.waitid(os.P_PIDFD, jvm_exit_pidfd, os.WEXITED | os.WNOHANG | os.WNOWAIT)
            assert pending.si_pid == child.pid and pending.si_status == code
        assert child.wait(timeout=5) == code
        results.append(("traced-kernel-exit-" if traced else "kernel-exit-") + str(code))
    finally:
        finish(child)

child = start()
try:
    before = time.monotonic()
    refused("live-child-timeout")
    assert time.monotonic() - before < 3
    assert child.poll() is None
finally:
    finish(child)

child = start()
try:
    child.send_signal(jvm_signals.SIGTERM)
    refused("signal-exit")
    assert child.wait(timeout=5) == -jvm_signals.SIGTERM
finally:
    finish(child)

for mutation, label in [
    (lambda: setattr(inferior, "pid", state["pid"] + 1), "wrong-inferior"),
    (lambda: setattr(inferior, "threads", lambda: [object()]), "live-debugger-thread"),
    (lambda: variables.update({"_exitcode": 0}), "contradictory-code"),
    (lambda: variables.update({"_exitsignal": 9}), "contradictory-signal"),
    (lambda: jvm_exit_events.append({"code": 0}), "contradictory-event"),
    (lambda: state.update({"failure": "injected sticky instrumentation failure"}), "sticky-failure"),
    (lambda: state.update({"pid": state["pid"] + 1}), "changed-identity"),
]:
    child = start()
    try:
        mutation()
        refused(label)
    finally:
        finish(child)

child = start()
other = subprocess.Popen([sys.executable, "-c", "import os; os._exit(0)"])
try:
    os.close(jvm_exit_pidfd)
    jvm_exit_pidfd = os.pidfd_open(other.pid, 0)
    refused("wrong-child-handle")
finally:
    finish(child)
    other.wait(timeout=5)

child = start()
try:
    release(child)
    assert child.wait(timeout=5) == 0
    refused("already-reaped-child")
    os.close(jvm_exit_pidfd)
    refused("closed-handle")
    jvm_exit_pidfd = None
    refused("missing-handle")
finally:
    finish(child)

for code in [0, 7]:
    child = start(code)
    try:
        release(child)
        assert child.wait(timeout=5) == code
        variables["_exitcode"] = code
        inferior.pid = 0
        observed = jvm_observe_exit()
        assert observed == {"schemaVersion": 1, "kind": "gdb-exit", "pid": child.pid, "code": code}
        results.append("gdb-exit-" + str(code))
    finally:
        finish(child)

print("real kernel exit controls: " + ", ".join(results))
assert len(results) == 20
`;
	const result = spawnSync("/usr/bin/python3", ["-c", harness], { encoding: "utf8", timeout: 15_000 });
	assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, "");
	assert.match(result.stdout, /^real kernel exit controls: kernel-exit-0, kernel-exit-7, kernel-exit-255,/u);
	assert.match(result.stdout, /already-reaped-child, closed-handle, missing-handle, gdb-exit-0, gdb-exit-7\n$/u);
	t.diagnostic(result.stdout.trim());
});

test("JVM exit receipts require exact successful process identity and CLD_EXITED", () => {
	const direct = { schemaVersion: 1, kind: "gdb-exit", pid: 42, code: 0 };
	const kernel = { schemaVersion: 1, kind: "linux-pidfd-waitid", pid: 42, code: 0
		, wait: { pid: 42, uid: 0, signal: 17, reason: 1, status: 0 } };
	for(const record of [direct, kernel])
	{
		assertFinContainerEdgeJvmExit(record, 42);
		for(const change of [value => { value.pid = 43; }
			, value => { value.code = 7; }
			, value => { delete value.code; }
			, value => { value.schemaVersion = 2; }
			, value => { value.extra = true; }
			, value => { value.kind = "unobserved"; }]) {
			const changed = structuredClone(record); change(changed);
			assert.throws(() => assertFinContainerEdgeJvmExit(changed, 42));
			}
	}
	for(const change of [value => { delete value.wait; }
		, value => { value.wait.pid = 43; }
		, value => { value.wait.status = 7; }
		, value => { value.wait.signal = 9; }
		, value => { value.wait.uid = -1; }
		, value => { value.wait.extra = true; }
		, ...[0, 2, 3, 4, 5, 6].map(reason => value => { value.wait.reason = reason; })]) {
		const changed = structuredClone(kernel); change(changed);
		assert.throws(() => assertFinContainerEdgeJvmExit(changed, 42));
		}
	for(const value of [null, undefined, {}, { ...direct, wait: kernel.wait }])
		assert.throws(() => assertFinContainerEdgeJvmExit(value, 42));
});

test("the pending-exit observer binds its child before continuing and retains refusal paths", () => {
	const original = finContainerEdgeJvmGdbScript({ nativeDirectory: "/verified", extractionRoot: "/fresh", libraries: { "component.so": "1".repeat(64) } });
	const source = withFinContainerEdgeJvmWait(original);
	assert.ok(source.indexOf("    jvm_watch_exit()") < source.indexOf('gdb.execute("continue")'));
	assert.equal(source.split('gdb.execute("continue")').length, 2);
	assert.ok(source.includes("os.WEXITED | os.WNOHANG | os.WNOWAIT"));
	assert.ok(source.includes('stop(71, state["failure"])'));
	assert.ok(source.includes('stop(72, "the inferior did not exit normally: " + str(error))'));
	assert.ok(source.includes('gdb.execute("quit " + str(jvm_exit["code"]))'));
	assert.throws(() => withFinContainerEdgeJvmWait(source));
	assert.throws(() => withFinContainerEdgeJvmWait(original + original));
});

test("JVM reports bind new exit receipts to the exact new script and preserve both older versions", async () => {
	const report = await syntheticFinContainerEdgeReport(["java", "kotlin"]);
	await assertFinContainerEdgeReport(report, ["java", "kotlin"]);
	for(const item of report.reports) for(const run of item.dispatch.publicHost.runs)
	{
		const host = item.dispatch.publicHost, original = run.scriptSha256;
		const current = sha256(finContainerEdgeJvmWaitGdbScript({ nativeDirectory: host.libraryDirectory
			, extractionRoot: run.extractionRoot, libraries: host.libraries }));
		run.scriptSha256 = current;
		await assert.rejects(assertFinContainerEdgeReport(report, ["java", "kotlin"]), /exit receipt/u);
		for(const kind of ["gdb-exit", "linux-pidfd-waitid"])
		{
			run.manifest.jvmExit = { schemaVersion: 1, kind, pid: run.pid, code: 0
				, ...kind === "linux-pidfd-waitid" ? { wait: { pid: run.pid, uid: 1000, signal: 17, reason: 1, status: 0 } } : {} };
			await assertFinContainerEdgeReport(report, ["java", "kotlin"]);
			run.manifest.jvmExit.code = 7;
			await assert.rejects(assertFinContainerEdgeReport(report, ["java", "kotlin"]), /actually exit successfully/u);
			run.manifest.jvmExit.code = 0;
			run.scriptSha256 = original;
			await assert.rejects(assertFinContainerEdgeReport(report, ["java", "kotlin"]), /historical observers cannot acquire/u);
			run.scriptSha256 = current;
		}
		delete run.manifest.jvmExit;
		run.scriptSha256 = original;
	}
	await assertFinContainerEdgeReport(report, ["java", "kotlin"]);
});
