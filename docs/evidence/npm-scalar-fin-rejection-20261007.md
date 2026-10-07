# Out-of-bound top-level scalar `Fin` fails installed npm calls at the adapter entry

VO1430 under VO1220, 2026-10-07. It repairs a gap found by the [browser acceptance](npm-browser-refinements-20261007.md): a direct call through the package-internal runtime with an out-of-bound top-level scalar `Fin` returned the result type's default value.

## Finding

The scalar, callable, copied, record, compound and nominal generators exported a Lean validator and called it from the C adapter entry only for non-`Fin` refinements. A direct `runtime.call` with an out-of-bound `Nat` therefore reached the typed Lean wrapper, whose guard rejected with `panic!`; compiled Lean prints the panic and returns `default`, so the call succeeded with that value. On revision `0c57d7b` the installed Node call `runtime.call("lean:OnboardingSmall.mirror", [10n])` returned `0n` and `PANIC at … Lean Bridge rejected an invalid refined value` reached stderr. The public API rejected the same input before dispatch; container, `Subtype` and structured-callable paths failed closed.

## Repair

`Fin` is validated like `Subtype`: every Lean generator exports one validator per refined scalar parameter, and every C adapter entry calls it, in parameter order and with the same retained reference and rejection cleanup, before the typed wrapper or the source runs. Rejection surfaces through the existing call status (`Component scalar call failed (6)`, `Component callable call failed (6)`, `Component copied call failed (5)`). The typed wrapper's own guard remains in the generated Lean but no runtime entry reaches it with an invalid value; it is not a rejection mechanism and this record makes no claim about calling that internal wrapper directly. Unrefined exports generate the same bytes.

## Installed evidence

`LEAN_BRIDGE_LAKE_WASM_TEST=1 node --test tests/scalar-fin-rejection.test.mjs` builds one ordinary-source fixture per private ABI that carries scalar exports, each with `mirror` over `abbrev Digit := Fin 10`, `never : Fin 0 → Nat`, `one : Fin 1 → Nat`, `huge : Fin 184467440737095516170 → Nat`, `pair : Digit → Fin 4 → Nat`, `tenth : Nat → Digit` (result only) and `mix : Text → Digit → String` with the contract-checked `checkedText` constructor, plus the shape that selects the ABI: a host callback (`apply`, ABI 3), an `Array Nat` (`count`, ABI 4), a record (`tag`, ABI 5), an `Option Nat` (`orZero`, ABI 6) and a `String` alias (`labelled`, ABI 7). Each build asserts the selected ABI and the exported validators in the generated Lean, reproduces its archive from two clean roots, removes the source and installs offline.

The consumer calls each export through the public API and through the package-internal runtime. Valid controls: endpoints of every bound, `huge` at its bound minus one, `pair(2, 3) = 11`, `tenth(123) = 3` and `tenth(2^70) = 4` with no rejection, `mix("λ🙂", 0)`, and the ABI's own export. Rejections: at-bound, beyond-bound and `2^70` for every bound, `Fin 0` for 0 and 1, late rejection of `pair`'s second argument after the first passed, `mix` rejected by the `Subtype` validator on empty text and by the `Fin` bound after a 4 KiB `String` passed the validator, 500 such cycles releasing the string each time, a host callback that is not invoked when the `Fin` beside it is rejected, and 1,000 cycles alternating direct and public rejections with valid calls. A direct rejection must carry the ABI's exact status message, and the consumer's stderr must be empty, where the pre-repair wrapper printed its panic.

Dispatch observables in the installed Wasm artifact: a valid call's result can only come from the source (`mirror(3) = 6`), the host callback counter in the callable fixture advances once per valid call and not at all for a rejected one, and an empty stderr shows the typed wrapper's guard never ran, so the rejection happened at the C entry. The status value distinguishes the C entry (6 or 5) from a wrapper panic (a success with a default value and a stderr line).

The run used revision `9743855` on Debian 12. Per ABI, the installed consumer passed:

```text
scalar    ABI 2  1535 checks  2546 rejections  4961ce9b6c7d42218ac8e853a0669736d1239b2131001562ca00a6f9bf78fc34  onboarding-small-1.0.0.tgz
callable  ABI 3  1537 checks  2548 rejections  049f4adb33cc0fdab5516e0feae5f99222ae71d8c81b5d1d8de1874679155303  onboarding-small-1.0.0.tgz
copied    ABI 4  1536 checks  2548 rejections  6f25469e871bc9ee3a500ae9a025ebbe7d8823e4e19e2ae92c434ee83ef9a079  onboarding-small-1.0.0.tgz
record    ABI 5  1536 checks  2548 rejections  5f46ba4deb227018b0046ac86173e3f0e08f878d22336b3752c2c080dbce83d8  onboarding-small-1.0.0.tgz
compound  ABI 6  1536 checks  2548 rejections  7495fcfc600ab9bbad5331d2ed97b194a632f11193e2b51597ad8eb07f30d2cf  onboarding-small-1.0.0.tgz
nominal   ABI 7  1536 checks  2548 rejections  694d55594855ad5208483b82f6f2f9d5fbb1e8e45c0830603957fc9c6c78a58b  onboarding-small-1.0.0.tgz
```

Every fixture bundled the same runtime archive, `53ae663f0a62c6e2a096e1477ebc0378875e861ada44ac801957da85264c2d79`.

## Browser contexts

The browser acceptance was rerun on the repaired revision with the scalar direct calls restored to its shared check script, so every context now reports 130 checks and 131 package rejections (previously 128 and 129 without the scalar direct calls). Its receipt and cells point at the repaired archives; the [browser note](npm-browser-refinements-20261007.md) keeps the pre-repair facts.
