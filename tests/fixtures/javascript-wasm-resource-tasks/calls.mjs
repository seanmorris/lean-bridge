/** @file Exercise nominal resources using only installed public package APIs. */
import * as depot from "@example/lean-depot";
import * as peer from "@example/lean-peer";
import {closeTaskRuntime,taskRuntimeStats,waitTaskRuntimeIdle} from "@lean-bridge/runtime";

/** Check observable identity, worker lifetime, error channels, and native owner counts. */
export const exercise = async () => {
	let checks=0, gated=false;
	const eq=(actual,expected,label) => {
		if(!Object.is(actual,expected)) throw new Error(label+": expected "+expected+", got "+actual);
		checks++;
	};
	const failure=async fn => {
		try
		{ await fn(); } catch(error)
		{ return error; }
		throw new Error("Expected a rejection");
	};
	const owners=(n,label) => eq(taskRuntimeStats().nativeOwners,n,label);
	try
	{
		const t=depot.make(10), badge=depot.badge(10);
		eq(t instanceof depot.Ticket,true,"genuine wrapper"); eq(t instanceof depot.Badge,false,"distinct nominal kind");
		eq(depot.Ticket,peer.Ticket,"separately compiled components share the type");
		const fake=Object.create(depot.Ticket.prototype);
		eq(fake instanceof depot.Ticket,false,"a matching prototype is not a lease");
		eq((await failure(() => new depot.Ticket())) instanceof TypeError,true,"no public constructor");
		eq((await failure(() => depot.read(fake))) instanceof TypeError,true,"reject fake");
		eq((await failure(() => peer.bump(badge,1))) instanceof TypeError,true,"reject foreign type");
		owners(2,"refused calls allocated nothing");
		const keep=t.retain(), alias=depot.alias(t);
		eq(keep.same(alias),true,"independent leases of the same object");
		eq(alias.dispose(),true,"dispose once"); eq(alias.dispose(),false,"dispose twice");
		eq((await failure(() => depot.read(alias))).message.includes("disposed"),true,"stale argument");
		const task=depot.pending(t); gated=true;
		eq(t.dispose(),true,"worker captured its own reference");
		depot.release(5); gated=false;
		const delivered=await task, foreign=await peer.bump(delivered,4);
		eq(keep.same(delivered),true,"worker retained identity"); eq(depot.read(foreign),19,"shared mutation");
		eq(foreign.same(keep),true,"cross-package result identity");
		const err=await failure(() => depot.checked(true,foreign));
		eq(err instanceof depot.EIO_Depot_checked,true,"factory error class");
		eq(err.cause.details.phase,"factory","factory error phase"); eq(err.payload.same(keep),true,"owned error payload");
		eq(err.payload.dispose(),true,"release error independently");
		const success=await depot.checked(false,foreign);
		eq(success.same(keep),true,"typed success"); success.dispose(); delivered.dispose(); foreign.dispose(); badge.dispose();
		owners(1,"only source still held");
		const starting=depot.closes(), it=depot.stream(keep,false);
		const item=(await it.next()).value; eq(item.same(keep),true,"stream element is a lease");
		keep.dispose(); eq((await it.next()).done,true,"cursor exhausted"); eq(depot.read(item),19,"item outlived cursor");
		eq(depot.closes(),starting+1,"exhaustion closes once");
		const bad=depot.stream(item,true), yielded=(await bad.next()).value; yielded.dispose();
		const step=await failure(() => bad.next());
		eq(step instanceof depot.AsyncStep_Depot_stream,true,"step error class"); eq(step.cause.details.phase,"step","step phase");
		eq(step.payload.same(item),true,"step payload owns resource"); step.payload.dispose();
		const early=depot.stream(item,false), pull=early.next(), observed=failure(() => pull);
		await early.return(); eq((await observed).code,"operation-cancelled","return cancels outstanding pull");
		await early.return(); eq(depot.closes(),starting+3,"all three cursors closed exactly once");
		owners(1,"cancelled pull left no unobservable lease");
		const late=depot.pending(item); gated=true;
		const rejected=failure(() => late); item.dispose();
		eq(late.cancel(),true,"caller won cancellation"); eq((await rejected).code,"operation-cancelled","caller rejected");
		owners(1,"noncooperative worker alone is live"); depot.release(7); gated=false;
		await waitTaskRuntimeIdle(); owners(0,"late return reclaimed without a JS owner");
		for(const k of ["frames","allocations","pending","notifications"]) eq(taskRuntimeStats()[k],0,k);
		const orphan=depot.make(9); await closeTaskRuntime();
		eq(orphan.disposed,true,"shutdown closed remaining lease"); eq(orphan.dispose(),false,"shutdown is final");
		owners(0,"no native identities after shutdown"); return {checks};
	} finally
	{
		if(gated && taskRuntimeStats().state==="open") depot.release(0);
		await closeTaskRuntime();
	}
};
