# Count actual entries of the eight Fin container edge columns by address breakpoints in one inferior.
import json
import os
import re
import shlex
import struct

import gdb

config = json.load(open(os.environ["LEAN_BRIDGE_FIN_EDGE_GDB_CONFIG"]))
identity = config["identity"]
columns, definers, libraries = identity["columns"], identity["definers"], identity["libraries"]
WIDTH = 8
root = os.path.realpath(config["root"])
# Test-only failure injection: {"write": n} fails the n-th entry write, {"arm": true} fails arming.
inject = config.get("inject") or {}
state = {"fd": None, "pid": 0, "attached": 0, "armed": 0, "conflicts": 0, "foreign": 0,
         "breakpoints": [0] * WIDTH, "definer": [-1] * WIDTH, "entries": [0] * WIDTH, "loaded": set(), "addresses": {},
         "writes": 0, "failure": None}


import hashlib
import stat
jvm_policy = json.loads("{\n  \"extractionRoot\": \"/app/build/vo1454-actual-edge-jvm-3beb2ca/gdb15-diagnostics-r3/jvm-2\",\n  \"libraries\": {\n    \"libcomponent_3acdf22f1550490d7b06.so\": \"83a7b20759f9c65d363fc158796ed8f7941afd34de74f536acef48d13e86fcc5\",\n    \"libfincontainers.so\": \"517cd6dbc3c379671357ba627a4dbffb1b4a3495987bed10c2b3cb4880717fa3\",\n    \"liblean_bridge_native.so\": \"25bb83c98a7f86c15c8f5a5181457943beae8e9052ce059cf11df47060cdb5f7\",\n    \"libleanshared.so\": \"d7768b88d8162736da4305777cd6f147676038fd885bd8a265c958b0ecea00b4\"\n  },\n  \"nativeDirectory\": \"/app/build/vo1454-actual-edge-jvm-3beb2ca/consumer/java-relocated/jar-inspection/META-INF/lean-bridge/native/linux-x64\"\n}\n")
jvm_copies = {}
jvm_extracted = None


def jvm_digest(fd):
    os.lseek(fd, 0, os.SEEK_SET)
    digest = hashlib.sha256()
    while True:
        chunk = os.read(fd, 1024 * 1024)
        if not chunk:
            return digest.hexdigest()
        digest.update(chunk)


def jvm_discover(filename):
    global root, jvm_extracted
    path = os.path.abspath(filename)
    if os.path.basename(path) not in libraries:
        return
    if os.path.realpath(path) != path:
        raise RuntimeError("JVM native file traverses a symlink")
    parent = os.path.dirname(path)
    if jvm_extracted is not None:
        if parent != jvm_extracted:
            raise RuntimeError("JVM loaded a second native directory: " + parent + " instead of " + jvm_extracted)
        return
    outer = jvm_policy["extractionRoot"]
    if os.path.realpath(outer) != outer or os.path.dirname(parent) != outer or not re.fullmatch(r"lean-bridge-jvm-[0-9]+", os.path.basename(parent)):
        raise RuntimeError("JVM native directory is outside this run")
    if sorted(os.listdir(outer)) != [os.path.basename(parent)] or sorted(os.listdir(parent)) != libraries:
        raise RuntimeError("unrecorded JVM extraction file")
    info = os.lstat(parent)
    if not stat.S_ISDIR(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o700 or info.st_uid != os.getuid():
        raise RuntimeError("JVM extraction must be a private directory")
    for name in libraries:
        native = os.path.join(parent, name)
        fd = os.open(native, os.O_RDONLY | os.O_NOFOLLOW)
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid():
            os.close(fd)
            raise RuntimeError("JVM native copy must be a private regular file")
        if jvm_digest(fd) != jvm_policy["libraries"][name]:
            os.close(fd)
            raise RuntimeError("JVM native copy differs from original archive")
        jvm_copies[name] = {"fd": fd, "bytes": info.st_size, "device": info.st_dev, "inode": info.st_ino}
    root = parent
    jvm_extracted = parent


def jvm_manifest():
    if sorted(jvm_copies) != libraries:
        raise RuntimeError("incomplete JVM extraction identity")
    return {"root": jvm_extracted, "parent": jvm_policy["extractionRoot"],
            "libraries": {name: {**{key: value for key, value in item.items() if key != "fd"}, "sha256": jvm_policy["libraries"][name]} for name, item in jvm_copies.items()}}


def jvm_finished():
    if not jvm_copies or not os.path.exists(config["armed"]):
        return
    observed = {}
    for name, item in jvm_copies.items():
        info = os.fstat(item["fd"])
        digest = jvm_digest(item["fd"])
        if digest != jvm_policy["libraries"][name] or info.st_size != item["bytes"] or info.st_dev != item["device"] or info.st_ino != item["inode"]:
            raise RuntimeError("JVM native copy changed during execution")
        observed[name] = {"sha256": digest, "linksAfterExit": info.st_nlink}
        os.close(item["fd"])
    with open(config["armed"]) as source:
        manifest = json.load(source)
    manifest["jvmExtraction"]["afterExit"] = observed
    with open(config["armed"], "w") as out:
        json.dump(manifest, out)


def write():
    record = struct.pack("<8sII64s32sqIIII8Q8i8I8Q", b"LBFEDGDB", 1, WIDTH, config["configSha256"].encode(), config["nonce"].encode(),
                         state["pid"], state["attached"], state["armed"], state["conflicts"], state["foreign"],
                         *state["breakpoints"], *state["definer"], *([0] * WIDTH), *state["entries"])
    if os.pwrite(state["fd"], record, 0) != len(record):
        raise OSError("short instrumentation record write")


def fail(message):
    # A callback failure is sticky: the record is poisoned for the probe and GDB later exits 71.
    if state["failure"] is None:
        state["failure"] = message
    state["attached"] = 0
    try:
        write()
    except OSError:
        pass


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


def base(path):
    starts = []
    with open("/proc/" + str(state["pid"]) + "/maps") as maps:
        for line in maps:
            fields = line.split()
            if len(fields) >= 6 and os.path.realpath(fields[5]) == path:
                starts.append(int(fields[0].split("-")[0], 16))
    return min(starts)


def arm():
    armed = []
    for column, name in enumerate(columns):
        found = definitions(name)
        if len(found) != 1:
            state["conflicts" if found else "foreign"] += 1
            continue
        solib, expected = gdb.solib_name(found[0]), os.path.join(root, definers[column])
        if not solib or os.path.realpath(solib) != expected:
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
        json.dump({"pid": state["pid"], "configSha256": config["configSha256"], "nonce": config["nonce"], "breakpoints": armed, "jvmExtraction": jvm_manifest()}, out)
    write()


def on_new_objfile(event):
    try:
        loaded(event)
    except Exception as error:
        fail("instrumentation callback failed: " + str(error))


def loaded(event):
    jvm_discover(event.new_objfile.filename)
    path = os.path.realpath(event.new_objfile.filename)
    if os.path.dirname(path) == root and os.path.basename(path) in libraries:
        state["loaded"].add(os.path.basename(path))
    if state["loaded"] == set(libraries) and not os.path.exists(config["armed"]):
        arm()
    elif state["addresses"]:
        # A definition appearing later makes the armed one ambiguous.
        for name, address in state["addresses"].items():
            if definitions(name) != [address]:
                state["conflicts"] += 1
        write()


if (identity.get("kind") != "fin-container-edge" or len(columns) != WIDTH or len(set(columns)) != WIDTH
        or len(definers) != WIDTH or any(name not in libraries for name in definers)):
    gdb.write("fin instrumentation refused: the container identity is not eight distinct columns\n", gdb.STDERR)
    gdb.execute("quit 71")
if root != jvm_policy["nativeDirectory"] or sorted(jvm_policy["libraries"]) != libraries:
    stop(71, "JVM original native inventory mismatch")
if os.path.realpath(jvm_policy["extractionRoot"]) != jvm_policy["extractionRoot"] or os.listdir(jvm_policy["extractionRoot"]):
    stop(71, "JVM extraction parent is not fresh")
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
        raise RuntimeError("injected diagnostic read failure")
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
try:
    jvm_finished()
except Exception as error:
    fail("JVM extraction final verification failed: " + str(error))
if state["failure"] is not None:
    stop(71, state["failure"])
gdb.set_convenience_variable("_exitcode", None)
signal, code = gdb.convenience_variable("_exitsignal"), gdb.convenience_variable("_exitcode")
if signal is not None or code is None or gdb.selected_inferior().pid != 0:
    jvm_log_exit_state()
    stop(72, "the inferior did not exit normally")
gdb.execute("quit " + str(int(code)))
