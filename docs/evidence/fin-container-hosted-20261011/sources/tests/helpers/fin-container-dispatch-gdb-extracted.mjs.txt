/**
 * Test-only FinContainers entry counters over the ten columns of fin-container-entry-dispatch.mjs, by GDB
 * address breakpoints, for hosts that extract their verified libraries into a fresh directory at run time,
 * as the JVM loader does (VO #1438). The record, identity and script are separate from the scalar
 * native-fin-dispatch-gdb-extracted ones, which are unchanged. The run owns one fresh, empty, canonical parent P
 * and points the host's temporary directory at it. GDB binds the deployment root D once: a direct,
 * non-symlink child of P named by the loader's prefix, holding every configured library as a regular,
 * non-symlink file whose mapped device and inode are the hashed file's and whose SHA-256, read while the
 * inferior is stopped, is the configured one. Only then are the ten columns armed, once. A configured
 * library from anywhere else, a second root, a duplicate or changed image, a symlink, a configured image
 * after arming or a new definition after arming poisons the run permanently.
 *
 * @file
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { finContainerEntrySymbols } from "./fin-container-entry-dispatch.mjs";
import { finContainerDefiners, finContainerGdbCommand, finContainerGdbRecord, readFinContainerGdbRecord } from "./fin-container-dispatch-gdb.mjs";
import { copiedCleanEnvironment, runCopied } from "./copied-fixture-install.mjs";
import { saveLakeFile } from "./lake-workspace.mjs";

const library = /^[A-Za-z0-9_.+-]+\.so(?:\.[0-9]+)*$/u;
/** The JVM loader's Files.createTempDirectory prefix followed by its unsigned random digits. */
export const finContainerExtractedRoot = /^lean-bridge-jvm-[0-9]+$/u;
const width = 10;

/**
 * The identity GDB counts against: the ten container columns for one component, every verified library with its exact
 * content hash, and the one library that must define each column.
 *
 * @param root0 - Component identity, verified library hashes and per-column defining library.
 * @param root0.componentId - Component identity that names the adapters.
 * @param root0.hashes - Basename to SHA-256 of every verified library the host extracts.
 * @param root0.definers - Defining library basename for each counted symbol.
 */
export const finContainerGdbExtractedIdentity = ({ componentId, hashes, definers }) => {
	const columns = finContainerEntrySymbols(componentId), names = Object.keys(hashes).sort();
	if(columns.length !== width || new Set(columns).size !== width) throw new TypeError("The container identity needs ten distinct columns");
	if(!names.length || names.some(name => !library.test(name) || !/^[a-f0-9]{64}$/u.test(hashes[name]))) throw new TypeError("Invalid extracted library identities");
	if(Object.keys(definers).sort().join() !== [...columns].sort().join()) throw new TypeError("Every counted column needs exactly one defining library");
	if(columns.some(column => !names.includes(definers[column]))) throw new TypeError("A defining library is outside the extracted libraries");
	const exact = Object.fromEntries(names.map(name => [name, hashes[name]]));
	const identity = {
		schemaVersion: 1
		, kind: "fin-container-entry"
		, platform: "x86_64-linux-gnu"
		, instrument: "gdb-breakpoints-extracted-root"
		, componentId
		, columns
		, libraries: names
		, hashes: exact
		, definers: columns.map(column => definers[column])
	};
	return { identity, configSha256: sha256(canonicalJson(identity)), definerIndices: identity.definers.map(name => names.indexOf(name)) };
};

/**
 * GDB Python run as `gdb -batch -q -nx -x script` with LEAN_BRIDGE_FIN_CONTAINER_GDB_CONFIG naming a JSON file of
 * identity, parent, nonce, record, armed, argv, stdout and stderr. Exit statuses match the strict-root
 * script: the inferior's own, 70 for a refused record or parent, 71 for an instrumentation failure or a
 * poisoned deployment, 72 for a signal.
 */
export const finContainerGdbExtractedScript = String.raw`# Count entries of the ten FinContainers columns in one inferior that extracts its verified libraries.
import hashlib
import json
import os
import re
import shlex
import stat
import struct

import gdb

config = json.load(open(os.environ["LEAN_BRIDGE_FIN_CONTAINER_GDB_CONFIG"]))
identity = config["identity"]
columns, definers, libraries, hashes = identity["columns"], identity["definers"], identity["libraries"], identity["hashes"]
parent = config["parent"]
WIDTH = 10
prefix = re.compile(r"lean-bridge-jvm-[0-9]+\Z")
# Test-only failure injection: {"write": n} fails the n-th entry write, {"arm": true} fails arming.
inject = config.get("inject") or {}
state = {"fd": None, "pid": 0, "attached": 0, "armed": 0, "conflicts": 0, "foreign": 0,
         "breakpoints": [0] * WIDTH, "definer": [-1] * WIDTH, "entries": [0] * WIDTH, "root": None, "images": {},
         "addresses": {}, "writes": 0, "failure": None}


def write():
    record = struct.pack("<8sII64s32sqIIII10Q10i10I10Q", b"LBFCOGDB", 1, WIDTH, config["configSha256"].encode(), config["nonce"].encode(),
                         state["pid"], state["attached"], state["armed"], state["conflicts"], state["foreign"],
                         *state["breakpoints"], *state["definer"], *([0] * WIDTH), *state["entries"])
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
if (identity.get("kind") != "fin-container-entry" or len(columns) != WIDTH or len(set(columns)) != WIDTH
        or len(definers) != WIDTH or any(name not in libraries for name in definers)):
    gdb.write("fin instrumentation refused: the container identity is not ten distinct columns\n", gdb.STDERR)
    gdb.execute("quit 71")
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

/**
 * GDB arguments and environment for one run. Control additions reach the inferior only, as explicit settings:
 * preloading the real Lean libraries into GDB itself replaces its C++ unwinder, and GDB then aborts on its
 * first internal exception. Each setting stays one exact GDB command.
 *
 * @param root0 - One run.
 * @param root0.script - The instrumentation script.
 * @param root0.config - The run's configuration file.
 * @param root0.env - Clean environment of GDB and, through it, the inferior.
 * @param root0.extra - Test-only inferior environment additions.
 */
export const finContainerGdbInvocation = ({ script, config, env, extra = {} }) => {
	const settings = Object.entries(extra).flatMap(([name, value]) => {
		if(!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name)) throw new TypeError(`Invalid inferior environment name: ${JSON.stringify(name)}`);
		if(typeof value !== "string" || value === "" || /[\0\n\r]/u.test(value) || value.trim() !== value) throw new TypeError(`Invalid inferior environment value for ${name}`);
		return ["-iex", `set environment ${name}=${value}`];
	});
	return { args: ["-batch", "-q", "-nx", ...settings, "-x", script], environment: { ...env, LEAN_BRIDGE_FIN_CONTAINER_GDB_CONFIG: config } };
};

/**
 * Prepare GDB instrumentation of one host that extracts the verified libraries of resourceDirectory. Every
 * run gets a fresh, empty, canonical parent for the host's temporary directory, plus a new nonce, record,
 * breakpoint manifest and output files.
 *
 * @param root0 - Verified resources and the probe command that extracts and loads them.
 * @param root0.probeRoot - Task-owned directory for the script, parents, records and outputs.
 * @param root0.resourceDirectory - The package's verified native resources, extracted by the test itself.
 * @param root0.componentId - Component identity that names the counted adapters.
 * @param root0.argv - Probe command line from { record, nonce, configSha256, definerIndices, mode, tmpdir }.
 * @param root0.cwd - Working directory for the probe.
 * @param root0.env - Clean environment that finds the installed package.
 * @param root0.definers - Optional per-column definer override, for refusal controls.
 */
export const observeExtractedFinContainerDispatch = async ({ probeRoot, resourceDirectory, componentId, argv, cwd, env, definers = null }) => {
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };
	const libraries = (await readdir(resourceDirectory)).filter(name => /\.so(?:\.[0-9]+)*$/u.test(name)).sort();
	const listings = {}, hashes = {};
	for(const name of libraries)
	{
		listings[name] = (await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(resourceDirectory, name)], resourceDirectory, tools)).stdout;
		hashes[name] = sha256(await readFile(join(resourceDirectory, name)));
	}
	const { identity, configSha256, definerIndices } = finContainerGdbExtractedIdentity({ componentId, hashes, definers: definers ?? finContainerDefiners(componentId, listings) });
	await saveLakeFile(probeRoot, "fin-container-extracted.gdb.py", finContainerGdbExtractedScript);
	let runs = 0;
	/**
	 * One probe run; before() may plant a file at the record path or inside the parent first.
	 *
	 * @param root0 - Run options.
	 * @param root0.gdb - Run under GDB instrumentation.
	 * @param root0.mode - Optional probe mode.
	 * @param root0.nonce - Run nonce; fresh unless replayed by a control.
	 * @param root0.before - Optional hook given the record path and the parent.
	 * @param root0.tmpdir - Optional host temporary directory other than the parent, for refusal controls.
	 * @param root0.inject - Test-only GDB failure injection, never used by acceptance runs.
	 * @param root0.extra - Test-only inferior environment additions for refusal controls, never GDB's own.
	 */
	const run = async ({ gdb = true, mode = null, nonce = randomBytes(16).toString("hex"), before = null, tmpdir = null, inject = null, extra = {} } = {}) => {
		const stem = join(probeRoot, `run-${runs++}`), record = `${stem}.record`, armed = `${stem}.armed.json`, parent = `${stem}.parent`;
		// The run owns a new, empty parent that is already canonical.
		await mkdir(parent);
		assert.equal(await realpath(parent), parent, "the extraction parent is canonical");
		if(before) await before(record, parent);
		const command = argv({ record, nonce, configSha256, definerIndices, mode, tmpdir: tmpdir ?? parent });
		const config = { identity, configSha256, parent, nonce, record, armed, argv: command, stdout: `${stem}.stdout`, stderr: `${stem}.stderr`, ...inject ? { inject } : {} };
		await writeFile(`${stem}.json`, canonicalJson(config), { flag: "wx" });
		const invocation = finContainerGdbInvocation({ script: join(probeRoot, "fin-container-extracted.gdb.py"), config: `${stem}.json`, env, extra });
		const started = gdb
			? runCopied(finContainerGdbCommand, invocation.args, cwd, invocation.environment)
			: runCopied(command[0], command.slice(1), cwd, { ...env, ...extra });
		let code = 0, stdout, stderr;
		try
		{ ({ stdout, stderr } = await started); }
		catch(error)
		{
			const status = /exited with status (\d+)/u.exec(error.message);
			if(!status) throw error;
			code = Number(status[1]); ({ stdout, stderr } = error.details);
		}
		const read = async path => (existsSync(path) ? readFile(path, "utf8") : null);
		// Under GDB the process streams carry GDB's own messages; the probe's streams are files.
		if(!gdb) return { record, nonce, armed, parent, code, output: stdout + stderr, stdout, stderr };
		return { record, nonce, armed, parent, code, output: stdout + stderr, stdout: await read(config.stdout), stderr: await read(config.stderr) };
	};
	return { identity, configSha256, definerIndices, listings, hashes, run };
};

/**
 * Require one accepted run's record and manifest to match its rows, its own parent, one extraction root,
 * the verified hashes and the verified definitions.
 *
 * @param observer - Result of observeExtractedFinContainerDispatch.
 * @param root0 - One run.
 * @param root0.record - Record path.
 * @param root0.nonce - This run's nonce.
 * @param root0.armed - Armed manifest path.
 * @param root0.parent - This run's extraction parent.
 * @param observed - Parsed rows of the same run.
 */
export const assertExtractedFinContainerGdbRun = async (observer, { record, nonce, armed, parent }, observed) => {
	const mapped = readFinContainerGdbRecord(await readFile(record)), { identity } = observer;
	assert.deepEqual([mapped.magic, mapped.version, mapped.columns, mapped.config, mapped.nonce, mapped.attached], [finContainerGdbRecord.magic, 1, width, observer.configSha256, nonce, 1]);
	assert.deepEqual([mapped.armed, mapped.conflicts, mapped.foreign, mapped.breakpoints], [finContainerGdbRecord.armed, 0, 0, Array(width).fill(1)]);
	assert.deepEqual(mapped.definers, observer.definerIndices);
	assert.deepEqual(mapped.entries, observed.at(-1)[2]);
	const manifest = JSON.parse(await readFile(armed, "utf8"));
	assert.deepEqual([manifest.configSha256, manifest.nonce, manifest.parent], [observer.configSha256, nonce, parent]);
	assert.ok(Number.isSafeInteger(manifest.pid) && manifest.pid > 0);
	assert.equal(mapped.pid, manifest.pid, "the record belongs to the instrumented inferior");
	// One extraction root directly below this run's parent, holding exactly the verified images.
	assert.equal(dirname(manifest.root), parent);
	assert.match(basename(manifest.root), finContainerExtractedRoot);
	assert.deepEqual(Object.keys(manifest.images).sort(), identity.libraries);
	for(const name of identity.libraries) assert.equal(manifest.images[name].sha256, identity.hashes[name], name);
	const breakpoints = manifest.breakpoints.map(({ symbol, library: owner, offset }) => ({ symbol, library: owner, offset }));
	assert.deepEqual(breakpoints.map(item => [item.symbol, item.library]), identity.columns.map((symbol, k) => [symbol, identity.definers[k]]));
	for(const { symbol, library: owner, offset } of breakpoints)
	{
		const line = observer.listings[owner].split("\n").find(entry => entry.trim().endsWith(` ${symbol}`));
		assert.equal(offset, Number.parseInt(line.trim().split(" ")[0], 16), symbol);
	}
	return { root: manifest.root, breakpoints: breakpoints.map(({ symbol, library: owner, offset }) => ({ symbol, library: owner, offset: `0x${offset.toString(16)}` })) };
};
