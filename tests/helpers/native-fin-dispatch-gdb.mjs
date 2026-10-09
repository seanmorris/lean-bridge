/**
 * Test-only entry counters by GDB address breakpoints, for hosts whose loaders defeat LD_PRELOAD and for
 * entries that no relocation references. GDB launches the inferior, creates a fresh record before any
 * inferior code runs, and once every verified library has loaded it arms one in-memory int3 breakpoint at
 * the single verified definition of each counted symbol. Each hit increments that column in the record and
 * resumes. Deployed files and production loaders are unchanged; execution is instrumented in memory.
 *
 * @file
 */
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { nativeFinDispatchSymbols } from "./native-fin-dispatch.mjs";

/** Fixed record layout shared by the GDB script, host probes and this reader; little-endian x86_64. */
export const nativeFinGdbRecord = Object.freeze({
	size: 280, magic: "LBFINGDB", version: 1
	// Ruby String#unpack spelling of the same layout.
	, rubyFormat: "a8L<L<a64a32q<L<L<L<L<Q<6l<6L<6Q<6"
});
/** GDB exit statuses that are never an inferior's own: a refused record, an instrumentation error, a signal. */
export const nativeFinGdbExit = Object.freeze({ refusedRecord: 70, instrumentation: 71, signal: 72 });
const library = /^[A-Za-z0-9_.+-]+\.so(?:\.[0-9]+)*$/u;

/**
 * The single defining library of each counted symbol, from `nm -D --defined-only` listings of the verified
 * libraries. A symbol defined nowhere or in more than one library is refused.
 *
 * @param componentId - Component identity that names the adapters.
 * @param listings - Map from library basename to its nm output.
 */
export const nativeFinDefiners = (componentId, listings) => Object.fromEntries(nativeFinDispatchSymbols(componentId).map(symbol => {
	const owners = Object.entries(listings).filter(([, text]) => text.split("\n").some(line => new RegExp(`^[0-9a-f]+ [TW] ${symbol}$`, "u").test(line.trim()))).map(([name]) => name);
	if(owners.length !== 1) throw new TypeError(`${symbol} must be defined by exactly one verified library, not ${owners.length}`);
	return [symbol, owners[0]];
}));

/**
 * The identity GDB counts against: six columns for one component, the verified libraries and the one
 * library that must define each column. Its digest is recorded by GDB and required by probes.
 *
 * @param root0 - Component identity, verified library basenames and per-column defining library.
 * @param root0.componentId - Component identity that names the adapters.
 * @param root0.libraries - Basenames of every verified library in the deployment directory.
 * @param root0.definers - Defining library basename for each counted symbol.
 */
export const nativeFinGdbIdentity = ({ componentId, libraries, definers }) => {
	const columns = nativeFinDispatchSymbols(componentId), names = [...libraries].sort();
	if(!names.length || names.some(name => !library.test(name)) || new Set(names).size !== names.length) throw new TypeError("Invalid instrumented library names");
	if(Object.keys(definers).sort().join() !== [...columns].sort().join()) throw new TypeError("Every counted column needs exactly one defining library");
	if(columns.some(column => !names.includes(definers[column]))) throw new TypeError("A defining library is outside the instrumented libraries");
	const identity = { schemaVersion: 1, platform: "x86_64-linux-gnu", instrument: "gdb-breakpoints", componentId, columns, libraries: names, definers: columns.map(column => definers[column]) };
	return { identity, configSha256: sha256(canonicalJson(identity)), definerIndices: identity.definers.map(name => names.indexOf(name)) };
};

/**
 * Parse a record's exact bytes.
 *
 * @param bytes - The complete record file.
 */
export const readNativeFinGdbRecord = bytes => {
	if(!Buffer.isBuffer(bytes) || bytes.length !== nativeFinGdbRecord.size) throw new TypeError("instrumentation record has the wrong size");
	const ascii = (start, length) => bytes.toString("latin1", start, start + length);
	const words = (start, size, read) => Array.from({ length: 6 }, (_, k) => read(start + size * k));
	const u32 = offset => bytes.readUInt32LE(offset), u64 = offset => Number(bytes.readBigUInt64LE(offset));
	return {
		magic: ascii(0, 8)
		, version: u32(8)
		, columns: u32(12)
		, config: ascii(16, 64)
		, nonce: ascii(80, 32)
		, pid: Number(bytes.readBigInt64LE(112))
		, attached: u32(120)
		, armed: u32(124)
		, conflicts: u32(128)
		, foreign: u32(132)
		, breakpoints: words(136, 8, u64)
		, definers: words(184, 4, offset => bytes.readInt32LE(offset))
		, entries: words(232, 8, u64)
	};
};

/**
 * GDB Python run as `gdb -batch -q -nx -x script` with LEAN_BRIDGE_FIN_GDB_CONFIG naming a JSON file of
 * identity, root, nonce, record, armed, argv, stdout and stderr. GDB exits with the inferior's status, or
 * with 70 when the record cannot be freshly created, 71 on an instrumentation error and 72 when the
 * inferior ends by a signal or does not end.
 */
export const nativeFinGdbScript = String.raw`# Count actual entries of the six Fin dispatch columns by address breakpoints in one inferior.
import json
import os
import re
import shlex
import struct

import gdb

config = json.load(open(os.environ["LEAN_BRIDGE_FIN_GDB_CONFIG"]))
identity = config["identity"]
columns, definers, libraries = identity["columns"], identity["definers"], identity["libraries"]
root = os.path.realpath(config["root"])
# Test-only failure injection: {"write": n} fails the n-th entry write, {"arm": true} fails arming.
inject = config.get("inject") or {}
state = {"fd": None, "pid": 0, "attached": 0, "armed": 0, "conflicts": 0, "foreign": 0,
         "breakpoints": [0] * 6, "definer": [-1] * 6, "entries": [0] * 6, "loaded": set(), "addresses": {},
         "writes": 0, "failure": None}


def write():
    record = struct.pack("<8sII64s32sqIIII6Q6i6I6Q", b"LBFINGDB", 1, 6, config["configSha256"].encode(), config["nonce"].encode(),
                         state["pid"], state["attached"], state["armed"], state["conflicts"], state["foreign"],
                         *state["breakpoints"], *state["definer"], *([0] * 6), *state["entries"])
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
        json.dump({"pid": state["pid"], "configSha256": config["configSha256"], "nonce": config["nonce"], "breakpoints": armed}, out)
    write()


def on_new_objfile(event):
    try:
        loaded(event)
    except Exception as error:
        fail("instrumentation callback failed: " + str(error))


def loaded(event):
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
try:
    gdb.execute("continue")
except gdb.error as error:
    stop(71, str(error))
if state["failure"] is not None:
    stop(71, state["failure"])
signal, code = gdb.convenience_variable("_exitsignal"), gdb.convenience_variable("_exitcode")
if signal is not None or code is None or gdb.selected_inferior().pid != 0:
    stop(72, "the inferior did not exit normally")
gdb.execute("quit " + str(int(code)))
`;
