# C# producer resource wait

The first nominal NuGet run at `77f320805146df0d28c0ad161d37dc0feff6fa75`
built author root zero, then stopped before the second root because host load
exceeded six. It did not reach installed acceptance. Original records remain at
`build/vo1444-nominal-dotnet-ordinary-full-r1-77f3208-records`; the failed TAP is
`build/vo1444-nominal-dotnet-ordinary-full-r1-77f3208.tap`, SHA-256
`e136d9341c0727594a33877d95e06b52311095c72107497fd8f32c780b11fe69`.
Its retained temporary root is `/tmp/lean-bridge-nominal-subtype-dotnet-z32ZJs`.

The producer now waits in 15-second intervals for load below six before starting
each expensive phase. It stops after five minutes if load remains high. The 2 GiB
disk and available-memory floors still fail immediately, and the monitored runner
retains its 768 MiB emergency floor. No phase begins on an invalid load reading.
Successful wait samples are retained in `resources.json` and the final report.

Policy controls exercise immediate admission, two delayed admissions, invalid
readings, strict disk/memory floors and all twenty bounded waits. This change
adds no support claim and changes no original acceptance record or source-history
ledger. The four complete NuGet selections remain required.

Focused caller, resource-policy, registration and checked-JavaScript checks passed
16 tests with zero failures and four gated installed selections. Original log:
`build/vo1444-nominal-dotnet-resource-focused-r1.log`, SHA-256
`cecfdd62c0f0d9c9f6860ea3c8bfb2082db090f29fde2c99f93a398791c15a5a`.
All three changed JavaScript modules pass ESLint.
