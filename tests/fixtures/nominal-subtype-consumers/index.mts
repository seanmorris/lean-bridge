import * as api from "nominalsubtypes";
import "./results.mjs";

const envelope: api.Envelope = { payload: 40n, digit: 2n };
const alias: api.EnvelopeAlias = envelope;
const nested: api.Pair = { left: envelope, right: envelope };
const pair: api.AliasPair = { left: [{ tag: "some", value: alias }], right: [] };
const event: api.Event = { kind: "choices", values: [{ tag: "none" }, { tag: "some", value: { error: 40n } }] };
const result: bigint = api.first(envelope) + api.second(envelope) + api.combine(envelope, envelope) + api.nested(nested);
const echoed: api.AliasPair = api.echoPair(pair);
const choice: api.Event = api.echoEvent(event);
const normalized: api.Envelope = api.echo(envelope);
// @ts-expect-error The nominal record requires its Fin payload as well.
api.first({ payload: 40n });
// @ts-expect-error Nominal fields do not accept machine-number Nat values.
api.first({ payload: 40, digit: 2n });
// @ts-expect-error Empty variants cannot carry an inactive case payload.
api.echoEvent({ kind: "empty", value: envelope });
void result; void echoed; void choice; void normalized;
