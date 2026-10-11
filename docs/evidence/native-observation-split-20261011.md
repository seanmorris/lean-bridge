# Native CI observation recording stays below the expression limit

[Downstream run 38111265867](https://github.com/seanmorris/lean-bridge/actions/runs/38111265867)
was rejected before creating jobs at `49d84e7557db042bd4d6d53ade0638acd69f68ae`.
GitHub reported an expression longer than 21,000 characters at
`consumer-matrix.yml:3351`. The offending step records native consumer results;
it does not execute installed-package producers.

The script contained 21,609 characters. GitHub turns a scalar containing
expressions into a `format` expression, escaping literal quotes and braces. The
result was 21,632 characters. The limit and transformation are defined in the
runner's [expression constants](https://github.com/actions/runner/blob/main/src/Sdk/DTExpressions2/Expressions2/ExpressionConstants.cs)
and [template reader](https://github.com/actions/runner/blob/main/src/Sdk/DTObjectTemplating/ObjectTemplating/TemplateReader.cs).
Actionlint's structural check did not detect the length failure.

## Repair

C-family observations now have their own always-run step. A second always-run
step records Python and Rust observations only in their respective matrix jobs.
The expanded expressions are 7,304 and 14,959 characters. The largest remaining
expanded run expression in the downstream workflow is 17,735 characters.

No producer command, timeout, artifact upload or failure-enforcement condition
changed. Joining the recording steps reconstructs the exact previous workflow.
Tests execute the old and new recording scripts in Bash with a stand-in recorder
and compare every emitted argument across 30 outcome scenarios. Those scenarios
cover success and failure, skipped or cancelled outcomes for each required step.
Separate controls require recorder failures to propagate and refuse missing,
duplicate or misrouted recording steps. These are workflow tests, not installed
package observations.

A registered regression checks every workflow's run scalars against a
20,000-character budget, including interpolation overhead. It also checks quoted
expression delimiters, literal brace/quote escaping and malformed expressions.
Literal and folded run blocks are covered; retaining folded newlines gives a
conservative length bound. Actionlint remains the separate YAML/workflow check.

## Evidence preservation

Five exact source transitions refresh 117 current source pins. Support claims
and observations remain unchanged. The independent audit compares those
transitions directly with Git and confirms that all 7,610 earlier evidence files
remain byte-identical. No producer rerun or support promotion accompanies this
repair.

The earlier local draft failures remain in
`build/vo1220-native-observation-split-focused-r{1,2}.tap`. They exposed a missing
folded-block reader and a duplicate-step mutation that used JavaScript replacement
string expansion. The corrected mutation inserts literal text and now fails as
required.

## Verification

The final five-root regression passed 149 tests, with zero failures and 22
explicit compiler/installed gates skipped. TAP:
`build/vo1220-native-observation-split-regression-r2.tap`, SHA-256
`1e7dc2d768d13a7f8cb29a59bb77ce6f9f174f9cf15ee78228ab5ed42d43acd6`.
Targeted ESLint, checked JavaScript, all 16 generated references and actionlint's
structural check pass. This does not claim that the workflow's existing full
ShellCheck warning set is clean.

The first broad regression exposed a historical-layout comparison performed
after manually removing newer gates. The documentation test now checks the live
size budget and acceptance gates, joins the exact recording split, and then
performs its unchanged older layout comparisons. Its failed R1 TAP is retained.

Source-history ledger SHA-256:
`c8bf7ed533bbf4f8e883873e837f44717aac4870a810744c18fa47c058e8a829`.
Independent audit: `build/vo1220-native-observation-audit-precommit-r2.json`,
SHA-256 `a816f4f93f4c6392c47264d890f60d20dc904de3318cc8bc6fee3f53acc0d30e`.
