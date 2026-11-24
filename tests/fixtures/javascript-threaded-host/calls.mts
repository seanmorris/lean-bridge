import {withHosts} from "@lean-bridge/workshop-host-example";
class Box {
	constructor(public level: number) {}
	read() {return this.level;}
	identity(): this {return this;}
}
const w=withHosts({Box}), b:Box=await w.start(1);
const task=w.work(b,async n=>n+1), cancel:boolean=task.cancel();
const result:number=await task, it: AsyncIterableIterator<Box>=w.open_cursor(b);
const choice=await w.either(b);
if ("error" in choice) choice.error.read();
void [cancel,result,it];
// @ts-expect-error An arbitrary object is not an instance of the supplied application class.
w.identity({level:2});
// @ts-expect-error The callback must deliver a UInt32, not a string.
w.work(b,async ()=>"bad");
await w.dispose();
