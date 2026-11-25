import {withHosts} from "@lean-bridge/workshop-host-example";
class Box {
    constructor(public level:number) {}
    read() { return this.level; }
    identity() { return this; }
}
const w=withHosts({Box}), x=new Box(7), f=w.remember(x);
const y:Box=f(x), n:number=w.reader(x)(1), b:boolean=f.dispose();
const p:Promise<Box>=w.map_box(y,f);
// @ts-expect-error -- immediate Lean IO returns a function, not a JS promise
w.remember(x).then(()=>{});
// @ts-expect-error -- capture leases and their native identities are not exposed
f.retain();
// @ts-expect-error -- the argument is a Box, not its level
f(n);
await p; await w.dispose();
