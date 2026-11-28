/** @file Downstream application: exchange distinct objects, without wrapper or handle comparisons. */
import {withHosts,JavaScriptCallbackError} from "@lean-bridge/workshop-host-example";
import {taskRuntimeStats,waitTaskRuntimeIdle} from "@lean-bridge/runtime";

/** Application-owned meter with deliberately non-unique readings. */
class Meter
{
	/**
	 * Create a meter.
	 *
	 * @param level - Initial reading.
	 */
	constructor(level){this.level=level;}
	/** Read the current value. */
	read(){return this.level;}
	/** Give the original object back to Lean. */
	identity(){return this;}
}

/** Exercise the immediate and asynchronous APIs in the caller's own realm. */
export const exerciseObjects=async()=>{
	const api=withHosts({Box: Meter}),a=new Meter(7),b=new Meter(7);
	let visits=0;
	try
	{
		await api.start(0);
		for(const [input,reply] of [[a,b],[b,a]])
		{
			if(api.identity(input)!==input) throw new Error("immediate result lost object identity");
			const result=await api.map_box(input,async arg=>{
				if(arg!==input || arg===reply) throw new Error("wrong callback argument");
				++visits;await Promise.resolve();return reply;
			});
			if(result!==reply || result===input) throw new Error("callback returned the input instead of the reply");
			++result.level;
		}
		try
		{await api.map_box(a,()=>({}));throw new Error("accepted a foreign object");}
		catch(error)
		{if(!(error instanceof JavaScriptCallbackError && error.cause instanceof TypeError)) throw error;}
		if(api.identity(b)!==b) throw new Error("invalid reply damaged binding");
	} finally
	{await api.dispose();}
	await waitTaskRuntimeIdle();
	const stats=taskRuntimeStats();
	for(const key of ["frames","pending","nativeOwners","notifications","hostPins","hostErrors"])
		if(stats[key]!==0) throw new Error("unreleased "+key+": "+stats[key]);
	return {visits,levels: [a.level,b.level],drained: true};
};
