/**
 * JVM-only debugger diagnostics. These observations never decide whether a run passes.
 *
 * @file
 */
import assert from "node:assert/strict";

export const finContainerEdgeJvmExitDiagnostics = String.raw`jvm_exit_events = []


def jvm_record_exit(event):
    try:
        item = {"code": getattr(event, "exit_code", None), "pid": event.inferior.pid}
    except Exception as error:
        item = {"error": str(error)}
    jvm_exit_events.append(item)
    del jvm_exit_events[:-8]


def jvm_log_exit_state():
    try:
        code = gdb.convenience_variable("_exitcode")
        signal = gdb.convenience_variable("_exitsignal")
        inferior = gdb.selected_inferior()
        if signal is None and code is not None and inferior.pid == 0:
            return
        threads = inferior.threads()
        report = {"pid": inferior.pid, "observedPid": state["pid"],
                  "exitCode": None if code is None else str(code),
                  "exitSignal": None if signal is None else str(signal),
                  "exitEvents": jvm_exit_events, "threadCount": len(threads),
                  "threads": [{"num": thread.num, "ptid": list(thread.ptid),
                               "stopped": thread.is_stopped(), "running": thread.is_running(),
                               "exited": thread.is_exited()} for thread in threads[:64]],
                  "kernel": os.uname().release, "gdb": gdb.VERSION}
        try:
            with open("/proc/" + str(state["pid"]) + "/status") as source:
                report["processStatus"] = {line.split(":", 1)[0]: line.split(":", 1)[1].strip()
                                           for line in source.read(8192).splitlines()
                                           if line.startswith(("State:", "Threads:", "TracerPid:"))}
        except OSError as error:
            report["processStatusError"] = str(error)
        gdb.write("fin JVM exit diagnostics: " + json.dumps(report, sort_keys=True) + "\n", gdb.STDERR)
    except Exception as error:
        gdb.write("fin JVM exit diagnostics unavailable: " + str(error) + "\n", gdb.STDERR)


gdb.events.exited.connect(jvm_record_exit)
`;

/**
 * Reconstruct the prior observer by removing only the added diagnostic statements.
 * Both exact versions retain the same exit, library and counter checks.
 *
 * @param source - Complete current JVM observer script.
 */
export const withoutFinContainerEdgeJvmExitDiagnostics = source => {
	for(const addition of ["\n" + finContainerEdgeJvmExitDiagnostics, "    jvm_log_exit_state()\n"])
	{
		assert.equal(source.split(addition).length, 2, "one exact JVM diagnostic addition");
		source = source.replace(addition, "");
	}
	return source;
};
