/** @file A separately authored Lean cursor with a deterministic pending pull. */
import assert from "node:assert/strict";
import {copyFile,mkdir,readFile,rename,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {canonicalJson} from "../../src/capsule/node.mjs";
import {witCoreInterface} from "../../src/backends/wit/application-operations.mjs";
import {prepareNativeHostFixture} from "./native-host-import-check.mjs";
import {extendWitMembers} from "./wit-application-project.mjs";

/**
 * Give Gauge the same nominal host contract, but distinct Lean code, package
 * coordinate, operation inventory, notification descriptors and binding scope.
 *
 * @param project - Fresh Gauge author project.
 */
export const prepareGaugeWorker=async project=>{
	await prepareNativeHostFixture(project,"wit-wasi");await extendWitMembers(project);
	await copyFile("LICENSE",join(project,"LICENSE"));
	await rename(join(project,"Workshop.lean"),join(project,"Gauge.lean"));
	await copyFile("tests/fixtures/static-host-workers/GaugeWorker.lean",join(project,"Gauge.lean"));
	const lake=join(project,"lakefile.toml"),select=join(project,"lean-bridge.exports.json");
	await writeFile(lake,(await readFile(lake,"utf8")).replaceAll('"workshop"','"gauge"').replaceAll('"Workshop"','"Gauge"'));
	const c=JSON.parse(await readFile(select,"utf8"));
	c.modules=["Gauge"];c.exports=["Gauge.finite","Gauge.release","Gauge.counts","Gauge.read"];
	c.asyncIterators=[{open: "Gauge.finite",next: "Gauge.next",close: "Gauge.finish"}];
	c.targets["wit-wasi"].name="gauge";c.targets["wit-wasi"].asyncAbi="canonical";
	await writeFile(select,canonicalJson(c));
};

/**
 * Extend an independently compiled public Workshop application with Gauge's
 * public stream and counters. Never import, poll or resolve a native ticket.
 *
 * @param dir - Independent consumer working directory containing app.wat.
 * @param run - Invoke wasm-tools in the consumer directory.
 */
export const buildAsyncPeerApplication=async(dir,run)=>{
	let src=await readFile(join(dir,"app.wat"),"utf8");
	const before=(needle,extra)=>{
		assert.equal(src.split(needle).length,2,needle);
		src=src.replace(needle,()=>extra+"\n  "+needle);
	};
	before("  (core module $mem",`(import "lean-bridge:gauge/object-tasks@1.0.0" (instance $gauge
      (export "box" (type $bi (eq $b))) (type $finite (stream (own $bi)))
      (export "finite" (func (param "box" (borrow $bi)) (result $finite)))))
    (import "lean-bridge:gauge/api@1.0.0" (instance $gapi
      (export "counts" (func (result u64))) (export "release" (func (result u32)))))
    (type $finite (stream (own $b)))`);
	before("  (core module $code",`(core func $open-g (canon lower (func $gauge "finite")))
    (core func $counts (canon lower (func $gapi "counts"))) (core func $release (canon lower (func $gapi "release")))
    (core func $read-g (canon stream.read $finite async (memory $m "m")))
    (core func $cancel-g (canon stream.cancel-read $finite)) (core func $drop-g (canon stream.drop-readable $finite))`);
	before('    (import "" "make"',`(import "" "open-g" (func $open-g (param i32) (result i32)))
    (import "" "read-g" (func $read-g (param i32 i32 i32) (result i32)))
    (import "" "cancel-g" (func $cancel-g (param i32) (result i32)))
    (import "" "drop-g" (func $drop-g (param i32))) (import "" "counts" (func $counts (result i64)))
    (import "" "release" (func $release (result i32)))`);
	before("    (global $phase","(global $peer (mut i32) (i32.const 0))");
	before("      (global.set $r (call $series",`(global.set $peer (call $open-g (global.get $orig)))
      (call $eq (call $read-g (global.get $peer) (i32.const 80) (i32.const 1)) (i32.const -1))`);
	before("        (call $join (global.get $r)",`(call $eq (i64.eq (call $counts) (i64.const 4294967296)) (i32.const 1))
        (call $eq (call $cancel-g (global.get $peer)) (i32.const 2))
        (call $drop-g (global.get $peer)) (drop (call $release))`);
	before("      (call $dt (global.get $r))",`(call $eq (i64.eq (call $counts) (i64.const 4294967297)) (i32.const 1))`);
	before('    (export "make" (func $make))',["open-g","read-g","cancel-g","drop-g","counts","release"].map(n=>`(export "${n}" (func $${n}))`).join(" "));
	await writeFile(join(dir,"peers.wat"),src);
	await run("parse","peers.wat","-o","peers.wasm");
	await run("validate","--features","cm-async,cm-async-builtins","peers.wasm");
};

/**
 * Check the application and build its callback provider against both release
 * interfaces. During Workshop's retained callback, Gauge must see the same
 * object before and after Workshop mutates it. No package exports private
 * scheduler ports to the provider.
 *
 * @param dir - Directory containing the downstream Wasm application.
 * @param gauge - Installed Gauge WIT directory.
 * @param run - Pinned wasm-tools command in the consumer directory.
 */
export const checkAsyncPeerWorld=async(dir,gauge,run)=>{
	const world=join(dir,"combined-world"),deps=join(world,"deps");
	for(const name of ["workshop","gauge"])await mkdir(join(deps,name),{recursive: true});
	const workshop=join(dir,"app-wit");
	await copyFile(join(workshop,"deps/objects.wit"),join(deps,"objects.wit"));
	for(const file of ["api.wit","callbacks.wit","object-tasks.wit","application.wit"])await copyFile(join(workshop,file),join(deps,"workshop",file));
	for(const file of ["api.wit","object-tasks.wit"])await copyFile(join(gauge,file),join(deps,"gauge",file));
	await copyFile("tests/fixtures/static-host-workers/async-peer-world.wit",join(world,"world.wit"));
	await run("component","targets",world,"--world","instruments","peers.wasm");
	const provider=await readFile(join(dir,"provider.wat"),"utf8"),method='(call $update (local.get $box) (i32.const 73) (i32.const 16))';
	const check=value=>`(call $gauge-read (local.get $box) (i32.const 64))
        (if (i32.or (i32.load8_u (i32.const 64)) (i32.ne (i32.load (i32.const 68)) (i32.const ${value}))) (then unreachable))`;
	const failing='(call $create (i32.const -2) (i32.const 16))';
	for(const marker of [";; @test-callback-import@",method,failing])assert.equal(provider.split(marker).length,2,marker);
	const api=witCoreInterface("lean-bridge:gauge/api@1.0.0");
	await writeFile(join(dir,"peer-provider.wat"),provider
		.replace(";; @test-callback-import@",()=>`(import "cm32p2|${api}" "read" (func $gauge-read (param i32 i32)))`)
		.replace(failing,()=>`(call $gauge-read (local.get $box) (i32.const 64))
        (if (i32.or (i32.ne (i32.load8_u (i32.const 64)) (i32.const 1)) (i32.load8_u (i32.const 68))) (then unreachable))
        (i32.store8 (i32.const 16) (i32.const 1)) (i32.store (i32.const 20) (i32.load (i32.const 72)))`)
		.replace(method,()=>[check(42),method,check(73)].join("\n        ")));
	await run("component","embed",world,"--world","registrations","peer-provider.wat","-o","peer-provider.core");
	await run("component","new","peer-provider.core","-o","peer-provider.wasm");
	await run("component","targets",world,"--world","registrations","peer-provider.wasm");
};

/**
 * Count creation and destruction of the actual nested Gauge error in its
 * defining Wasm guest. The client can observe those counters through a
 * diagnostic box, using only the public get-level method.
 *
 * @param dir - Directory containing the independent owner and public worlds.
 * @param run - Pinned wasm-tools command in the consumer directory.
 */
export const buildAsyncPeerFailure=async(dir,run)=>{
	const wit=join(dir,"app-wit/deps/objects.wit"),contract=await readFile(wit,"utf8");
	const [,name]=/^package ([^;]+)@1\.0\.0;/u.exec(contract),objects=name+"/objects@1.0.0";
	const owner=await readFile(join(dir,"owner.wat"),"utf8");
	const sentinel="(call $error (i32.const 8))",destructor=`(export "cm32p2|${witCoreInterface(objects)}|member-error_dtor" (func $destroy))`;
	for(const target of [sentinel,destructor,";; @installed-drop-observer@","(global $armed"])assert.equal(owner.split(target).length,2,target);
	await writeFile(join(dir,"count-errors.wat"),owner
		.replace(sentinel,"(call $issue)")
		.replace("(global $armed",()=>`(global $issued (mut i32) (i32.const 0)) (global $freed (mut i32) (i32.const 0))
      (func $issue (result i32) (global.set $issued (i32.add (global.get $issued) (i32.const 1))) (call $error (i32.const 8)))
      (global $armed`)
		.replace(";; @installed-drop-observer@",()=>`(if (i32.eq (i32.load (local.get $p)) (i32.const 77777)) (then
        (return (call $result (i32.const 0) (i32.or (i32.shl (global.get $issued) (i32.const 16)) (global.get $freed))))))`)
		.replace(destructor,()=>`(func (export "cm32p2|${witCoreInterface(objects)}|member-error_dtor") (param $kind i32)
        (if (i32.ne (local.get $kind) (i32.const 8)) (then unreachable))
        (if (i32.ge_u (global.get $freed) (global.get $issued)) (then unreachable))
        (global.set $freed (i32.add (global.get $freed) (i32.const 1))))`));
	await run("component","embed",wit,"--world","owner","count-errors.wat","-o","count-errors.core");
	await run("component","new","count-errors.core","-o","count-errors.wasm");
	await run("component","targets",wit,"--world","owner","count-errors.wasm");
	const app=await readFile("tests/fixtures/static-host-workers/peer-failure.wat.in","utf8");
	await writeFile(join(dir,"peer-failure.wat"),app.replaceAll("@OBJECTS@",objects));
	await run("parse","peer-failure.wat","-o","peer-failure.wasm");
	await run("component","targets",join(dir,"combined-world"),"--world","instruments","peer-failure.wasm");
};
