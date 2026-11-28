/** @file Use the installed packages' public APIs in Node, a module worker and Chromium. */
import * as relay from "@example/lean-relay";
import * as echo from "@example/lean-echo";
import {closeTaskRuntime,taskRuntimeStats,waitTaskRuntimeIdle} from "@lean-bridge/runtime";

/**
 * Exercise factory and worker callbacks, error identity and shutdown with a late reply.
 *
 * @param progress - Optional diagnostic for stalled browser tests.
 */
export const exercise=async (progress=() => {}) => {
	let checks=0;
	const eq=(actual,expected,label) => {
		if(!Object.is(actual,expected)) throw new Error(label+": expected "+String(expected)+", got "+String(actual));
		checks++; progress(label);
	};
	const failure=async fn => {
		try
		{ await fn(); } catch(error)
		{ return error; }
		throw new Error("Expected a failure");
	};
	const drained=label => {
		const snap=taskRuntimeStats();
		for(const key of ["frames","allocations","pending","notifications","nativeOwners"]) eq(snap[key],0,label+" "+key);
	};
	const sentinel=Object.freeze({example: "original cause"});
	const fail=() => { throw sentinel; };
	const host=(err,original,phase) => {
		eq(err instanceof relay.JavaScriptCallbackError,true,"error class");
		eq(err.phase,phase,"error phase"); eq(err.cause,original,"original thrown value");
	};
	try
	{
		eq(await relay.factory(41,relay.add),42,"synchronous factory re-entry");
		eq(await relay.worker(21,async n => echo.twice(n)),42,"worker uses another installed component");
		const order=[];
		eq(await relay.twice(6,n => {order.push(n);return n+1;},n => {order.push(n);return Promise.resolve(3*n);}),21,"two callback slots");
		eq(order.join(","),"6,7","request ordering");
		eq(await relay.text("λ🌿",s => s+"!"),"λ🌿!","UTF-8");
		eq((await failure(() => relay.worker(1,{}))) instanceof TypeError,true,"invalid argument");
		drained("invalid input did not submit");
		host(await failure(() => relay.factory(1,fail)),sentinel,"factory");
		host(await failure(() => relay.worker(1,() => Promise.reject(sentinel))),sentinel,"task");
		host(await failure(() => relay.worker(1,() => Promise.reject(undefined))),undefined,"task");
		host(await failure(() => relay.propagate(7,fail)),sentinel,"task");
		const bad=await failure(() => relay.worker(0,() => "wrong"));
		eq(bad instanceof relay.JavaScriptCallbackError,true,"invalid reply failed callback"); eq(bad.cause instanceof TypeError,true,"wrong type");
		const large=await failure(() => relay.text("",() => "x".repeat(16*1024*1024)));
		eq(large instanceof relay.JavaScriptCallbackError,true,"oversize reply failed callback"); eq(large.cause instanceof RangeError,true,"copy budget");
		eq(await relay.recover(41,fail),42,"Lean caught the host error");
		const replaced=await failure(() => relay.replace(1,fail));
		eq(replaced instanceof relay.TaskIOError,true,"new error with identical message"); eq(replaced.cause.details.phase,"task","replacement phase");
		const io=await failure(() => relay.later_error(true,fail));
		eq(io instanceof relay.IOError,true,"Lean factory error"); eq(io.cause.details.phase,"factory","factory IO phase");
		const terminal=await failure(() => relay.later_error(false,relay.add));
		eq(terminal instanceof relay.TaskIOError,true,"Lean task error"); eq(terminal.cause.details.phase,"task","terminal IO phase");
		const typed=await failure(() => relay.checked(true,fail));
		eq(typed instanceof relay.EIO_Relay_checked,true,"typed factory rejection"); eq(typed.payload,413,"typed payload");
		eq((await relay.checked(false,relay.add)).ok,11,"ordinary Except ok");
		eq((await relay.checked(false,fail)).error,"caught","ordinary Except error");
		const foreign=await failure(() => echo.relay(1,fail));
		eq(foreign instanceof echo.JavaScriptCallbackError,true,"foreign class"); eq(foreign instanceof relay.JavaScriptCallbackError,false,"classes remain package local");
		eq(foreign.cause,sentinel,"foreign cause");
		eq(await relay.factory(20,n => echo.relay(n,x => relay.add(echo.twice(x)))),41,"nested async callbacks across packages");
		const entered=Promise.withResolvers(), deferred=Promise.withResolvers();
		const held=relay.factory(3,n => {entered.resolve(n);return deferred.promise;});
		eq(await entered.promise,3,"first package pending");
		eq(await echo.relay(4,relay.add),5,"second package independently settles while first waits");
		deferred.resolve(9); eq(await held,9,"first package resumes");
		const hold=begin => {
			const start=Promise.withResolvers(), reply=Promise.withResolvers();
			const task=begin(2,() => { start.resolve();return reply.promise; });
			return {start,reply,task};
		};
		const one=hold(relay.factory), two=hold(echo.relay);
		try
		{
			await Promise.all([one.start.promise,two.start.promise]);
			const limit=await failure(() => relay.factory(9,fail));
			eq(limit instanceof relay.IOError,true,"capacity failure belongs to the calling factory");
			eq(limit.message.includes("callback concurrency limit"),true,"shared callback budget");
		} finally
		{ one.reply.resolve(7); two.reply.resolve(8); }
		eq(await one.task,7,"budget preserves first waiter"); eq(await two.task,8,"budget preserves peer waiter");
		let called=0;
		const early=relay.worker(0,() => {called++;return 4;}), earlyError=failure(() => early);
		eq(early.cancel(),true,"cancel before dispatch"); eq((await earlyError).code,"operation-cancelled","early cancellation");
		await waitTaskRuntimeIdle(); eq(called,0,"queued callback did not run");
		let self;
		self=relay.worker(2,() => {eq(self.cancel(),true,"self-cancel");return 3;});
		eq((await failure(() => self)).code,"operation-cancelled","self cancellation settled once");
		await waitTaskRuntimeIdle(); eq(self.cancel(),false,"second cancel");
		for(const reject of [false,true])
		{
			const start=Promise.withResolvers(), reply=Promise.withResolvers();
			const task=relay.worker(3,() => {start.resolve();return reply.promise;}), done=failure(() => task);
			await start.promise; eq(task.cancel(),true,"cancel unresolved reply");
			eq((await done).code,"operation-cancelled","reject without waiting for host");
			await waitTaskRuntimeIdle(); drained("native cleanup before JS settlement");
			if(reject) reply.reject(sentinel); else reply.resolve(8);
			await Promise.resolve(); eq(await relay.worker(4,relay.add),5,"late reply ignored; heap reusable");
		}
		const start=Promise.withResolvers(), reply=Promise.withResolvers();
		const last=relay.factory(9,() => {start.resolve();return reply.promise;}), done=failure(() => last);
		await start.promise; await closeTaskRuntime();
		eq((await done).code,"operation-cancelled","shutdown with unresolved callback");
		reply.reject(sentinel); await Promise.resolve();
		eq(taskRuntimeStats().state,"closed","shutdown is final"); drained("closed"); return {checks};
	} finally
	{ await closeTaskRuntime(); }
};
