use strict;
use warnings;
use Math::BigInt;
use LeanBridge::FinProducts;
my $checks = 0;
sub check { die "failed: $_[1]\n" unless $_[0]; ++$checks; }
sub n { Math::BigInt->new("$_[0]") }
sub some { LeanBridge::FinProducts::Some->new($_[0]) }
sub ok { LeanBridge::FinProducts::Ok->new($_[0]) }
sub err { LeanBridge::FinProducts::Err->new($_[0]) }
sub rejected {
  my ($call, $path, $bound) = @_;
  my $passed = eval { $call->(); 1 }; my $error = "$@";
  return !$passed && index($error, "$path is not below its Fin $bound bound") == 0;
}
sub dies { my ($call) = @_; my $passed = eval { $call->(); 1 }; my $error = "$@"; return !$passed && index($error, 'is not below its Fin') < 0; }
my $wide = Math::BigInt->new(10)->blsft(64)->badd(10);
# Malformed shapes fail conversion with their own errors before any bound is walked.
check(dies(sub { LeanBridge::FinProducts::first([n(1)]) }), 'short product');
check(dies(sub { LeanBridge::FinProducts::first([undef, n(1)]) }), 'undefined component');
check(dies(sub { LeanBridge::FinProducts::first({ 0 => n(1), 1 => n(2) }) }), 'hash instead of product');
check(dies(sub { LeanBridge::FinProducts::both(bless({ value => n(1) }, 'PretendOk')) }), 'foreign Except class');
check(dies(sub { LeanBridge::FinProducts::both(undef) }), 'undefined Except');
check(dies(sub { LeanBridge::FinProducts::nested([some([n(1), 'text'])]) }), 'nested non-Except');
# Fin 10 × Nat: only the first component is bounded; the path names the component.
for my $d (0 .. 9) {
  my $out = LeanBridge::FinProducts::first([n($d), n(1000)]);
  check($out->[0]->bstr eq 9 - $d && $out->[1]->bstr eq '1001', "first $d");
}
check(rejected(sub { LeanBridge::FinProducts::first([n(10), n(0)]) }, 'arg0.0', '10'), 'first at bound');
check(rejected(sub { LeanBridge::FinProducts::first([Math::BigInt->new(2)->bpow(70), n(0)]) }, 'arg0.0', '10'), 'first beyond 64 bits');
check(LeanBridge::FinProducts::first([n(3), Math::BigInt->new(2)->bpow(200)])->[1]->bstr eq Math::BigInt->new(2)->bpow(200)->binc->bstr, 'unbounded component');
# Nat × Fin 1, and a bound wider than 64 bits beside Fin 10.
check(LeanBridge::FinProducts::second([n(41), n(0)])->bstr eq '41', 'second valid');
check(rejected(sub { LeanBridge::FinProducts::second([n(41), n(1)]) }, 'arg0.1', '1'), 'second at bound');
check(LeanBridge::FinProducts::wide([$wide->copy->bdec, n(9)])->bstr eq $wide->copy->badd(8)->bstr, 'wide valid');
check(rejected(sub { LeanBridge::FinProducts::wide([$wide->copy, n(9)]) }, 'arg0.0', $wide->bstr), 'wide at bound');
check(rejected(sub { LeanBridge::FinProducts::wide([$wide->copy->bdec, n(10)]) }, 'arg0.1', '10'), 'wide second at bound');
# Option (Fin 0 × Nat): only none is valid.
check(LeanBridge::FinProducts::absent_only(undef)->bstr eq '7', 'absent only none');
check(rejected(sub { LeanBridge::FinProducts::absent_only(some([n(0), n(0)])) }, 'arg0?.0', '0'), 'absent only some');
# Except String (Fin 10): the ok branch is bounded; an inactive branch is never read.
check(LeanBridge::FinProducts::ok_only(ok(n(9)))->bstr eq '9', 'ok valid');
check(rejected(sub { LeanBridge::FinProducts::ok_only(ok(n(10))) }, 'arg0.ok', '10'), 'ok at bound');
check(LeanBridge::FinProducts::ok_only(err('four'))->bstr eq '104', 'inactive ok');
# Except (Fin 5) Nat: the error branch is bounded; any ok Nat is valid.
check(LeanBridge::FinProducts::error_only(ok(Math::BigInt->new(2)->bpow(100)))->bstr eq Math::BigInt->new(2)->bpow(100)->bstr, 'unbounded ok');
check(LeanBridge::FinProducts::error_only(err(n(4)))->bstr eq '104', 'error valid');
check(rejected(sub { LeanBridge::FinProducts::error_only(err(n(5))) }, 'arg0.error', '5'), 'error at bound');
# Except (Fin 3) (Fin 7): only the active branch is checked.
check(LeanBridge::FinProducts::both(ok(n(6)))->bstr eq '6', 'both ok valid');
check(rejected(sub { LeanBridge::FinProducts::both(ok(n(7))) }, 'arg0.ok', '7'), 'both ok at bound');
check(LeanBridge::FinProducts::both(err(n(2)))->bstr eq '102', 'both error valid');
check(rejected(sub { LeanBridge::FinProducts::both(err(n(3))) }, 'arg0.error', '3'), 'both error at bound');
# List (Option (Fin 3 × Except (Fin 2) Nat)): the path carries the index, presence, component and branch.
my $rows = sub { [undef, some([n($_[0]), ok(n(50))]), some([n(1), err(n($_[1]))])] };
check(LeanBridge::FinProducts::nested($rows->(2, 1))->bstr eq '54', 'nested valid');
check(rejected(sub { LeanBridge::FinProducts::nested($rows->(2, 2)) }, 'arg0[2]?.1.error', '2'), 'nested branch');
check(rejected(sub { LeanBridge::FinProducts::nested($rows->(3, 1)) }, 'arg0[1]?.0', '3'), 'nested component');
check(LeanBridge::FinProducts::nested($rows->(2, 1))->bstr eq '54', 'nested recovery');
# DigitPair := Digit × Digit through the alias.
my $swapped = LeanBridge::FinProducts::aliased([n(1), n(9)]);
check($swapped->[0]->bstr eq '9' && $swapped->[1]->bstr eq '1', 'aliased valid');
check(rejected(sub { LeanBridge::FinProducts::aliased([n(1), n(10)]) }, 'arg0.1', '10'), 'aliased at bound');
# Results carrying bounds are produced by Lean and arrive below them.
my $produced = LeanBridge::FinProducts::produce(n(4));
check(ref($produced) eq 'LeanBridge::FinProducts::Err' && $produced->value->bstr eq '4', 'produce error');
check(ref(LeanBridge::FinProducts::produce(n(23))) eq 'LeanBridge::FinProducts::Ok', 'produce ok');
my $up = LeanBridge::FinProducts::pair_up(n(23));
check($up->[0]->bstr eq '3' && $up->[1]->bstr eq '23', 'pair up');
for my $i (0 .. 999) {
  die "round $i failed\n" unless LeanBridge::FinProducts::first([n($i % 10), n($i)])->[0]->bstr eq 9 - $i % 10;
  die "rejection round $i failed\n" unless rejected(sub { LeanBridge::FinProducts::first([n(10 + $i), n($i)]) }, 'arg0.0', '10');
}
$checks += 2000;
print "fin-product-ok:$checks\n";
