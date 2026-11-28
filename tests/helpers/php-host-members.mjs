/** @file Run the projected member table against real PHP classes and Throwables. */
import assert from "node:assert/strict";
import {execFile} from "node:child_process";
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import test from "node:test";
import {promisify} from "node:util";
import {phpHostMembers} from "../../src/backends/php/host-members.mjs";

const exec=promisify(execFile);
test("PHP calls only the declared public members and keeps application Throwable identity",async t=>{
	const dir=await mkdtemp(join(tmpdir(),"php-host-members-"));
	t.after(()=>rm(dir,{recursive: true,force: true}));
	const ir=JSON.parse(await readFile("tests/fixtures/ruby-host-meter/lean-bridge.hosts.json","utf8"));
	ir.types[0].host.targets=["php"];
	const ctor=ir.declarations.find(d=>d.kind==="constructor");
	const method={...structuredClone(ctor),kind: "static-method",id: "host:meter.Box.doubled",name: "doubled",overloadKey: "Box.doubled"};
	method.source.declaration="Box.doubled";ir.declarations.push(method);
	const model=phpHostMembers(ir);
	assert.deepEqual(model.members.find(m=>m.op==="set").args,[0,"uint32"]);
	assert.equal(model.members.find(m=>m.op==="constructor").result,0);
	const mutate=(change,reason)=>{const bad=structuredClone(ir);change(bad);assert.throws(()=>phpHostMembers(bad),reason);};
	mutate(m=>{m.types[0].host.dynamic=true;},/statically declared/u);
	mutate(m=>{m.declarations.at(-1).name="READ";},/ambiguous member/u);
	mutate(m=>{m.declarations.at(-1).name="__call";},/invalid synchronous member/u);
	const path=join(dir,"model.json");await writeFile(path,JSON.stringify(model));
	const runner=process.env.LEAN_BRIDGE_HOST_PHP??"php";
	const {stdout,stderr}=await exec(runner,[resolve("tests/fixtures/php-host-members/members.php"),resolve("src/backends/php/host-members.php"),path]);
	assert.equal(stderr,"");const report=JSON.parse(stdout);
	const [major,minor]=report.php.split(".").map(Number);
	assert.equal(report.checks,major>8 || major===8 && minor>=4?24:20);
	t.diagnostic(stdout.trim());
});
