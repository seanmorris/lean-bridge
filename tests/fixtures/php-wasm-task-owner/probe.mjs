/** @file Test owner scheduling between unthreaded PHP-Wasm and an independently installed Lean pthread runtime. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {join,resolve} from "node:path";
import {pathToFileURL} from "node:url";

const [installed,host]=process.argv.slice(2);
const resolveInstalled=createRequire(join(resolve(installed),"package.json")).resolve;
const {PhpNode}=await import(pathToFileURL(join(resolve(host),"PhpNode.mjs")));
const relay=await import(pathToFileURL(resolveInstalled("@example/lean-relay")));
const rt=await import(pathToFileURL(resolveInstalled("@lean-bridge/runtime")));
const cases=new Map();
const start=(mode,n) => {
	assert.equal(n,41); assert.ok(!cases.has(mode));
	const entered=Promise.withResolvers(), reply=Promise.withResolvers(), marker=Promise.withResolvers();
	const state={entered,reply,marker,settled: 0,calls: 0};cases.set(mode,state);
	const callback=arg => {
		assert.equal(arg,mode==="worker-error"?9:n);state.calls++;entered.resolve();return reply.promise;
	};
	state.task=mode==="worker-error"?relay.later_error(false,callback):relay.worker(n,callback);
	// A rejected JS promise passed directly to vrzno_await can escape PHP's catch.
	// Always fulfill the transport, then let PHP classify the outcome itself.
	return state.task.then(value => ({status: "ok",value}),e => ({status: e.code})).then(async packet => {
		state.settled++; await rt.waitTaskRuntimeIdle();return JSON.stringify(packet);
	});
};
const yielded=mode => {
	const s=cases.get(mode); assert.equal(s.settled,0); s.marker.resolve();
	// Run on a later turn, only after BOTH the PHP statement and the actual worker callback.
	s.driver=Promise.all([s.entered.promise,s.marker.promise]).then(() => new Promise(resolveTurn => setImmediate(resolveTurn))).then(() => {
		assert.equal(s.calls,1);assert.equal(s.settled,0);
		if(mode==="cancel")
		{ assert.equal(s.task.cancel(),true); assert.equal(s.task.cancel(),false); }
		else s.reply.resolve(42);
	});
};
const php=new PhpNode({version: "8.4",autoTransaction: false,shared: {start,yielded}});
let stdout="",stderr="";
php.addEventListener("output",e => {stdout+=e.detail.join("");});
php.addEventListener("error",e => {stderr+=e.detail.join("");});
try
{
	const binary=await php.binary;assert.ok(!(binary.HEAPU8.buffer instanceof SharedArrayBuffer));
	const rc=await php.run(await readFile(new URL("./await.php",import.meta.url),"utf8"));
	assert.equal(rc,0,stderr || stdout);assert.equal(stderr,"");
	assert.deepEqual(JSON.parse(stdout),[42,"operation-cancelled","error:TaskIO.Error",42]);
	for(const s of cases.values())
	{ await s.driver; assert.equal(s.calls,1); assert.equal(s.settled,1); }
	cases.get("cancel").reply.resolve(99); await rt.waitTaskRuntimeIdle();
	const stats=rt.taskRuntimeStats();
	for(const key of ["frames","allocations","pending","notifications","nativeOwners"]) assert.equal(stats[key],0,key);
	console.log("PHP-Wasm awaited a pending Lean worker, caught cancellation, and ran another task; zero live owners");
} finally
{await rt.closeTaskRuntime();}
