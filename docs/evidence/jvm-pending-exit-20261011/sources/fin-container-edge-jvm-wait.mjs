/**
 * Observe a pending Linux process exit when GDB has lost its last thread.
 * A pidfd opened before execution binds waitid to that exact child, never a reused PID.
 *
 * @file
 */
import assert from "node:assert/strict";

export const finContainerEdgeJvmWaitSupport = String.raw`import select
import signal as jvm_signals
jvm_exit_pidfd = None
jvm_exit_pid = None


def jvm_watch_exit():
    global jvm_exit_pidfd, jvm_exit_pid
    if jvm_exit_pidfd is not None or state["pid"] <= 0:
        raise RuntimeError("invalid JVM exit watch")
    jvm_exit_pid = state["pid"]
    jvm_exit_pidfd = os.pidfd_open(jvm_exit_pid, 0)


def jvm_observe_exit():
    if jvm_exit_pidfd is None or jvm_exit_pid != state["pid"] or state["failure"] is not None:
        raise RuntimeError("missing or conflicting JVM exit identity")
    code = gdb.convenience_variable("_exitcode")
    signal = gdb.convenience_variable("_exitsignal")
    inferior = gdb.selected_inferior()
    if signal is None and code is not None and inferior.pid == 0:
        code = int(code)
        if not 0 <= code <= 255:
            raise RuntimeError("invalid GDB exit code")
        return {"schemaVersion": 1, "kind": "gdb-exit", "pid": jvm_exit_pid, "code": code}
    if (code is not None or signal is not None or inferior.pid != jvm_exit_pid
            or inferior.threads() or jvm_exit_events):
        raise RuntimeError("GDB stopped without a recoverable pending process exit")
    flags = os.WEXITED | os.WNOHANG | os.WNOWAIT
    info = os.waitid(os.P_PIDFD, jvm_exit_pidfd, flags)
    if info is None:
        # Wait once for this process only. Never resume it or launch another one.
        pending = select.poll()
        pending.register(jvm_exit_pidfd, select.POLLIN)
        pending.poll(1000)
        info = os.waitid(os.P_PIDFD, jvm_exit_pidfd, flags)
    if (info is None or info.si_pid != jvm_exit_pid or info.si_uid != os.getuid()
            or info.si_signo != jvm_signals.SIGCHLD or info.si_code != os.CLD_EXITED
            or not 0 <= info.si_status <= 255):
        raise RuntimeError("kernel did not report this JVM child's normal exit")
    return {"schemaVersion": 1, "kind": "linux-pidfd-waitid", "pid": jvm_exit_pid,
            "code": info.si_status, "wait": {"pid": info.si_pid, "uid": info.si_uid,
            "signal": info.si_signo, "reason": info.si_code, "status": info.si_status}}


def jvm_save_exit(observed):
    with open(config["armed"]) as source:
        manifest = json.load(source)
    if manifest["pid"] != observed["pid"] or manifest["nonce"] != config["nonce"]:
        raise RuntimeError("JVM exit manifest identity mismatch")
    manifest["jvmExit"] = observed
    with open(config["armed"], "w") as out:
        json.dump(manifest, out)
`;

const originalEnd = `try:
    jvm_finished()
except Exception as error:
    fail("JVM extraction final verification failed: " + str(error))
if state["failure"] is not None:
    stop(71, state["failure"])
signal, code = gdb.convenience_variable("_exitsignal"), gdb.convenience_variable("_exitcode")
if signal is not None or code is None or gdb.selected_inferior().pid != 0:
    jvm_log_exit_state()
    stop(72, "the inferior did not exit normally")
gdb.execute("quit " + str(int(code)))`;
const observedEnd = `if state["failure"] is not None:
    stop(71, state["failure"])
try:
    jvm_exit = jvm_observe_exit()
except Exception as error:
    jvm_log_exit_state()
    stop(72, "the inferior did not exit normally: " + str(error))
try:
    jvm_finished()
    jvm_save_exit(jvm_exit)
except Exception as error:
    fail("JVM extraction final verification failed: " + str(error))
if state["failure"] is not None:
    stop(71, state["failure"])
os.close(jvm_exit_pidfd)
if jvm_exit["kind"] == "linux-pidfd-waitid":
    gdb.write("fin JVM kernel exit: " + json.dumps(jvm_exit, sort_keys=True) + "\\n")
gdb.execute("quit " + str(jvm_exit["code"]))`;

/**
 * Extend the exact original observer without changing arming, counters or library checks.
 *
 * @param source - Complete original JVM observer with exit diagnostics.
 */
export const withFinContainerEdgeJvmWait = source => {
	for(const [before, after] of [
		["def write():\n", finContainerEdgeJvmWaitSupport + "\ndef write():\n"]
		, ["gdb.events.new_objfile.connect(on_new_objfile)"
			, `try:
    jvm_watch_exit()
except Exception as error:
    stop(71, "cannot bind JVM exit identity: " + str(error))
gdb.events.new_objfile.connect(on_new_objfile)`]
		, [originalEnd, observedEnd]
	]) {
		assert.equal(source.split(before).length, 2, "one exact JVM exit observation site");
		source = source.replace(before, after);
	}
	return source;
};

/**
 * Authenticate the normal exit record emitted by the new observer, including actual kernel status.
 * A nonzero normal exit still fails acceptance; missing or signalled exits never produce this record.
 *
 * @param record - Parsed manifest's jvmExit member.
 * @param pid - PID authenticated by the counter record and breakpoint manifest.
 */
export const assertFinContainerEdgeJvmExit = (record, pid) => {
	assert.ok(record && typeof record === "object", "a JVM process-exit receipt is required");
	assert.ok(["gdb-exit", "linux-pidfd-waitid"].includes(record.kind));
	assert.deepEqual(Object.keys(record).sort(), ["code", "kind", "pid", "schemaVersion", ...record.kind === "linux-pidfd-waitid" ? ["wait"] : []]);
	assert.equal(record.schemaVersion, 1);
	assert.ok(Number.isSafeInteger(pid) && pid > 0); assert.equal(record.pid, pid);
	assert.equal(record.code, 0, "the JVM process must actually exit successfully");
	if(record.kind === "linux-pidfd-waitid")
	{
		assert.deepEqual(Object.keys(record.wait).sort(), ["pid", "reason", "signal", "status", "uid"]);
		assert.equal(record.wait.pid, pid); assert.equal(record.wait.status, 0);
		assert.equal(record.wait.reason, 1, "Linux CLD_EXITED, never killed, dumped, stopped or trapped");
		assert.equal(record.wait.signal, 17, "Linux x86_64 SIGCHLD");
		assert.ok(Number.isSafeInteger(record.wait.uid) && record.wait.uid >= 0);
	}
};
