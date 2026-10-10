use strict;
use warnings;
use Math::BigInt;
use LeanBridge::FinProductArrays;
my $checks = 0;
sub check { die "failed: $_[1]\n" unless $_[0]; ++$checks; }
sub n { Math::BigInt->new("$_[0]") }
sub ok { LeanBridge::FinProductArrays::Ok->new($_[0]) }
sub err { LeanBridge::FinProductArrays::Err->new($_[0]) }
sub rejected {
  my ($call, $path, $bound) = @_;
  my $passed = eval { $call->(); 1 }; my $error = "$@";
  return !$passed && index($error, "$path is not below its Fin $bound bound") == 0;
}
sub dies { my ($call) = @_; my $passed = eval { $call->(); 1 }; my $error = "$@"; return !$passed && index($error, 'is not below its Fin') < 0; }
# Rows compare by component, active branch and that branch's value.
sub text { join ';', map { $_->[0]->bstr . ':' . ref($_->[1]) . ':' . $_->[1]->value->bstr } @{$_[0]} }
# (0, ok 2^100), (2, error 5), (3, ok 6): both endpoints, and ok values no bound applies to.
my $huge = Math::BigInt->new(2)->bpow(100);
my $valid = sub { [[n(0), ok($huge->copy)], [n(2), err(n(5))], [n(3), ok(n(6))]] };
my $expected = $huge->copy->badd(1016)->bstr;
# Malformed shapes fail conversion with their own errors before any bound is walked.
check(dies(sub { LeanBridge::FinProductArrays::rows([[n(1)]]) }), 'short product element');
check(dies(sub { LeanBridge::FinProductArrays::rows([[n(1), n(2)]]) }), 'element without an Except');
check(dies(sub { LeanBridge::FinProductArrays::rows({ 0 => [n(1), ok(n(2))] }) }), 'hash instead of array');
# An empty array is valid, in and out.
check(LeanBridge::FinProductArrays::rows([])->bstr eq '0', 'empty rows');
check(@{LeanBridge::FinProductArrays::reversed([])} == 0, 'empty reversed');
my $rows = $valid->();
check(LeanBridge::FinProductArrays::rows($rows)->bstr eq $expected, 'valid rows');
# A component at its bound is rejected in the first, middle and last element; the path names the index and component.
for my $k (0 .. 2) {
  $rows->[$k][0] = n(4);
  my $before = text($rows);
  check(rejected(sub { LeanBridge::FinProductArrays::rows($rows) }, "arg0[$k].0", '4') && text($rows) eq $before, "component at $k");
  $rows->[$k][0] = $valid->()->[$k][0];
}
# The active error branch is bounded: error 6 is rejected, while ok 6 in the last row passed above.
$rows->[1][1] = err(n(6));
my $before = text($rows);
check(rejected(sub { LeanBridge::FinProductArrays::rows($rows) }, 'arg0[1].1.error', '6') && text($rows) eq $before, 'error branch at bound');
$rows->[1][1] = err(n(5));
# A valid call recovers.
check(text($rows) eq text($valid->()), 'caller rows unchanged');
check(LeanBridge::FinProductArrays::rows($rows)->bstr eq $expected, 'recovery');
# Lean returns the rows reversed, each below its bounds.
check(text(LeanBridge::FinProductArrays::reversed($rows)) eq text([reverse @{$valid->()}]), 'reversed');
for my $i (0 .. 999) {
  die "round $i failed\n" unless LeanBridge::FinProductArrays::rows($rows)->bstr eq $expected;
  $rows->[2][0] = n(4 + $i);
  die "rejection round $i failed\n" unless rejected(sub { LeanBridge::FinProductArrays::rows($rows) }, 'arg0[2].0', '4') && $rows->[2][0]->bstr eq 4 + $i;
  $rows->[2][0] = n(3);
}
$checks += 2000;
print "fin-product-array-ok:$checks\n";
