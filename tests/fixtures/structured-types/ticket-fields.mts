import api, {type Claim, type Ticket} from "@lean-bridge/owned-checked-records";

const a = api.newTicket(41n, "argument");
const b = api.newTicket(73n, "reply");
const keep = a.retain(), owned: Ticket[] = [a, b, keep];
let calls = 0;
try {
    const claim: Claim = {holder: a, quota: 5n};
    const reply = api.withClaimCallback(claim, incoming => {
        if (api.serial(incoming.holder) !== 41n || incoming.quota !== 5n)
            throw Error("wrong borrowed record field");
        ++calls;
        return {holder: b, quota: 7n};
    });
    owned.push(reply.holder);
    if (calls !== 1 || reply.quota !== 7n || api.serial(reply.holder) !== 73n)
        throw Error("callback did not return the second Ticket");
    let refused = false;
    try { api.transferClaim({holder: a, quota: 42n}); } catch { refused = true; }
    if (!refused || a.disposed || api.serial(a) !== 41n) throw Error("rejected transfer consumed the field");
    const moved: Claim = api.transferClaim(claim);
    owned.push(moved.holder);
    if (!a.disposed || moved.quota !== 5n || api.serial(moved.holder) !== 41n || api.serial(keep) !== 41n)
        throw Error("transfer did not preserve the independent owner");
} finally {
    for (const ticket of owned) ticket.dispose();
}
if (!owned.every(ticket => ticket.disposed) || !api.close() || api.close()) throw Error("cleanup failed");
console.log(JSON.stringify({received: 41, returned: 73, rollback: true, transferred: true, calls, closed: true}));
