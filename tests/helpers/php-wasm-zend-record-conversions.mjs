/** @file Validate standalone PHP-Wasm record staging independently of the installed Zend checks. */
import assert from "node:assert/strict";
import test from "node:test";
import {phpWasmObjectDomain} from "../../src/backends/php/php-wasm-task-objects.mjs";
import {phpZendRecords} from "../../src/backends/php/php-wasm-zend-records.mjs";
import {wasmHostRecordTypes} from "../../src/runtime/wasm-host-records.mjs";

const kind = "host:" + "c".repeat(64), type = "record:lean:Meter.Pair";
const fields = [{name: "lead", type: kind}, {name: "sample", type: "bytes"}];
const layout = {name: "Pair", type, fields};
const types = wasmHostRecordTypes([{...layout, fields: [{...fields[0], type: 0}, fields[1]]}]);
const ctor = types.get(type).ctor, compiled = {recordClass: () => ctor};

test("Zend record inputs group all flattened leaves and release temporary records after a member throws", () => {
	const objects = phpWasmObjectDomain([kind]), cap = objects.mint(kind), mirror = objects.borrow(kind, cap);
	const records = phpZendRecords([layout], compiled, objects), error = new Error("member failed"), rows = [];
	const op = records.flatten({args: [type, "bool", type]}, (a, flag, b) => {
		assert.equal(flag, true); assert.equal(a.lead, mirror); assert.equal(b.lead, mirror);
		assert.deepEqual(a.sample, Uint8Array.of(1, 2)); assert.deepEqual(b.sample, Uint8Array.of(3));
		rows.push(a, b); throw error;
	});
	assert.deepEqual(op.method.args, [kind, "bytes", "bool", kind, "bytes"]);
	assert.throws(() => op.invoke(mirror, Uint8Array.of(1, 2), true, mirror, Uint8Array.of(3)), value => value === error);
	assert.equal(rows.length, 2);
	for(const r of rows) assert.throws(() => r.lead, /Closed or wrong/u);
	assert.throws(() => op.invoke(mirror), /Invalid Zend record arguments/u);
});

test("Zend packets never publish foreign object identities or deliver a field twice", () => {
	const prototypes = new Map(), owner = phpWasmObjectDomain([kind], prototypes), other = phpWasmObjectDomain([kind], prototypes);
	const cap = owner.mint(kind), mirror = owner.borrow(kind, cap), records = phpZendRecords([layout], compiled, owner);
	const bytes = Uint8Array.of(9, 0, 255), row = new ctor(mirror, bytes); bytes.fill(42);
	const packet = records.packet("value", type, row);
	assert.throws(() => row.lead, /Closed or wrong/u);
	assert.equal(packet.form(), "value"); assert.equal(packet.field(0, "bytes"), null);
	assert.equal(packet.field(0, kind), cap.key()); assert.equal(packet.field(0, kind), null);
	assert.equal(packet.field(1, "bytes"), "CQD/"); packet.discard(); assert.equal(packet.field(1, "bytes"), null);
	const foreign = new ctor(other.borrow(kind, other.mint(kind)), bytes);
	assert.throws(() => records.packet("value", type, foreign), /Unrecognized Zend object/u);
	assert.throws(() => foreign.lead, /Closed or wrong/u);
});
