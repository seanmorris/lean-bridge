use strict;
use warnings;
use LeanBridge::Words;
my @us = (0, 1, 4294967295, 9007199254740993, 18446744073709551615);
my @ss = (-9223372036854775808, -9007199254740993, -1, 0, 9223372036854775807);
my $checks = 0;
sub check { die "Platform integer mismatch" unless $_[0]; ++$checks; }
check(LeanBridge::Words::word_bits() == 64);
for my $i (0 .. $#us) {
  my ($u, $s) = ($us[$i], $ss[$i]);
  check(LeanBridge::Words::keep_unsigned($u) == $u);
  check(LeanBridge::Words::keep_signed($s) == $s);
  check(LeanBridge::Words::unsigned_text($u) eq "$u");
  check(LeanBridge::Words::signed_text($s) eq "$s");
  check(LeanBridge::Words::advance_unsigned($u) == ($i == 4 ? 0 : $u + 1));
  check(LeanBridge::Words::advance_signed($s) == ($i == 4 ? $ss[0] : $s + 1));
}
for my $name ('unsigned', 'signed') {
  my @bads = $name eq 'unsigned' ? (-1, 1.8446744073709552e19) : (18446744073709551615, -9.223372036854778e18);
  push @bads, 1.5, '1', undef, [1];
  no strict 'refs';
  for my $bad (@bads) {
    for my $call (sub { &{"LeanBridge::Words::keep_$name"}($bad) },
        sub { &{"LeanBridge::Words::keep_${name}_values"}([0, $bad]) },
        sub { &{"LeanBridge::Words::keep_${name}_rows"}([[0], [$bad]]) },
        sub { LeanBridge::Words::keep_sample(LeanBridge::Words::Sample->new(natural => $name eq 'unsigned' ? $bad : 1, integer => $name eq 'signed' ? $bad : -1, unsignedValues => \@us, signedValues => \@ss)) },
        sub { LeanBridge::Words::keep_sample(LeanBridge::Words::Sample->new(natural => 1, integer => -1, unsignedValues => $name eq 'unsigned' ? [$bad] : \@us, signedValues => $name eq 'signed' ? [$bad] : \@ss)) }) {
      eval { $call->() };
      check($@ ne '');
      check(LeanBridge::Words::keep_signed(-1) == -1);
    }
  }
}
for (1 .. 1000) {
  my $sample = LeanBridge::Words::keep_sample(LeanBridge::Words::Sample->new(natural => $us[4], integer => $ss[0], unsignedValues => \@us, signedValues => \@ss));
  check($sample->natural == $us[4] && $sample->integer == $ss[0]);
  check(join(',', @{$sample->unsignedValues}) eq join(',', @us));
  check(join(',', @{$sample->signedValues}) eq join(',', @ss));
  check(join(',', @{LeanBridge::Words::keep_unsigned_values(\@us)}) eq join(',', @us));
  check(join(',', @{LeanBridge::Words::keep_signed_values(\@ss)}) eq join(',', @ss));
  my $ur = LeanBridge::Words::keep_unsigned_rows([\@us, []]);
  my $sr = LeanBridge::Words::keep_signed_rows([\@ss, []]);
  check(@$ur == 2 && @{$ur->[1]} == 0 && join(',', @{$ur->[0]}) eq join(',', @us));
  check(@$sr == 2 && @{$sr->[1]} == 0 && join(',', @{$sr->[0]}) eq join(',', @ss));
}
print "word-ok:$checks\n";
