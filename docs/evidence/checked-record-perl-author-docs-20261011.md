# Perl checked-record author guidance

The [documentation job at 20539c5](https://github.com/seanmorris/lean-bridge/actions/runs/38111996698/job/114389301547)
failed because its assertion still expected the older sentence about pending
browser execution. The guide already named both PHP-Wasm and browser execution
as pending. The test now checks that statement and the four-ABI, two-install-mode
Perl evidence linked in the same section.

The summary table had a separate error: it still rejected CPAN checked records.
It now agrees with the existing installed ordinary/reviewed Perl acceptance.
The test authenticates all four original source/result-only routes before
checking their inventory references. No new transport or type position is
promoted by this repair.

## Historical comparisons

The broader regression found two promotion tests that compared live files with
the original promotion snapshot without restoring later authenticated changes.
They now stop at that milestone's exact digest. The newly generated evidence
references use current validator hashes, so the test also authenticates each
validator's recorded historical bytes before comparing the complete inventory.
All four references share validator objects; the test checks every reference
before applying historical hashes to those objects.

The five-transition ledger preserves the exact predecessor `20539c53406f365d90e07251fd141c14ebf5fb0e`.
It refreshes 22 source pins, with all 440 evidence claims and 555 observations
unchanged. An independent Git audit confirms all 7,612 earlier evidence files
remain byte-identical. Source-history ledger SHA-256:
`29c24ca9b56b31a481907c84eae21eac7b666aa3dd99c7a3432bb5d900112c0c`.

## Verification

The final twelve-root regression, including the complete documentation suite,
passed 207 tests with zero failures or skips. TAP
`build/vo1446-perl-author-docs-final-r4.tap`, SHA-256
`e4a15c758d59538ef191c06151b6a9d515f0ee7fd3def53a164cff152e924cc0`.

Focused promotion/history checks passed eight tests with no failures or skips.
TAP `build/vo1446-perl-author-docs-focused-r4.tap`, SHA-256
`e8550cc6a5ab32e4a1f40f3a43cd357b81c94d8143fa21dbf4e033c9064baa85`.
Targeted ESLint, checked JavaScript and all 16 generated references pass.

The original local reproduction and failed draft TAP logs remain under
`build/vo1446-perl-author-docs-*`. Draft R3 also overlapped a source-history
rewrite and is not final acceptance. The final combined regression runs against
an unchanged source/history state. No installed producer was rerun for this
documentation repair.
