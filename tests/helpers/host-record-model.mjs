/** @file Guard the source and ownership boundaries of application-hosted record fields. */
import assert from "node:assert/strict";
import test from "node:test";
import {hostRecordTypes} from "../../src/analyze/host-records.mjs";
import {pythonHostRecords} from "../../src/backends/python/host-records.mjs";
import {dotnetHostRecords} from "../../src/backends/dotnet/host-records.mjs";
import {jvmHostRecords} from "../../src/backends/jvm/host-records.mjs";
import {cHostCodecs} from "../../src/backends/c/host-codecs.mjs";
import {cHostRecords} from "../../src/backends/c/host-records.mjs";
import {cppHostRecords} from "../../src/backends/cpp/host-records.mjs";
import {cppHostCodecs} from "../../src/backends/cpp/host-codecs.mjs";
import {rustHostFacade} from "../../src/backends/rust/host-facade.mjs";
import {perlHostRecords} from "../../src/backends/perl/host-records.mjs";
import {lowerWordHostRecord} from "../../src/backends/native/word-host-records.mjs";

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
	for(const change of [{hostModule: "LeanBridge.Host.Perl", perlTaskObjects: true}, {nativeEffectPolicy: null}, {taskExports: ["Workshop.read"]}])
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

test("Perl host records reserve error classes and public methods before generating XS", () => {
	const row = (name, keys) => {
		const declaration = "Workshop." + name;
		const fields = keys.map(key => ({name: key, projection: declaration + "." + key, type: {kind: "named", id: box.id}}));
		return {...record, declaration, constructor: declaration + ".mk", fields};
	};
	const emit = (...rows) => perlHostRecords(rows.map(site), [box], "LeanBridge::Gauge");
	for(const name of ["Failure", "IOError", "EIOError", "Runtime", "Returned"])
		assert.throws(() => emit(row(name, ["meter"])), /Colliding Perl host record class/u);
	for(const keys of [["close"], ["new"], ["can"], ["DESTROY"], ["firstBox", "first_box"]])
		assert.throws(() => emit(row("Pair", keys)), /Colliding Perl host record field/u);
	const pair = row("Pair", ["firstBox", "secondBox"]);
	assert.throws(() => emit(pair, {...pair, fields: [...pair.fields].reverse()}), /Inconsistent Perl host record fields/u);
	assert.throws(() => emit(pair, {...pair, declaration: "Other.Pair"}), /Colliding Perl host record class/u);
	const model = emit(pair, row("Rack", ["owner"]), pair);
	assert.equal(model.schemas.size, 2);
	assert.match(model.xs, /PACKAGE = LeanBridge::Gauge::Pair/u);
	assert.match(model.xs, /first_box\(self\)/u);
	const unsupported = row("Rack", ["bad"]); unsupported.fields[0].type.id = "other:Box";
	assert.throws(() => emit(unsupported), /unsupported member site/u);
});

test("Perl lowers only validated projections and caps the whole call, not each record", () => {
	const perl = {...selection, hostModule: "LeanBridge.Host.Perl"};
	assert.equal(hostRecordTypes([site(record)], perl, [box])[0].representation, "owned");
	const wide = {...record, fields: Array.from({length: 33}, (_, i) => ({...record.fields[0], name: "f" + i, projection: "Workshop.Rack.f" + i}))};
	const lower = (...args) => lowerWordHostRecord({...site(record), declaration: "Workshop.call", parameters: args.map(type => ({type}))}, "perl", () => "Box");
	assert.equal(lower(wide).flat.length, 33);
	assert.throws(() => lower(wide, wide), /64 flattened/u);
	assert.throws(() => lower({...record, fields: [{...record.fields[0], projection: "Other.Rack.primaryMeter"}]}), /invalid fields or projections/u);
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

test("JVM record properties keep their source identities without colliding with class tokens", () => {
	const emit = (name, names) => {
		const fields = names.map(field => ({name: field, type: {kind: "named", id: box.id}}));
		const type = {kind: "record", name, fields, source: {declaration: "Gauge." + name}};
		return jvmHostRecords({types: [type]}, "<T0>", () => "T0", () => {}, new Set(["Api"]));
	};
	for(const name of ["T0", "Api", "String", "Fields"]) assert.throws(() => emit(name, ["meter"]), /Invalid JVM record name/u);
	for(const names of [["class"], ["source_meter", "source_Meter"]]) assert.throws(() => emit("Pair", names), /Colliding JVM record getter/u);
	assert.equal(emit("Pair", ["source_meter"]).get("Gauge.Pair").fields[0].getter, "getSourceMeter");
});

test("C11 record helpers use nominal tickets and do not collide with existing public names", () => {
	const emit = (fields, initial = []) => {
		const defs = [], code = [], names = new Set(initial), p = "app_";
		const {byRef} = cHostCodecs({types: [box]}, [{name: "Box", key: "a".repeat(64)}], p, defs);
		const reserve = n => {
			if(names.has(n)) throw new TypeError("collision: " + n);
			names.add(n); return n;
		};
		const add = (label, ret, args, body) => { reserve(label); code.push(body); };
		const row = {...record, fields}, entries = [site(row)];
		return cHostRecords({entries, p, byRef, defs, code, reserve, add});
	};
	const owner = emit(record.fields).get("Workshop.Rack");
	assert.equal(owner.type, "app_rack"); assert.equal(owner.count, 1);
	assert.throws(() => emit(record.fields, ["rack_make"]), /collision/u);
	assert.throws(() => emit([...record.fields, {...record.fields[0], name: "primary_meter"}]), /collision/u);
	const wide = {...record, fields: Array.from({length: 33}, (_, i) => ({...record.fields[0], name: "f" + i, projection: "Workshop.Rack.f" + i}))};
	assert.throws(() => lowerWordHostRecord({...site(record), parameters: [{type: wide}, {type: wide}]}, "c", () => "Box"), /64 flattened/u);
});

test("C++ host records reserve public and private binding names before emitting types", () => {
	const {ref} = cppHostCodecs({ir: {types: [box]}, model: {kinds: [box]}, p: "app_"});
	const emit = (names, used = []) => cppHostRecords([site({...record, fields: names.map(name => ({...record.fields[0], name}))})], "app_", ref, new Set(used));
	for(const name of ["Rack", "lb_make_record_0", "lb_read_record_0"])
		assert.throws(() => emit(["lead"], [name]), /Colliding C\+\+ host record name/u);
	for(const fields of [["lead", "lead"], ["lb_field_0"], ["switch", "switch_"]])
		assert.throws(() => emit(fields), /Colliding C\+\+ host record field/u);
	assert.equal(emit(["primaryMeter"]).types.get("Workshop.Rack").type, "Rack");
});

test("Cargo host records reserve runtime and getter names and bound aggregate arity", () => {
	const id = "b".repeat(64);
	const emit = (name, fields) => {
		const row = {...record, declaration: "Gauge." + name, fields: fields.map(key => ({name: key, type: {kind: "named", id: box.id}}))};
		return rustHostFacade({
			ir: {types: [box]}, model: {kinds: [{...box, key: id}], members: []}
			, entries: [{...site(row), name: "pair", declaration: "Gauge.pair", parameters: [{type: row}]}]
			, domainId: id, prefix: "lb_rust_host_" + id
		});
	};
	for(const name of ["HostRef", "H", "BigUint", "Binding", "Clone", "Drop", "u64"])
		assert.throws(() => emit(name, ["lead"]), /Reserved Rust host record/u);
	for(const fields of [["new"], ["clone"], ["lb_field_0"], ["sourceMeter", "source_meter"]])
		assert.throws(() => emit("Pair", fields), /Colliding Rust host record getter/u);
	const wide = {...record, fields: Array.from({length: 33}, (_, i) => ({...record.fields[0], name: "f" + i, projection: "Workshop.Rack.f" + i}))};
	assert.throws(() => lowerWordHostRecord({...site(record), parameters: [{type: wide}, {type: wide}]}, "rust", () => "Box"), /64 flattened/u);
});
