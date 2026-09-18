use strict;
use warnings;
use utf8;
use LeanBridge::Glyphs;
my @points = (__POINTS__);
my @values = map { chr($_) } @points;
my $checks = 0;
sub check { die "Char check failed" unless $_[0]; ++$checks; }
for my $i (0 .. $#points) {
  my $value = $values[$i];
  check(LeanBridge::Glyphs::keep($value) eq $value);
  check(LeanBridge::Glyphs::point($value) == $points[$i]);
  check(LeanBridge::Glyphs::text($value) eq $value);
  check(LeanBridge::Glyphs::choose(LeanBridge::Glyphs::true(), $value, 'x') eq $value);
  check(LeanBridge::Glyphs::choose(LeanBridge::Glyphs::false(), 'x', $value) eq $value);
  check(join('', @{LeanBridge::Glyphs::keep_array(\@values)}) eq join('', @values));
  my $label = LeanBridge::Glyphs::keep_label(LeanBridge::Glyphs::Label->new(marker => $value, line => \@values));
  check($label->marker eq $value && join('', @{$label->line}) eq join('', @values));
  my $rows = LeanBridge::Glyphs::keep_rows([\@values, [], [$value]]);
  check(@$rows == 3 && @{$rows->[1]} == 0 && $rows->[2][0] eq $value);
}
check(LeanBridge::Glyphs::sprout() eq '🌱');
check(@{LeanBridge::Glyphs::keep_array([])} == 0);
for my $bad ('', 'ab', "e\x{301}", '☀️', '🇨🇦', chr(0xd800), chr(0xdfff), chr(0x110000), 65, undef, ['a']) {
  for my $call (sub { LeanBridge::Glyphs::keep($bad) },
      sub { LeanBridge::Glyphs::keep_array(['a', $bad]) },
      sub { LeanBridge::Glyphs::keep_rows([['a'], [$bad]]) },
      sub { LeanBridge::Glyphs::keep_label(LeanBridge::Glyphs::Label->new(marker => $bad, line => \@values)) },
      sub { LeanBridge::Glyphs::keep_label(LeanBridge::Glyphs::Label->new(marker => 'a', line => [$bad])) }) {
    eval { $call->() };
    check($@ ne '');
    check(LeanBridge::Glyphs::keep('🌱') eq '🌱');
  }
}
for (1 .. 1000) {
  my $rows = LeanBridge::Glyphs::keep_rows([\@values, \@values]);
  check(join('', @{$rows->[1]}) eq join('', @values));
}
print "char-ok:$checks\n";
