/** @file Ordinary downstream code used unchanged in Node, Chromium, and a module worker. */
import {exerciseHostFunctions} from "./javascript-host-functions.mjs";
/**
 * Exercise two independently installed packages with one application's class.
 *
 * @param first - First component in this agent's load order.
 * @param second - Independent component using the same declared class.
 */
export const exercise = (first,second) => {
	const check=(v,m)=>{if(!v) throw new Error(m);};
	/** Class defined by the consumer, not by either Lean package. */
	class Box
	{
		/**
		 * Initialize the consumer's own storage.
		 *
		 * @param n - Initial reading.
		 */
		constructor(n) {this.level=n;}
		/** Return the currently stored reading. */
		read() {return this.level;}
		/** Preserve the application's exact instance. */
		identity() {return this;}
	}
	const a=first.withHosts({Box}),b=second.withHosts({Box});
	const original=Object.freeze({code: "declared-error",details: {errorId: "error:IO.Error"}});
	try
	{
		let conflict;try
		{second.withHosts({Box: Object});} catch(e)
		{conflict=e;}
		check(conflict && /incompatible/i.test(conflict.message),"independent packages must agree on their live class");
		const box=a.make(17);
		check(box instanceof Box && b.identity(box)===box,"identity crossed the package boundary");
		check(b.update(box,24)===24 && a.read(box)===24,"mutation visible to both packages");
		const [outcomes,pkg]=a.branch?[a,first]:[b,second];
		const typedOutcomes=typeof outcomes.branch==="function";
		if(typedOutcomes)
		{
			check(outcomes.branch(true,box).ok.error===box,"nested returned Except lost its object");
			let failed;try
			{outcomes.typed(box);} catch(e)
			{failed=e;}
			check(failed instanceof pkg.EIO_Outcomes_typed && failed.payload.ok===box,"typed EIO object payload");
			for(const n of [7,0xffff_ffff])
			{
				failed=null;try
				{outcomes.ordinary_failure(n);} catch(e)
				{failed=e;}
				check(failed instanceof pkg.IOError && failed.message==="reading "+n+" refused","ordinary formatted Lean IO error");
			}
			check(outcomes.ordinary_failure(9)===9,"success after formatted errors");
		}
		box.read=()=>b.update(box,31);
		check(a.read(box)===31,"synchronous reentry into another package");
		box.read=()=>{throw original;};
		let caught;try
		{a.read(box);} catch(e)
		{caught=e;}
		check(caught===original,"original throw identity changed");
		caught=null;try
		{a.mapped(box);} catch(e)
		{caught=e;}
		const mapped=Object.entries(first).find(([n])=>n.startsWith("EIO_") && n.endsWith("_mapped"))?.[1];
		check(caught instanceof mapped && caught.payload==="host read failed","declared EIO class or payload");
		check(a.dispose() && !a.dispose(),"idempotent disposal");
		box.read=()=>box.level;
		check(b.read(box)===31,"other package remains usable");
		const returnedFunctions=typeof b.remember==="function" && exerciseHostFunctions(first,second,Box);
		return {reading: box.level,identity: true,originalThrow: true,payload: caught.payload,typedOutcomes,...returnedFunctions?{returnedFunctions}:{}};
	} finally
	{a.dispose();b.dispose();}
};
