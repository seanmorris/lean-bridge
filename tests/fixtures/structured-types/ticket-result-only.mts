import api, {type Claim} from "@lean-bridge/owned-checked-records-result-only";

const original = api.newTicket(20n, "result-only"), retained = original.retain();
original.dispose();
const produced = api.claimFor(retained);
if (produced.tag !== "some") throw Error("missing Lean-produced Claim");
const claim: Claim = produced.value;
const serial = api.serial(claim.holder);
if (serial !== 20n || claim.quota !== 0n) throw Error("changed result");
if (false) {
    // @ts-expect-error A result-only package cannot accept a Claim.
    api.echoClaim(claim);
}
if ("echoClaim" in api || "withClaimCallback" in api) throw Error("unexpected host input API");
claim.holder.dispose();
if (api.serial(retained) !== 20n) throw Error("disposing result revoked independent owner");
retained.dispose();
if (!claim.holder.disposed || !retained.disposed || !api.close() || api.close()) throw Error("cleanup failed");
console.log(JSON.stringify({serial: serial.toString(), quota: claim.quota.toString(), inputAbsent: true, closed: true}));
