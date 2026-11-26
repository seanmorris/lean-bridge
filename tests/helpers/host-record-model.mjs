/** @file Guard the source and ownership boundaries of application-hosted record fields. */
import assert from "node:assert/strict";
import test from "node:test";
import {hostRecordTypes} from "../../src/analyze/host-records.mjs";
import {pythonHostRecords} from "../../src/backends/python/host-records.mjs";
import {dotnetHostRecords} from "../../src/backends/dotnet/host-records.mjs";

const box = {id: "host:meter.Box", name: "Box"};
const selection = {hostModule: "LeanBridge.Host.Python", exportModules: ["Workshop"], nativeEffectPolicy: "native-host-io-v1"};
const record = {
	kind: "host-record", module: "Workshop"
	, declaration: "Workshop.Rack", constructor: "Workshop.Rack.mk"
	, fields: [{name: "primaryMeter", projection: "Workshop.Rack.primaryMeter", type: {kind: "named", id: box.id}}]
};
const site = t => ({module: "Workshop", effect: "IO", parameters: [], result: t});

test("public host records use the compiler's projections and declared host identities", () => {
	const [definition] = hostRecordTypes([site(record), site(record)], selection, [box]);
	assert.equal(definition.representation, "owned");
	assert.equal(definition.fields[0].name, "primary_meter");
	assert.deepEqual(definition.fields[0].type, {kind: "named", id: box.id});
	assert.equal(definition.aggregate.disposal, "required");
	for(const change of [
		{module: "Undeclared"}, {constructor: "Other.mk"}, {declaration: undefined}
		, {fields: [{...record.fields[0], projection: "Other.primaryMeter"}]}
		, {fields: [{...record.fields[0], type: {kind: "named", id: "lean:Meter.Box"}}]}
		, {fields: [{...record.fields[0], type: {kind: "primitive", name: "uint32"}}]}
		, {fields: [record.fields[0], {...record.fields[0], name: "primary_meter", projection: "Workshop.Rack.primary_meter"}]}
	])
		assert.throws(() => hostRecordTypes([site({...record, ...change})], selection, [box]), /Invalid application host record/u);
	assert.throws(() => hostRecordTypes([site(record), site({...record, constructor: "Workshop.Rack.other"})], selection, [box]), /inconsistent definitions/u);
	assert.throws(() => hostRecordTypes([site(record)], selection, [{...box, name: "Rack"}]), /ambiguous public name/u);
});

test("a synchronous object-field admission cannot enable async or a different host", () => {
	for(const change of [{hostModule: "LeanBridge.Host.Jvm"}, {nativeEffectPolicy: null}, {taskExports: ["Workshop.read"]}])
		assert.throws(() => hostRecordTypes([site(record)], {...selection, ...change}, [box]), /not a synchronous host-bound export/u);
	for(const change of [{module: "Other"}, {effect: "EIO"}, {delivery: "iterator"}])
		assert.throws(() => hostRecordTypes([{...site(record), ...change}], selection, [box]), /not a synchronous host-bound export/u);
});

test("native PHP records require the native owner and cannot enter Zend or scheduled exports", () => {
	const php = {...selection, hostModule: "LeanBridge.Host.Php", phpNativeFunctions: true};
	assert.equal(hostRecordTypes([site(record)], php, [box])[0].fields[0].type.id, box.id);
	for(const change of [
		{phpNativeFunctions: undefined}, {phpNativeFunctions: false}
		, {phpWasmSyncObjects: true}, {phpWasmTaskObjects: true}
		, {asyncIterators: ["Station.open"]}
	])
		assert.throws(() => hostRecordTypes([site(record)], {...php, ...change}, [box]), /not a synchronous host-bound export/u);
});

test("record properties and class names cannot shadow generated Python conversions", () => {
	const fields = ["property", "int", "count"].map((name, i) => ({
		name
		, projection: "Workshop.Rack." + name
		, type: i ? {kind: "primitive", name: "uint32"} : {kind: "named", id: box.id}
	}));
	const type = {...record, fields};
	const entry = {...site(type), declaration: "Workshop.roundTrip", parameters: [{name: "Rack", type}]};
	const codec = t => ({lean: "Unit", hostIndex: t.kind === "named" ? 0 : undefined, toPython: s => s});
	const emit = pythonHostRecords([entry], codec, t => t.kind === "named" ? "Box" : "int", new Set());
	assert.match(emit.python, /@_lb_record_property/u);
	assert.match(emit.lower(entry).pythonArgs, /_lb_host_fields\(Rack, _lb_host_record_0\)/u);
	assert.match(emit.stubs[0], /from builtins import int as _lb_record_int/u);
	assert.match(emit.stubs[0], /@_lb_record_property\n +def count\(self\) -> _lb_record_int/u);
});

test("CLR record names and properties cannot shadow their generated types or disposal API", () => {
	const emit = (name, field) => {
		const member = {name: field, type: {kind: "named", id: box.id}};
		const type = {kind: "record", name, fields: [member], source: {declaration: "Gauge." + name}};
		return dotnetHostRecords({types: [type]}, "<T0>", "where T0:class", () => "T0");
	};
	for(const name of ["Bound", "System", "T0"])
		assert.throws(() => emit(name, "lead"), /Invalid CLR record name/u);
	for(const field of ["from_native_fields", "dispose", "fields", "get_type", "pair", "t0"])
		assert.throws(() => emit("Pair", field), /Colliding CLR record property/u);
	assert.ok(emit("Pair", "held").entries.has("Gauge.Pair"));
});
