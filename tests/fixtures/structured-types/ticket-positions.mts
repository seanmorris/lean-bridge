import api, {type Ticket} from "@lean-bridge/owned-checked-records";

const serial = (1n << 90n) + 7n;
const first: Ticket = api.newTicket(serial, "installed TypeScript");
const kept: Ticket = first.retain();
try {
    if (false) {
        // @ts-expect-error An integer is not a Ticket.
        api.serial(serial);
    }
    if (api.serial(first) !== serial) throw Error("wrong immediate Ticket result");
    first.dispose();
    if (!first.disposed || kept.disposed || api.serial(kept) !== serial)
        throw Error("the retained owner did not survive disposal of the original");
    let refused = false;
    try { api.serial(first); } catch { refused = true; }
    if (!refused || api.serial(kept) !== serial) throw Error("stale owner accepted or sibling lost");
} finally {
    kept.dispose(); first.dispose();
}
if (!kept.disposed || !api.close() || api.close()) throw Error("session cleanup failed");
console.log(JSON.stringify({serial: serial.toString(), retained: true, staleRejected: true, closed: true}));
