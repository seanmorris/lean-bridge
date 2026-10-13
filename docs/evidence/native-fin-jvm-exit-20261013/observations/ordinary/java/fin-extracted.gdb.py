# Count entries of the six Fin dispatch columns in one inferior that extracts its verified libraries.
import hashlib
import json
import os
import re
import shlex
import stat
import struct

import gdb

config = json.load(open(os.environ["LEAN_BRIDGE_FIN_GDB_CONFIG"]))
identity = config["identity"]
columns, definers, libraries, hashes = identity["columns"], identity["definers"], identity["libraries"], identity["hashes"]
parent = config["parent"]
prefix = re.compile(r"lean-bridge-jvm-[0-9]+\Z")
# Test-only failure injection: {"write": n} fails the n-th entry write, {"arm": true} fails arming.
inject = config.get("inject") or {}
state = {"fd": None, "pid": 0, "attached": 0, "armed": 0, "conflicts": 0, "foreign": 0,
         "breakpoints": [0] * 6, "definer": [-1] * 6, "entries": [0] * 6, "root": None, "images": {},
         "addresses": {}, "writes": 0, "failure": None}


import select
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

def write():
    record = struct.pack("<8sII64s32sqIIII6Q6i6I6Q", b"LBFINGDB", 1, 6, config["configSha256"].encode(), config["nonce"].encode(),
                         state["pid"], state["attached"], state["armed"], state["conflicts"], state["foreign"],
                         *state["breakpoints"], *state["definer"], *([0] * 6), *state["entries"])
    if os.pwrite(state["fd"], record, 0) != len(record):
        raise OSError("short instrumentation record write")


def fail(message):
    # A failure is sticky: the record is poisoned for the probe and GDB later exits 71.
    if state["failure"] is None:
        state["failure"] = message
    state["attached"] = 0
    try:
        write()
    except OSError:
        pass


def poison(message):
    # A refused deployment never recovers to a green record, whatever loads later.
    if state["failure"] is None:
        state["conflicts"] += 1
    fail("deployment refused: " + message)


def stop(code, message):
    gdb.write("fin instrumentation refused: " + message + "\n", gdb.STDERR)
    try:
        gdb.execute("kill")
    except gdb.error:
        pass
    gdb.execute("quit " + str(code))


class Counter(gdb.Breakpoint):
    def __init__(self, address, column):
        super().__init__("*" + hex(address), internal=True)
        self.column = column

    def stop(self):
        try:
            state["entries"][self.column] += 1
            state["writes"] += 1
            if inject.get("write") == state["writes"]:
                raise OSError("injected record write failure")
            write()
            return False
        except Exception as error:
            fail("entry count for column " + str(self.column) + " failed: " + str(error))
            # Halt the inferior at once; the run then ends with 71.
            return True


def definitions(name):
    text = gdb.execute("info functions -q ^" + re.escape(name) + "$", to_string=True)
    return [int(match, 16) for match in re.findall(r"^(0x[0-9a-f]+)\s+" + re.escape(name) + r"$", text, re.M)]


def maps():
    with open("/proc/" + str(state["pid"]) + "/maps") as lines:
        for line in lines:
            fields = line.rstrip("\n").split(None, 5)
            if len(fields) == 6:
                yield fields


def mapped(path):
    found = set()
    for fields in maps():
        if fields[5] == path:
            major, minor = (int(part, 16) for part in fields[3].split(":"))
            found.add((os.makedev(major, minor), int(fields[4])))
    return found


def base(path):
    return min(int(fields[0].split("-")[0], 16) for fields in maps() if fields[5] == path)


def digest(path):
    # The file the loader opened, never through a symlink, hashed while the inferior is stopped.
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode):
            raise OSError("not a regular file")
        value = hashlib.sha256()
        while True:
            chunk = os.read(fd, 1 << 20)
            if not chunk:
                break
            value.update(chunk)
        return (info.st_dev, info.st_ino), value.hexdigest()
    finally:
        os.close(fd)


def image(path, name):
    root = os.path.dirname(path)
    if state["armed"]:
        return poison(name + " loaded again after arming from " + path)
    if os.path.dirname(root) != parent or not prefix.match(os.path.basename(root)):
        return poison(name + " loaded from outside a direct extraction child of the parent: " + path)
    try:
        info = os.lstat(root)
    except OSError as error:
        return poison("unreadable extraction root " + root + ": " + str(error))
    if not stat.S_ISDIR(info.st_mode) or os.path.realpath(path) != path:
        return poison("symlinked extraction root or library: " + path)
    if state["root"] is not None and state["root"] != root:
        return poison("a second extraction root " + root + " beside " + state["root"])
    if name in state["images"]:
        return poison("duplicate image of " + name)
    try:
        identity_, value = digest(path)
    except OSError as error:
        return poison("unreadable library " + path + ": " + str(error))
    if value != hashes[name]:
        return poison(name + " has bytes " + value + " instead of " + hashes[name])
    if identity_ not in mapped(path):
        return poison(name + " is not mapped from the hashed file")
    state["root"] = root
    state["images"][name] = {"sha256": value, "device": identity_[0], "inode": identity_[1]}


def arm():
    root = state["root"]
    # Every image is still the hashed, mapped file when the columns are armed.
    for name in libraries:
        path = os.path.join(root, name)
        try:
            identity_, value = digest(path)
        except OSError as error:
            return poison("library removed or unreadable before arming: " + path + ": " + str(error))
        recorded = state["images"][name]
        if value != recorded["sha256"] or identity_ != (recorded["device"], recorded["inode"]) or identity_ not in mapped(path):
            return poison("library changed before arming: " + path)
    armed = []
    for column, name in enumerate(columns):
        found = definitions(name)
        if len(found) != 1:
            state["conflicts" if found else "foreign"] += 1
            continue
        solib, expected = gdb.solib_name(found[0]), os.path.join(root, definers[column])
        if solib != expected:
            state["foreign"] += 1
            continue
        try:
            breakpoint = Counter(found[0], column)
        except gdb.error:
            state["conflicts"] += 1
            continue
        locations = breakpoint.locations
        if breakpoint.pending or len(locations) != 1 or locations[0].address != found[0] or not locations[0].enabled:
            state["conflicts"] += 1
            continue
        state["breakpoints"][column] = 1
        state["definer"][column] = libraries.index(definers[column])
        state["armed"] |= 1 << column
        state["addresses"][name] = found[0]
        armed.append({"symbol": name, "library": definers[column], "address": found[0], "offset": found[0] - base(expected)})
    if inject.get("arm"):
        raise RuntimeError("injected arming failure")
    # Provenance kept outside the mapped record, for an independent final comparison.
    with open(config["armed"], "x") as out:
        json.dump({"pid": state["pid"], "configSha256": config["configSha256"], "nonce": config["nonce"], "parent": parent,
                   "root": root, "images": state["images"], "breakpoints": armed}, out)
    write()


def on_new_objfile(event):
    try:
        loaded(event)
    except Exception as error:
        fail("instrumentation callback failed: " + str(error))


def loaded(event):
    path = event.new_objfile.username or event.new_objfile.filename
    name = os.path.basename(path)
    if name in hashes:
        image(path, name)
    elif os.path.realpath(path).startswith(parent + os.sep):
        poison("an unconfigured library loaded from the parent: " + path)
    elif state["addresses"]:
        # A definition appearing later makes the armed one ambiguous.
        for symbol, address in state["addresses"].items():
            if definitions(symbol) != [address]:
                poison("a new definition of " + symbol + " appeared after arming")
    if state["failure"] is None and not state["armed"] and set(state["images"]) == set(libraries) and not os.path.exists(config["armed"]):
        arm()
    write()


def fresh(path):
    try:
        info = os.lstat(path)
    except OSError:
        return False
    return stat.S_ISDIR(info.st_mode) and os.path.realpath(path) == path and not os.listdir(path)


if not fresh(parent):
    stop(70, "the extraction parent is not a fresh, empty, canonical directory: " + parent)
try:
    # Address-space randomization stays as the process normally runs.
    for setting in ["pagination off", "confirm off", "breakpoint pending off", "disable-randomization off"]:
        gdb.execute("set " + setting)
    gdb.execute("handle all nostop noprint pass")
    gdb.execute("file " + shlex.quote(config["argv"][0]))
    gdb.execute("starti " + " ".join(shlex.quote(arg) for arg in config["argv"][1:])
                + " > " + shlex.quote(config["stdout"]) + " 2> " + shlex.quote(config["stderr"]))
    state["pid"] = gdb.selected_inferior().pid
except gdb.error as error:
    stop(71, "cannot start the inferior under ptrace: " + str(error))
try:
    # A fresh record only, created before the inferior runs any of its own code.
    state["fd"] = os.open(config["record"], os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    state["attached"] = 1
    write()
except OSError as error:
    stop(70, str(error))
try:
    jvm_watch_exit()
except Exception as error:
    stop(71, "cannot bind JVM exit identity: " + str(error))
gdb.events.new_objfile.connect(on_new_objfile)
jvm_exit_events = []


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

try:
    gdb.execute("continue")
except gdb.error as error:
    stop(71, str(error))
if state["failure"] is not None:
    stop(71, state["failure"])
try:
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
    gdb.write("fin JVM kernel exit: " + json.dumps(jvm_exit, sort_keys=True) + "\n")
gdb.execute("quit " + str(jvm_exit["code"]))
