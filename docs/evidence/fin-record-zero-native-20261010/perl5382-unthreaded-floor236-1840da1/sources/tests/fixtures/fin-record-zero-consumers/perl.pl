use strict;
use warnings;
use Math::BigInt;
use LeanBridge::FinRecordZero;
my $checks = 0;
sub check { die "failed: $_[1]\n" unless $_[0]; ++$checks; }
sub n { Math::BigInt->new("$_[0]") }
sub fields {
  my ($member, $digit) = @_;
  $member //= ''; $digit //= 0;
  return LeanBridge::FinRecordZero::Fields->new(label => 'kept', payload => [n(7), Math::BigInt->new(2)->bpow(100)],
    array => $member eq 'array' ? [n($digit)] : [], list => $member eq 'list' ? [n($digit)] : []);
}
sub same {
  my ($a, $b) = @_;
  return 0 if ref($a) ne ref($b);
  return "$a" eq "$b" unless ref($a);
  return $a->bcmp($b) == 0 if ref($a) eq 'Math::BigInt';
  if (ref($a) eq 'ARRAY') {
    return 0 unless @$a == @$b;
    for my $k (0 .. $#$a) { return 0 unless same($a->[$k], $b->[$k]); }
    return 1;
  }
  return 0 unless join(',', sort keys %$a) eq join(',', sort keys %$b);
  for my $key (keys %$a) { return 0 unless same($a->{$key}, $b->{$key}); }
  return 1;
}
sub refused {
  my ($call, $build, $path) = @_;
  my ($value, $before) = ($build->(), $build->());
  my $accepted = eval { $call->($value); 1 }; my $error = "$@";
  return !$accepted && index($error, "$path is not below its Fin 0 bound") == 0 && same($value, $before);
}
for my $call (\&LeanBridge::FinRecordZero::array_records, \&LeanBridge::FinRecordZero::list_records) {
  check(same($call->([]), []), 'empty record collection');
  for my $digit (0, 1, Math::BigInt->new(2)->bpow(100)) {
    check(refused($call, sub { [LeanBridge::FinRecordZero::Zero->new(digit => n($digit))] }, 'arg0[0].digit'), 'populated record collection');
  }
  check(same($call->([]), []), 'record recovery');
}
check(same(LeanBridge::FinRecordZero::field_collections(fields()), fields()), 'empty fields and result');
for my $member ('array', 'list') {
  for my $digit (0, 1, Math::BigInt->new(2)->bpow(100)) {
    check(refused(\&LeanBridge::FinRecordZero::field_collections, sub { fields($member, $digit) }, "arg0.$member\[0]"), 'populated field');
  }
}
check(same(LeanBridge::FinRecordZero::field_collections(fields()), fields()), 'field recovery');
for my $call (\&LeanBridge::FinRecordZero::array_fields, \&LeanBridge::FinRecordZero::list_fields) {
  check(same($call->([]), []), 'empty outer collection');
  check(same($call->([map { fields() } 0..2]), [map { fields() } 0..2]), 'populated outer collection of empty fields');
  for my $index (0..2) {
    for my $member ('array', 'list') {
      my $build = sub { [map { $_ == $index ? fields($member, 0) : fields() } 0..2] };
      check(refused($call, $build, "arg0[$index].$member\[0]"), 'nested field rejection');
      check(same($call->([map { fields() } 0..2]), [map { fields() } 0..2]), 'nested field recovery');
    }
  }
}
for my $index (0..999) {
  check(same(LeanBridge::FinRecordZero::field_collections(fields()), fields()), 'round valid');
  my $member = $index % 2 ? 'list' : 'array';
  check(refused(\&LeanBridge::FinRecordZero::field_collections, sub { fields($member, $index) }, "arg0.$member\[0]"), 'round rejection');
}
print "fin-record-zero-ok:$checks\n";
