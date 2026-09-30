# Ruby borrowed-result test registration

The full core entry point rejected `owned-ruby-borrow-evidence.test.mjs` because
the closed test manifest did not assign it a profile. Registering that test in
the contract profile makes the normal core gate execute its evidence checks.

The Ruby runtime, package generator, installed observations and original receipt
are unchanged. The follow-up JSON records exact source transitions, the complete
test-profile check and mechanical evidence-index hash updates. It promotes no
type-support cells and makes no new installed-execution claim.
