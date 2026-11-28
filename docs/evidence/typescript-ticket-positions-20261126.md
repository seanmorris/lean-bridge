# A Ticket as an installed TypeScript argument and result

The original npm job executed Node and browser clients, but compiled its TypeScript example with `--noEmit`. The [new client](../../tests/fixtures/structured-types/ticket-positions.mts) compiles with strict checks **and runs the emitted program**. It installs the same [ordinary](typescript-ticket-positions-20261126/ordinary.json) and [reviewed](typescript-ticket-positions-20261126/reviewed.json) archives from the hosted owned-record selection.

`newTicket` returned an explicitly owned Ticket. Passing it directly to `serial` recovered the original 91-bit integer. A retained owner survived disposal of the first; the installed binding rejected the disposed owner and still accepted its sibling. The final owner and session closed. TypeScript also rejected passing the bare integer where the Ticket was required.

Run `npm run test:typescript-ticket-positions` from a checkout containing the archived Git revision identified in the reports. The [test](../../tests/helpers/typescript-ticket-positions-installed.mjs) authenticates the receipt and both tarballs, installs them offline, moves the consumer and removes its package feed. It checks the ownership signatures against the installed interface and runs the client with no producer tools on its path. Set `LEAN_BRIDGE_TS_TICKET_OUTPUT` to a directory to save both reports. This test covers the two export positions, not a callback that takes or returns a Ticket.

## A Ticket inside a Claim

A [second strict TypeScript program](../../tests/fixtures/structured-types/ticket-fields.mts)
runs in a separate process from the direct-signature client. Its callback
read 41 from the incoming Claim's Ticket and returned a different Claim whose
Ticket read 73. A rejected transfer left the input usable; a successful
transfer disposed the original wrapper without invalidating an independently
retained Ticket. Both the [ordinary](typescript-ticket-positions-20261126/ordinary.field.json)
and [reviewed](typescript-ticket-positions-20261126/reviewed.field.json)
installations closed all wrappers and the session. This is executed coverage
of a **record field**, not of a bare Ticket callback argument or reply.
