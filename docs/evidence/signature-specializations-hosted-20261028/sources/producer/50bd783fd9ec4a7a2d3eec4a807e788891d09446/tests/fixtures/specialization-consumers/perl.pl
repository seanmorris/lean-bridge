use strict;
use warnings;
use utf8;
use Math::BigInt;
use LeanBridge::Specialized;
my $api = 'LeanBridge::Specialized';
my $checks = 0;
sub check { die "Specialization mismatch\n" unless $_[0]; ++$checks; }
sub rejected { my ($call) = @_; my $ok = eval { $call->(); 1 }; return !$ok; }
my $greeting = "h\x{e9}llo \x{1F642}";
my ($true, $false) = (LeanBridge::Specialized::true(), LeanBridge::Specialized::false());
# One generic declaration, three concrete exports; the open declaration is absent.
check(LeanBridge::Specialized::echo_word(0) == 0 && LeanBridge::Specialized::echo_word(4294967295) == 4294967295);
check(LeanBridge::Specialized::echo_text($greeting) eq $greeting && LeanBridge::Specialized::echo_text('') eq '');
my $large = Math::BigInt->new(2)->bpow(200);
check(LeanBridge::Specialized::echo_nat($large)->bstr eq $large->bstr);
my @words = (0, 42, 4294967295);
check(join(',', @{LeanBridge::Specialized::echo_words(\@words)}) eq join(',', @words));
check(!$api->can($_)) for qw(echo choose first duplicate);
# Lean resolved each instance dictionary at build time.
check(LeanBridge::Specialized::choose_word($true, 5) == 5 && LeanBridge::Specialized::choose_word($false, 5) == 37);
check(LeanBridge::Specialized::choose_text($true, $greeting) eq $greeting && LeanBridge::Specialized::choose_text($false, $greeting) eq '');
check(join(',', @{LeanBridge::Specialized::choose_words($true, \@words)}) eq join(',', @words) && !@{LeanBridge::Specialized::choose_words($false, \@words)});
check(LeanBridge::Specialized::double_word(2147483649) == 2);
check(LeanBridge::Specialized::double_nat(Math::BigInt->new(2)->bpow(100))->bstr eq Math::BigInt->new(2)->bpow(101)->bstr);
check(LeanBridge::Specialized::first_text_word($greeting, 9) eq $greeting);
check(LeanBridge::Specialized::plain(1) == 4);
# Each export keeps its own concrete argument checks.
check(rejected(sub { LeanBridge::Specialized::echo_word(4294967296) }));
check(rejected(sub { LeanBridge::Specialized::echo_word(-1) }));
check(rejected(sub { LeanBridge::Specialized::echo_nat(Math::BigInt->new(-1)) }));
check(rejected(sub { LeanBridge::Specialized::choose_word(1, 5) }));
for my $i (0 .. 999) {
  check(LeanBridge::Specialized::choose_word($i % 2 == 0 ? $true : $false, $i) == ($i % 2 == 0 ? $i : 37));
  check(LeanBridge::Specialized::double_word($i) == 2 * $i);
}
print "specialization-ok:$checks\n";
