/** @file Public TypeScript brands agree across separately compiled components. */
import {Ticket,make,badge,checked,stream,EIO_Depot_checked,AsyncStep_Depot_stream} from "@example/lean-depot";
import {bump,Ticket as PeerTicket} from "@example/lean-peer";
const local: Ticket = make(2);
const shared: PeerTicket = await bump(local,3);
const clone: Ticket = shared.retain();
const identical: boolean = clone.same(local);
for await(const next of stream(shared,false)) next.dispose();
try { await checked(true,local); } catch(e) {
	if(e instanceof EIO_Depot_checked || e instanceof AsyncStep_Depot_stream) e.payload.dispose();
}
// @ts-expect-error Different nominal Lean type with the same representation.
bump(badge(2),1);
// @ts-expect-error Nominal types cannot be constructed by applications.
new Ticket();
// @ts-expect-error A structural object is not a runtime-issued token.
bump({dispose: () => true},1);
void identical;
