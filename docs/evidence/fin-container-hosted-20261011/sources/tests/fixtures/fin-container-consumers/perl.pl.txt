use strict;
use warnings;
use Math::BigInt;
use LeanBridge::FinContainers;
my $checks = 0;
sub check { die "failed: $_[1]\n" unless $_[0]; ++$checks; }
sub n { Math::BigInt->new("$_[0]") }
sub ns { [map { n($_) } @_] }
sub some { LeanBridge::FinContainers::Some->new($_[0]) }
sub rejected {
  my ($call, $parameter, $bound) = @_;
  my $passed = eval { $call->(); 1 }; my $error = "$@";
  return !$passed && index($error, "$parameter is not below its Fin $bound bound") == 0;
}
sub dies { my ($call) = @_; my $passed = eval { $call->(); 1 }; return !$passed; }
sub strs { join ",", map { ref($_) ? $_->bstr : "undef" } @{$_[0]} }
my $huge = Math::BigInt->new(2)->bpow(70); my $word = Math::BigInt->new(2)->bpow(32);
# Array (Fin 10): every element is checked; results stay below the bound.
check(strs(LeanBridge::FinContainers::mirror_all(ns(0 .. 9))) eq strs(ns(reverse 0 .. 9)), 'mirror endpoints');
check(strs(LeanBridge::FinContainers::mirror_all([])) eq '', 'empty array');
for my $position (0 .. 2) {
  my $bad = ns(1, 2, 3); $bad->[$position] = n(10);
  check(rejected(sub { LeanBridge::FinContainers::mirror_all($bad) }, "arg0[$position]", '10'), "invalid element at $position");
  check($bad->[$position]->bstr eq '10', 'input unchanged');
}
check(rejected(sub { LeanBridge::FinContainers::mirror_all([$word->copy, n(1), n(2)]) }, 'arg0[0]', '10'), 'word element');
check(dies(sub { LeanBridge::FinContainers::mirror_all([n(-1), n(1)]) }) && !rejected(sub { LeanBridge::FinContainers::mirror_all([n(-1), n(1)]) }, 'arg0[0]', '10'), 'negative is the Nat error');
check(dies(sub { LeanBridge::FinContainers::mirror_all([1.5]) }) && dies(sub { LeanBridge::FinContainers::mirror_all(3) }), 'non-BigInt elements die');
# Array (Fin 0): no present element is allowed.
check(LeanBridge::FinContainers::count_none([])->bstr eq '0', 'Fin 0 empty');
check(rejected(sub { LeanBridge::FinContainers::count_none(ns(0)) }, 'arg0[0]', '0'), 'Fin 0 present');
# List Huge: a 2^70 bound compared exactly.
check(LeanBridge::FinContainers::sum_huge([$word->copy, $huge->copy->bsub(1)])->bstr eq $word->copy->badd($huge)->bsub(1)->bstr && LeanBridge::FinContainers::sum_huge([])->bstr eq '0', 'huge sums');
check(rejected(sub { LeanBridge::FinContainers::sum_huge([$word->copy, $huge->copy]) }, 'arg0[1]', $huge->bstr), 'huge bound');
# Option (Fin 1): undef is valid; a present value is checked.
check(LeanBridge::FinContainers::or_default(undef)->bstr eq '7' && LeanBridge::FinContainers::or_default(some(n(0)))->bstr eq '0', 'option values');
check(rejected(sub { LeanBridge::FinContainers::or_default(some(n(1))) }, 'arg0?', '1'), 'present Fin 1');
# Array (Option Digit): only present elements are checked.
check(strs(LeanBridge::FinContainers::present([some(n(1)), undef, some(n(9))])) eq '1,9', 'present digits');
check(rejected(sub { LeanBridge::FinContainers::present([some(n(1)), undef, some(n(10))]) }, 'arg0[2]?', '10'), 'present invalid');
check(strs(LeanBridge::FinContainers::present([some(n(1)), undef, undef])) eq '1', 'absent is never read');
# List (Array Digit) -> Option (List Digit): nested rows.
my $flat = LeanBridge::FinContainers::flatten([ns(1, 2), ns(3)]);
check(ref($flat) && strs($flat->value) eq '1,2,3' && !defined(LeanBridge::FinContainers::flatten([])), 'flatten rows');
check(strs(LeanBridge::FinContainers::flatten([[], ns(4)])->value) eq '4', 'nested empty row');
check(rejected(sub { LeanBridge::FinContainers::flatten([ns(1, 2), ns(10)]) }, 'arg0[1][0]', '10'), 'nested invalid last');
check(rejected(sub { LeanBridge::FinContainers::flatten([ns(1, 10), ns(3)]) }, 'arg0[0][1]', '10'), 'nested invalid column');
# A late refined argument after an unrefined one.
my $names = ['a', 'b'];
check(LeanBridge::FinContainers::label($names, ns(1, 3)) eq 'a:1,b:3', 'label');
check(rejected(sub { LeanBridge::FinContainers::label($names, ns(1, 4)) }, 'arg1[1]', '4') && "@$names" eq 'a b', 'late argument, caller data unchanged');
# A result-only container refinement projects each element after Lean returns.
check(strs(LeanBridge::FinContainers::wrap_all([n(100), $huge->copy])) eq '2,2' && strs(LeanBridge::FinContainers::wrap_all([])) eq '', 'wrapped results');
for my $i (0 .. 999) {
  die "invalid call accepted at $i\n" unless rejected(sub { LeanBridge::FinContainers::mirror_all(ns(10 + $i % 5)) }, 'arg0[0]', '10');
  die "valid call failed at $i\n" unless strs(LeanBridge::FinContainers::mirror_all(ns($i % 10))) eq (9 - $i % 10);
}
$checks += 2000;
print "fin-container-ok:$checks\n";
