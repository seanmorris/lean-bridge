import {withHosts} from "@lean-bridge/workshop-host-example";
class Box {
	constructor(public level: number) {}
	read() {return this.level;}
	identity(): this {return this;}
	extra(): true {return true;}
}
const w=withHosts({Box}),b=await w.start(2);
const result:Box=await w.map_box(b,async value=>{value.extra();return value;});
const scalar:number=await w.project_box(b,value=>value.read());
const other:Box=await w.select_box(scalar,n=>new Box(n));
void [result,other];
// @ts-expect-error The callback must return the supplied class, not a scalar.
w.map_box(b,async value=>value.read());
// @ts-expect-error A callback accepting only a number cannot receive a Box.
w.project_box(b,(n:number)=>n+1);
await w.dispose();
