/**
 * Apply the existing exact-child exit observer to the ten-column JVM probe.
 * Historical instrumentation text remains available without new observations.
 *
 * @file
 */
import assert from "node:assert/strict";
import { finContainerEdgeJvmExitDiagnostics } from "./fin-container-edge-jvm-exit.mjs";
import { finContainerEdgeJvmWaitSupport } from "./fin-container-edge-jvm-wait.mjs";

const originalEnd = `signal, code = gdb.convenience_variable("_exitsignal"), gdb.convenience_variable("_exitcode")
if signal is not None or code is None or gdb.selected_inferior().pid != 0:
    stop(72, "the inferior did not exit normally")
gdb.execute("quit " + str(int(code)))`;
const observedEnd = `try:
    jvm_exit = jvm_observe_exit()
except Exception as error:
    jvm_log_exit_state()
    stop(72, "the inferior did not exit normally: " + str(error))
if jvm_exit["code"] == 0:
    try:
        jvm_save_exit(jvm_exit)
    except Exception as error:
        stop(71, "cannot record JVM exit: " + str(error))
os.close(jvm_exit_pidfd)
if jvm_exit["kind"] == "linux-pidfd-waitid":
    gdb.write("fin JVM kernel exit: " + json.dumps(jvm_exit, sort_keys=True) + "\\n")
gdb.execute("quit " + str(jvm_exit["code"]))`;

/**
 * Bind a process handle before execution and require an observed exit afterwards.
 * Arming, deployment checks and all ten counters retain their original text.
 *
 * @param source - Complete historical extracted-root instrumentation script.
 */
export const withFinContainerJvmEntryWait = source => {
	for(const [before, after] of [
		["def write():\n", finContainerEdgeJvmWaitSupport + "\ndef write():\n"]
		, ["gdb.events.new_objfile.connect(on_new_objfile)"
			, `try:
    jvm_watch_exit()
except Exception as error:
    stop(71, "cannot bind JVM exit identity: " + str(error))
gdb.events.new_objfile.connect(on_new_objfile)
` + finContainerEdgeJvmExitDiagnostics]
		, [originalEnd, observedEnd]
	]) {
		assert.equal(source.split(before).length, 2, "one exact container-entry exit observation site");
		source = source.replace(before, after);
	}
	return source;
};

const hostProcess = source => source
	.replaceAll("jvm_", "process_")
	.replaceAll("JVM", "host process")
	.replaceAll('"jvmExit"', '"processExit"');

const hostProcessWaitSupport = hostProcess(finContainerEdgeJvmWaitSupport);
const hostProcessExitDiagnostics = hostProcess(finContainerEdgeJvmExitDiagnostics);
const hostProcessObservedEnd = hostProcess(observedEnd);

/**
 * Apply the same exact-child Linux exit observation to the non-extracting host probes used by .NET,
 * Ruby and the ordinary FinContainers entry checks. The original JVM implementation is process-neutral;
 * this spelling keeps its manifest and diagnostics honest for other runtimes.
 *
 * @param source - Complete non-extracting scalar or container GDB observer.
 */
export const withFinHostProcessWait = source => {
	for(const [before, after] of [
		["def write():\n", hostProcessWaitSupport + "\ndef write():\n"]
		, ["gdb.events.new_objfile.connect(on_new_objfile)"
			, `try:
    process_watch_exit()
except Exception as error:
    stop(71, "cannot bind host process exit identity: " + str(error))
gdb.events.new_objfile.connect(on_new_objfile)
` + hostProcessExitDiagnostics]
		, [originalEnd, hostProcessObservedEnd]
	]) {
		assert.equal(source.split(before).length, 2, "one exact host process exit observation site");
		source = source.replace(before, after);
	}
	return source;
};
