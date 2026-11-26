# Passing a Lean resource into and out of a public function

All 17 consumer profiles executed both direct export positions on ordinary and reviewed packages: **34 installed profile/route combinations, 68 position checks**. Each consumer called `OwnedCheckedRecords.newTicket` to obtain the resource and passed a Ticket to `OwnedCheckedRecords.serial` to check its value. A record with a Ticket field or a callback exchanging that record would not establish either call.

The [per-profile results](resource-ticket-positions-20261126.json) identify the package receipt, consumer source and execution report on each route. Most results reuse the [original eleven archive selections](owned-checked-record-promotion-20261026-aligned.md). The [audit](../../tests/helpers/resource-ticket-positions-audit.mjs) reads the selected Git blobs, verifies their digests and joins the public calls in the client to the recorded installation and execution. The Wasmtime client uses a generated symbol prefix: the source digest and the compiled-client source digest need not be identical.

For npm, the Node program and the browser entry points shared an executed probe. The production page, React app and dedicated worker each passed in Chromium, Firefox and WebKit. The archived TypeScript program was type-checked only. Its [separate strict TypeScript replay](typescript-ticket-positions-20261126.md) compiled and executed against those exact ordinary and reviewed archives.

Run `npm run test:resource-ticket-positions` from a checkout containing the selected archive revision. This verifies the recorded results without rebuilding eleven packages. To rerun the new TypeScript client itself, run `npm run test:typescript-ticket-positions`.

## Direct callbacks are separate

For Perl, [the hosted CPAN run](standalone-perl-resources-20261122.md) qualifies both direct callback positions independently of the table above. On each of four Perl ABIs, the ordinary and reviewed packages passed the [same client](../../tests/fixtures/perl/resource-callables.t): the callback received the same Perl wrapper as the caller, and a separate exchange returned a *different* Counter with value 77. Wrong-kind replies and the original exception were checked, and all four live counters returned to baseline. This result belongs to Perl, not to all 17 profiles.
