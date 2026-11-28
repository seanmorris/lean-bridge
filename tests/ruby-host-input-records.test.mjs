/** @file Exercise Ruby's address-only callback ABI at borrowed record fields. */
import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {generateOwnedRubyPackage} from "../src/backends/ruby/owned-package.mjs";
import {ownedRubyRuntime} from "../src/backends/ruby/owned-runtime.mjs";
import {runCopied} from "./helpers/copied-fixture-install.mjs";
import {saveLakeFile} from "./helpers/lake-workspace.mjs";
import {leasedClosureFieldReviewedIr} from "./helpers/owned-aggregate-fixture.mjs";

// Standalone driver for the Fiddle boundary. Installed gems instead compile
// the same boundary into the C adapter's existing translation unit.
const wrapper = api => `#include "ruby-abi.h"
static int ov_pointer(void const *p, size_t size, size_t align) {
  return p && (uintptr_t)p % align == 0 && size <= UINTPTR_MAX - (uintptr_t)p;
}
${api.cSource}`;
const scratch = async t => {
	const dir=await mkdtemp(join(tmpdir(),"ruby-input-records-"));
	t.after(()=>rm(dir,{recursive: true,force: true}));
	return dir;
};

test("Ruby verifies mixed borrowed record layouts with the C compiler",async t=>{
	const ir=leasedClosureFieldReviewedIr({exchange: true});
	const record=ir.types.find(n=>n.name==="Tariff"), apply=ir.declarations.find(d=>d.name==="applyTariff");
	record.fields.push({...record.fields[0],name: "base",type: {kind: "primitive",name: "uint32"}}
		,{...record.fields[0],name: "label",type: {kind: "primitive",name: "string"}}
		,{...record.fields[0],name: "rebate"});
	ir.aggregatePolicy.closureFields.push("Owned.Tariff.rebate");
	apply.parameters[1]={...apply.parameters[0],name: "other"};
	const api=generateOwnedRubyPackage(ir), view=api.types.find(n=>n.id===record.id).hostInput;
	assert.deepEqual(api.contract.hostInputRecords,[{type: record.id,input: "TariffInput",fields: ["quote","rebate"],lifetime: "call"}]);
	// The String's data pointer and length are inline; the next descriptor
	// must begin after both words, not at the length slot.
	assert.deepEqual(view.fields.map(f=>f.offset),[0,32,40,56]);
	assert.equal(view.size,88);
	assert.deepEqual(api.functions.find(f=>f.publicName==="apply_tariff_with_host_fields").hostRecordSlots.map(s=>s.index),[0,1]);
	assert.equal(generateOwnedRubyPackage(ir,null,{hostCallbacks: false}).contract.hostInputRecords,undefined);
	const dir=await scratch(t);
	await saveLakeFile(dir,"ruby-abi.h",api.abiHeader);
	await saveLakeFile(dir,api.c.prefix+".h",api.c.header);
	await saveLakeFile(dir,"ruby.c",wrapper(api));
	await runCopied("/usr/bin/cc",["-std=c11","-Wall","-Wextra","-Werror","-fsyntax-only","ruby.c"],dir,{PATH: "/usr/bin:/bin"});
});

const archive=process.env.LEAN_BRIDGE_RUBY_INPUT_C_PREFIX;
test("Ruby passes call-scoped field functions to the compiled Lean/C tariff archive",{skip: !archive},async t=>{
	const root=resolve(archive), lib=join(root,"lib"), dir=await scratch(t);
	const api=generateOwnedRubyPackage(JSON.parse(await readFile(join(root,"share/lean-bridge/component/binding-ir.json"))));
	await saveLakeFile(dir,"ruby-abi.h",api.abiHeader);
	await saveLakeFile(dir,"ruby.c",wrapper(api));
	const flags=["-std=c11","-Wall","-Wextra","-Werror","-fPIC","-shared"
		, "-I"+join(root,"include"),"ruby.c","-L"+lib,"-ltariff_quotes"
		, "-Wl,-z,defs","-Wl,-rpath,"+lib,"-o","ruby.so"];
	await runCopied("/usr/bin/cc",flags,dir,{PATH: "/usr/bin:/bin"});
	await saveLakeFile(dir,"run.rb",`module LeanBridge; module TariffQuotes
${ownedRubyRuntime(api.c.prefix)}
end; end
${api.valuesSource}
${api.source}
module LeanBridge; module TariffQuotes
  Native.bind(Owned::Runtime.new(Fiddle.dlopen(File.expand_path("ruby.so"))))
end; end
require "json"
require ARGV.fetch(0)
a = LeanBridge::TariffQuotes
broker = Fiddle.dlopen(ARGV.fetch(1))
snap = Fiddle::Function.new(broker["lean_bridge_native_snapshot_read"], [Fiddle::TYPE_VOIDP], Fiddle::TYPE_VOID)
live = -> { Fiddle::Pointer.malloc(40, Fiddle::RUBY_FREE) { |p| snap.call(p); p[20,4].unpack1("L<") } }
a.make_tariff(0).quote.close
baseline = live.call
control = a.make_tariff(1)
held = live.call
control.quote.close
puts JSON.generate([baseline, held, verify_tariff_inputs(a, live)])
`);
	const ruby=resolve(process.env.LEAN_BRIDGE_RUBY??".toolchains/ruby33/bin/ruby");
	const client=resolve("tests/fixtures/structured-types/tariff-host-fields.rb");
	const args=["--disable-gems","run.rb",client,join(lib,"liblean_bridge_native.so")];
	const result=await runCopied(ruby,args,dir,{PATH: "/unavailable",LEAN_NUM_THREADS: "1"});
	const [base,control,counts]=JSON.parse(result.stdout);
	assert.ok(control>base);
	assert.deepEqual(counts,Object.fromEntries(["direct","reentrant","expired","recovered","validation","leased"].map(k=>[k,base])));
	t.diagnostic(JSON.stringify({base,control,counts}));
});
