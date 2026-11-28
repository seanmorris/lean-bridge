import {withHosts} from "@lean-bridge/workshop-host-example";
import {closeTaskRuntime,taskRuntimeStats,waitTaskRuntimeIdle} from "@lean-bridge/runtime";

class Meter {
	constructor(public level: number) {}
	read(): number {return this.level;}
	identity(): this {return this;}
}
const api=withHosts({Box: Meter}),first=new Meter(7),second=new Meter(7);
let visits=0;
try {
	await api.start(0);
	if(false) {
		// @ts-expect-error A plain object is not a Meter callback reply.
		api.map_box(first,()=>({}));
	}
	for(const [input,reply] of [[first,second],[second,first]]) {
		const immediate: Meter=api.identity(input);
		if(immediate!==input) throw Error("wrong immediate result");
		const pending: Promise<Meter>=api.map_box(input,async (arg: Meter): Promise<Meter>=>{
			if(arg!==input || arg===reply) throw Error("wrong callback argument");
			++visits;return reply;
		});
		const observed=await pending;
		if(observed!==reply || observed===input) throw Error("wrong callback reply");
		++observed.level;
	}
} finally {await api.dispose();}
await waitTaskRuntimeIdle();
const stats=taskRuntimeStats();
if(stats.nativeOwners || stats.hostPins || stats.pending || stats.hostErrors) throw Error("undrained binding");
await closeTaskRuntime();
console.log(JSON.stringify({visits,levels:[first.level,second.level],drained:true}));
