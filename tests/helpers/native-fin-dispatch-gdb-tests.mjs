/**
 * Keep the GDB entry-counter identity, nm-derived definers, script guarantees and record reader exact.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { nativeFinDispatchSymbols } from "./native-fin-dispatch.mjs";
import { nativeFinDefiners, nativeFinGdbExit, nativeFinGdbIdentity, nativeFinGdbRecord, nativeFinGdbScript, readNativeFinGdbRecord } from "./native-fin-dispatch-gdb.mjs";

const componentId = "native-fin@1.0.0", columns = nativeFinDispatchSymbols(componentId);
const libraries = ["libnative_fin.so", "libcomponent_x.so", "libleanshared.so"];
const definers = Object.fromEntries(columns.map(symbol => [symbol, "libcomponent_x.so"]));

test("the GDB identity names one verified defining library per counted column", () => {
	const { identity, configSha256, definerIndices } = nativeFinGdbIdentity({ componentId, libraries, definers });
	assert.deepEqual(identity.libraries, ["libcomponent_x.so", "libleanshared.so", "libnative_fin.so"]);
	assert.deepEqual([identity.columns, identity.definers, identity.instrument], [columns, Array(6).fill("libcomponent_x.so"), "gdb-breakpoints"]);
	assert.deepEqual(definerIndices, [0, 0, 0, 0, 0, 0]);
	assert.match(configSha256, /^[a-f0-9]{64}$/u);
	const other = Object.fromEntries(nativeFinDispatchSymbols("nativefin@1.0.0").map(symbol => [symbol, "libcomponent_x.so"]));
	assert.notEqual(configSha256, nativeFinGdbIdentity({ componentId: "nativefin@1.0.0", libraries, definers: other }).configSha256);
	for(const [label, change] of [
		["missing column", { definers: Object.fromEntries(Object.entries(definers).slice(1)) }]
		, ["outside library", { definers: { ...definers, [columns[0]]: "libother.so" } }]
		, ["extra column", { definers: { ...definers, lb_extra: "libcomponent_x.so" } }]
		, ["path name", { libraries: [...libraries, "../libnative_fin.so"] }]
		, ["duplicate library", { libraries: [...libraries, "libleanshared.so"] }]
	])
		assert.throws(() => nativeFinGdbIdentity({ componentId, libraries, definers, ...change }), TypeError, label);
});

test("nm listings decide each column's single defining library", () => {
	const listing = names => names.map((name, index) => `${(index + 1).toString(16).padStart(16, "0")} T ${name}`).join("\n") + "\n";
	const listings = { "libcomponent_x.so": listing(columns), "libnative_fin.so": listing(["native_fin_mirror"]) };
	assert.deepEqual(nativeFinDefiners(componentId, listings), definers);
	assert.throws(() => nativeFinDefiners(componentId, { ...listings, "libnative_fin.so": listing([columns[4]]) }), /exactly one verified library, not 2/u);
	assert.throws(() => nativeFinDefiners(componentId, { "libcomponent_x.so": listing(columns.slice(1)) }), /not 0/u);
	assert.throws(() => nativeFinDefiners(componentId, { "libcomponent_x.so": listing(columns).replace(" T l_NativeFin_mirror", " U l_NativeFin_mirror") }), /not 0/u);
});

test("the GDB script records before the inferior runs and arms only exact verified definitions", () => {
	const script = nativeFinGdbScript, order = (...needles) => needles.map(needle => script.indexOf(needle));
	// The record is created exclusively after starti stops at the first instruction and before continue.
	const [starti, record, resume] = order("gdb.execute(\"starti \"", "os.O_RDWR | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW", "gdb.execute(\"continue\")");
	assert.ok(starti > 0 && starti < record && record < resume);
	for(const needle of [
		"if len(found) != 1:"
		, "os.path.realpath(solib) != expected"
		, "breakpoint.pending or len(locations) != 1 or locations[0].address != found[0] or not locations[0].enabled"
		, "\"offset\": found[0] - base(expected)"
		, "if definitions(name) != [address]:"
		, "return False"
		, "return True"
		, "if os.pwrite(state[\"fd\"], record, 0) != len(record):"
		, "if state[\"failure\"] is not None:\n    stop(71, state[\"failure\"])"
		, "json.dump({\"pid\": state[\"pid\"], \"configSha256\": config[\"configSha256\"], \"nonce\": config[\"nonce\"], \"breakpoints\": armed}, out)"
		, "handle all nostop noprint pass"
	])
		assert.equal(script.split(needle).length, 2, needle);
	assert.equal(script.split(`stop(${nativeFinGdbExit.refusedRecord}, `).length, 2);
	// Start or continue errors and any sticky callback failure end with the instrumentation status.
	assert.equal(script.split(`stop(${nativeFinGdbExit.instrumentation}, `).length, 4);
	assert.equal(script.split(`stop(${nativeFinGdbExit.signal}, `).length, 2);
	// Both callbacks catch every error and turn it into a sticky, fatal failure.
	assert.equal(script.split("except Exception as error:\n").length, 3);
	assert.match(script, /struct\.pack\("<8sII64s32sqIIII6Q6i6I6Q", b"LBFINGDB", 1, 6,/u);
	assert.doesNotMatch(script, /LD_PRELOAD|LD_AUDIT|dlsym/u);
});

test("the GDB record reader requires the exact layout", () => {
	const bytes = Buffer.alloc(nativeFinGdbRecord.size);
	bytes.write("LBFINGDB", 0, "latin1"); bytes.writeUInt32LE(1, 8); bytes.writeUInt32LE(6, 12);
	bytes.write("c".repeat(64), 16, "latin1"); bytes.write("0123456789abcdef".repeat(2), 80, "latin1");
	bytes.writeBigInt64LE(42n, 112); bytes.writeUInt32LE(1, 120); bytes.writeUInt32LE(0x3f, 124);
	for(let k = 0; k < 6; k++)
	{
		bytes.writeBigUInt64LE(1n, 136 + 8 * k); bytes.writeInt32LE(k, 184 + 4 * k);
		bytes.writeBigUInt64LE(BigInt(10 + k), 232 + 8 * k);
	}
	const record = readNativeFinGdbRecord(bytes);
	assert.deepEqual([record.magic, record.version, record.columns, record.pid, record.attached, record.armed], ["LBFINGDB", 1, 6, 42, 1, 0x3f]);
	assert.deepEqual([record.breakpoints, record.definers, record.entries], [[1, 1, 1, 1, 1, 1], [0, 1, 2, 3, 4, 5], [10, 11, 12, 13, 14, 15]]);
	assert.throws(() => readNativeFinGdbRecord(bytes.subarray(1)), TypeError);
	assert.throws(() => readNativeFinGdbRecord(Buffer.concat([bytes, Buffer.alloc(1)])), TypeError);
});
