/**
 * Keep the audit configuration, nm-derived definers, generated module and record reader exact.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { nativeFinDispatchSymbols } from "./native-fin-dispatch.mjs";
import { nativeFinAuditConfig, nativeFinAuditConfigSha256, nativeFinAuditDefiners, nativeFinAuditRecord, nativeFinAuditSource, readNativeFinAuditRecord } from "./native-fin-dispatch-audit.mjs";

const componentId = "native-fin@1.0.0", columns = nativeFinDispatchSymbols(componentId);
const libraries = ["libnative_fin.so", "libcomponent_x.so", "libleanshared.so"];
const definers = Object.fromEntries(columns.map(symbol => [symbol, "libcomponent_x.so"]));

test("the audit configuration names one verified defining library per counted column", () => {
	const config = nativeFinAuditConfig({ componentId, libraries, definers });
	assert.deepEqual(config.libraries, ["libcomponent_x.so", "libleanshared.so", "libnative_fin.so"]);
	assert.deepEqual([config.columns, config.definers, config.platform], [columns, Array(6).fill("libcomponent_x.so"), "x86_64-linux-gnu"]);
	assert.match(nativeFinAuditConfigSha256(config), /^[a-f0-9]{64}$/u);
	const other = Object.fromEntries(nativeFinDispatchSymbols("nativefin@1.0.0").map(symbol => [symbol, "libcomponent_x.so"]));
	assert.notEqual(nativeFinAuditConfigSha256(config), nativeFinAuditConfigSha256(nativeFinAuditConfig({ componentId: "nativefin@1.0.0", libraries, definers: other })));
	for(const [label, change] of [
		["missing column", { definers: { ...definers, [columns[5]]: undefined } }]
		, ["outside library", { definers: { ...definers, [columns[0]]: "libother.so" } }]
		, ["extra column", { definers: { ...definers, lb_extra: "libcomponent_x.so" } }]
		, ["path name", { libraries: [...libraries, "../libnative_fin.so"] }]
		, ["duplicate library", { libraries: [...libraries, "libleanshared.so"] }]
	])
		assert.throws(() => nativeFinAuditConfig({ componentId, libraries, definers: Object.fromEntries(Object.entries(change.definers ?? definers).filter(([, value]) => value)), ...change.libraries ? { libraries: change.libraries } : {} }), TypeError, label);
});

test("nm listings decide each column's single defining library", () => {
	const listing = names => names.map((name, index) => `${(index + 1).toString(16).padStart(16, "0")} T ${name}`).join("\n") + "\n";
	const listings = { "libcomponent_x.so": listing(columns), "libnative_fin.so": listing(["native_fin_mirror"]) };
	assert.deepEqual(nativeFinAuditDefiners(componentId, listings), definers);
	assert.throws(() => nativeFinAuditDefiners(componentId, { ...listings, "libnative_fin.so": listing([columns[4]]) }), /exactly one verified library, not 2/u);
	assert.throws(() => nativeFinAuditDefiners(componentId, { "libcomponent_x.so": listing(columns.slice(1)) }), /exactly one verified library, not 0/u);
	assert.throws(() => nativeFinAuditDefiners(componentId, { "libcomponent_x.so": listing(columns).replace(" T l_NativeFin_mirror", " U l_NativeFin_mirror") }), /not 0/u);
});

test("the audit module counts through the mapped record with signature-preserving trampolines", () => {
	const config = nativeFinAuditConfig({ componentId, libraries, definers }), source = nativeFinAuditSource(config);
	for(let k = 0; k < 6; k++)
	{
		assert.equal(source.split(`"  lock incq ${8 * k}(%r11)\\n"`).length, 2, `column ${k}`);
		assert.equal(source.split(`"  jmp *lb_fin_audit_targets+${8 * k}(%rip)\\n"`).length, 2, `column ${k}`);
	}
	assert.equal(source.split('"  movq lb_fin_audit_entries(%rip), %r11\\n"').length, 7);
	// The trampolines touch only %r11, the record pointer and the captured targets.
	const asm = source.slice(source.indexOf("__asm__("), source.indexOf(");", source.indexOf("__asm__(")));
	assert.equal(asm.match(/%[a-z0-9]+/gu).filter(register => register !== "%r11" && register !== "%rip").length, 0);
	assert.doesNotMatch(asm, /\b(?:push|pop|call|ret|sub|add|mov[^q])/u);
	assert.match(source, /O_RDWR \| O_CREAT \| O_EXCL \| O_NOFOLLOW/u);
	assert.match(source, /#error "The Fin dispatch audit supports only x86_64 Linux with glibc"/u);
	assert.match(source, /static const char config_sha256\[\] = "[a-f0-9]{64}";/u);
	assert.ok(source.includes(`static const char config_sha256[] = "${nativeFinAuditConfigSha256(config)}";`));
	assert.doesNotMatch(source, /dlsym|RTLD_NEXT/u);
});

test("the audit record reader requires the exact layout", () => {
	const bytes = Buffer.alloc(nativeFinAuditRecord.size);
	bytes.write("LBFINAUD", 0, "latin1"); bytes.writeUInt32LE(1, 8); bytes.writeUInt32LE(6, 12); bytes.write("c".repeat(64), 16, "latin1"); bytes.write("0123456789abcdef".repeat(2), 80, "latin1");
	bytes.writeBigInt64LE(42n, 112); bytes.writeUInt32LE(1, 120); bytes.writeUInt32LE(0x3f, 124);
	for(let k = 0; k < 6; k++)
	{
		bytes.writeBigUInt64LE(BigInt(k + 1), 136 + 8 * k); bytes.writeInt32LE(k, 184 + 4 * k);
		bytes.writeUInt32LE(1 << k, 208 + 4 * k); bytes.writeBigUInt64LE(BigInt(10 + k), 232 + 8 * k);
	}
	const record = readNativeFinAuditRecord(bytes);
	assert.deepEqual([record.magic, record.version, record.columns, record.pid, record.attached, record.redirected], ["LBFINAUD", 1, 6, 42, 1, 0x3f]);
	assert.deepEqual([record.bindings, record.definers, record.callers, record.entries], [[1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5], [1, 2, 4, 8, 16, 32], [10, 11, 12, 13, 14, 15]]);
	assert.throws(() => readNativeFinAuditRecord(bytes.subarray(1)), TypeError);
	assert.throws(() => readNativeFinAuditRecord(Buffer.concat([bytes, Buffer.alloc(1)])), TypeError);
});
