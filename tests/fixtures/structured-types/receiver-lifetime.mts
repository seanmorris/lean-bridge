import type {TicketValue} from "@example/receiver-lifetime";
import {observeTariff} from "./observer.mjs";

const {api: {default: api}, live} = await observeTariff(() => import("@example/receiver-lifetime"));
api.newTicket(0n, "warm").dispose();
const baseline = live();

const owners: TicketValue[] = [];
const keep = (owner: TicketValue): TicketValue => { owners.push(owner); return owner; };
const fresh = (serial: bigint) => keep(api.newTicket(serial, "typed"));
function check(value: boolean): void {
    if (!value) throw Error("wrong receiver lifetime");
}
let expiredViews = 0;
function expired(view: TicketValue): void {
    check(view.disposed);
    try { void view.serial; } catch { ++expiredViews; return; }
    throw Error("expired getter returned a value");
}
let retained: bigint, chosen: bigint, consumed: bigint, held: number;
try {
    const root = fresh(41n), shared = keep(root.share());
    const borrowed = keep(root.retainTicket()), child = keep(borrowed.retainTicket());
    const independent = keep(child.retain());
    held = live(); check(held > baseline);
    root.dispose();
    check(shared.serial === 41n && child.serial === 41n);
    shared.dispose(); expired(borrowed); expired(child);
    retained = independent.serial; check(retained === 41n);

    const receiver = fresh(17n), argument = fresh(73n);
    const result: TicketValue = keep(receiver.chooseTicket(argument));
    receiver.dispose(); chosen = result.serial; check(chosen === 73n);
    argument.dispose(); expired(result);

    const moving = fresh(99n), alias = keep(moving.share()), dependent = keep(moving.retainTicket());
    const moved = keep(moving.transferTicket());
    expired(moving); expired(alias); expired(dependent);
    consumed = moved.serial; check(consumed === 99n);
} finally {
    for (const owner of owners) owner.dispose();
}
check(owners.every(owner => owner.disposed));
const released = live(); check(released === baseline);
check(api.close() && !api.close());
const stopped = live(); check(stopped === 0);
console.log(JSON.stringify({retained: String(retained), parameter: String(chosen), transferred: String(consumed), expiredViews, closed: true, counts: {baseline, held, released, stopped}}));
