use strict;
use warnings;
use Math::BigInt;
use LeanBridge::Subtypes;
my $checks = 0;
sub check { die "failed: $_[1]\n" unless $_[0]; ++$checks; }
sub n { Math::BigInt->new("$_[0]") }
sub rejected {
  my ($call, $parameter, $constructor) = @_;
  my $passed = eval { $call->(); 1 }; my $error = "$@";
  return !$passed && index($error, "$parameter was rejected by $constructor") == 0;
}
sub bound {
  my ($call, $parameter, $limit) = @_;
  my $passed = eval { $call->(); 1 }; my $error = "$@";
  return !$passed && index($error, "$parameter is not below its Fin $limit bound") == 0;
}
sub dies { my ($call) = @_; my $passed = eval { $call->(); 1 }; return !$passed; }
my $hello = "h\x{e9}llo \x{1F642}";
# Nonempty String: Unicode and embedded NUL are ordinary payloads; the empty string is rejected.
check(LeanBridge::Subtypes::shout($hello) eq "$hello!" && LeanBridge::Subtypes::shout("a\0b") eq "a\0b!", 'shout');
check(rejected(sub { LeanBridge::Subtypes::shout('') }, 'arg0', 'Subtypes.checkedWord'), 'empty word');
check(dies(sub { LeanBridge::Subtypes::shout(3) }) && !rejected(sub { LeanBridge::Subtypes::shout(3) }, 'arg0', 'Subtypes.checkedWord'), 'non-text is the String error');
# Even Nat beyond 64 bits.
my $big = Math::BigInt->new(2)->bpow(100);
check(LeanBridge::Subtypes::half(n(42))->bstr eq '21' && LeanBridge::Subtypes::half($big)->bstr eq Math::BigInt->new(2)->bpow(99)->bstr, 'half');
check(rejected(sub { LeanBridge::Subtypes::half(n(7)) }, 'arg0', 'Subtypes.checkedEven'), 'odd');
check(dies(sub { LeanBridge::Subtypes::half(n(-2)) }) && !rejected(sub { LeanBridge::Subtypes::half(n(-2)) }, 'arg0', 'Subtypes.checkedEven'), 'negative is the Nat error');
# Small Int after an unchecked argument.
check(LeanBridge::Subtypes::scale(n(-3), n(-128))->bstr eq '384' && LeanBridge::Subtypes::scale(n(-3), n(127))->bstr eq '-381', 'scale');
check(rejected(sub { LeanBridge::Subtypes::scale(n(-3), n(128)) }, 'arg1', 'Subtypes.checkedSmall') && rejected(sub { LeanBridge::Subtypes::scale(n(-3), n(-129)) }, 'arg1', 'Subtypes.checkedSmall'), 'late rejection');
# Nonempty ByteArray: octet strings.
check(LeanBridge::Subtypes::head("\0\xFF") == 0, 'head');
check(rejected(sub { LeanBridge::Subtypes::head('') }, 'arg0', 'Subtypes.checkedPayload'), 'empty payload');
# A result-only subtype and two checked arguments.
check(LeanBridge::Subtypes::pad(n(21))->bstr eq '42' && LeanBridge::Subtypes::join('ab', 'cd') eq 'abcd', 'pad and join');
check(rejected(sub { LeanBridge::Subtypes::join('ab', '') }, 'arg1', 'Subtypes.checkedWord') && rejected(sub { LeanBridge::Subtypes::join('', 'cd') }, 'arg0', 'Subtypes.checkedWord'), 'join rejections');
# A normalizing constructor: the export sees the constructed value.
check(LeanBridge::Subtypes::clamp(n(250))->bstr eq '100' && LeanBridge::Subtypes::clamp(n(7))->bstr eq '7', 'clamp');
# A checked constructor beside a Fin bound: the bound is checked first.
check(LeanBridge::Subtypes::mix(n(4), n(3))->bstr eq '7', 'mix');
check(bound(sub { LeanBridge::Subtypes::mix(n(4), n(10)) }, 'arg1', '10') && bound(sub { LeanBridge::Subtypes::mix(n(5), n(10)) }, 'arg1', '10'), 'Fin before the constructor');
check(rejected(sub { LeanBridge::Subtypes::mix(n(5), n(3)) }, 'arg0', 'Subtypes.checkedEven'), 'odd beside a valid digit');
my $input = n(5);
check(rejected(sub { LeanBridge::Subtypes::mix($input, n(3)) }, 'arg0', 'Subtypes.checkedEven') && $input->bstr eq '5', 'caller data unchanged');
for my $i (0 .. 999) {
  die "invalid call accepted at $i\n" unless rejected(sub { LeanBridge::Subtypes::half(n(2 * $i + 1)) }, 'arg0', 'Subtypes.checkedEven');
  die "valid call failed at $i\n" unless LeanBridge::Subtypes::half(n(2 * $i))->bstr eq "$i";
}
$checks += 2000;
print "subtype-ok:$checks\n";
