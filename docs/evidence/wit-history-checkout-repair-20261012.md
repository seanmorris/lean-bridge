# WIT workflow history comparison repair

The four Perl variants in downstream run `38220864275` failed the WIT
source-history test at pushed revision `d2d8192`. The test compared the complete
current consumer workflow with the older WIT-checkout checkpoint. Later Python,
Ruby and Rust CI additions changed that file without changing the WIT checkout.

The repaired assertion uses the existing digest-authenticated history reader to
stop at the WIT checkpoint, then compares the entire reconstructed workflow with
the original Git source plus the exact checkout change. It does not remove
arbitrary job blocks or weaken the full comparison. Twelve controls preserve and
reject unknown edits, shallow checkout, missing history, credential persistence,
failure suppression and conditional bypass at both source epochs.

The workflow and support inventory remain byte-for-byte unchanged. The new
immutable ledger records three exact test/history transitions from
`5762111059313672f23825b65df2f91ec05437a3`; it does not rewrite earlier evidence.
The inventory still contains 496 evidence entries and 583 observations.

Validation:

- Original local reproduction: one failure, one pass. Log
  `build/vo1444-wit-history-repair-reproduce-r1-0.log`, SHA-256
  `21d9e92b56831fb283d92d61623b8b4362fca0ae8df0ab4d2968d7bc8442f680`.
- Focused history and checkout tests: 13 passed, no failures or skips. Log
  `build/vo1444-wit-history-repair-focused-r1-0.log`, SHA-256
  `a879be77e1f1c4ad4630bc06b9a2df3ea1bc20b0bf0d8491fb910d0aa81f6e16`.
- Four registered roots: 265 passed, no failures, 36 explicitly gated skips.
  Log `build/vo1444-wit-history-repair-registered-r1-0.log`, SHA-256
  `d853851a55ee430becbfd5273952c33032a233296683bb075b1cc38f7618474b`.
  The roots cover native Fin records, component refinement mirrors, test
  registration and the checked-JavaScript contract.
- Targeted ESLint and `git diff --check` passed. The initial lint run found one
  brace-placement error; the original log remains alongside the passing rerun.
- `build/vo1444-wit-history-repair-audit-r1.json` independently checks all three
  transitions against Git and confirms unchanged older evidence and claims.

Ledger SHA-256:
`af3bb38630b21c1ba04cae15b9d5b1d8b90d715a6d53dfb8e1092b8f4d089571`.
Support inventory SHA-256:
`ab1362a772dd4b76a171c844341ba48033922e78955954b1d38a09255c38df0a`.
Hosted confirmation of this repair remains pending.
