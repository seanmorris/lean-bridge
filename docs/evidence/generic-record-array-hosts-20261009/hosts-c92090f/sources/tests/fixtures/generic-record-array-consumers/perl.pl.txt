# Array fields and results: Array Nat inside ArrayBox, BoxRow as Array NatBox, and RowBox's Array NatBox field.
sub array_raises { my ($message, $call) = @_; my $ok = eval { $call->(); 1 }; return !$ok && index($@, $message) >= 0; }
sub array_box { LeanBridge::GenericRecords::ArrayBox->new(value => $_[0], count => $_[1]) }
sub row_box { LeanBridge::GenericRecords::RowBox->new(value => $_[0], count => $_[1]) }
sub same_box { my ($left, $value, $count) = @_; return ref($left) eq 'LeanBridge::GenericRecords::NatBox' && $left->value == $value && $left->count == $count; }
sub same_nats { my ($left, @right) = @_; return ref($left) eq 'ARRAY' && @$left == @right && !grep { $left->[$_] != $right[$_] } 0 .. $#right; }
my $array_wide = n(2)->bpow(70);
my $pushed = LeanBridge::GenericRecords::push_count(array_box([n(1), $array_wide, n(3)], n(3)));
check(ref($pushed) eq 'LeanBridge::GenericRecords::ArrayBox' && same_nats($pushed->value, 1, $array_wide, 3, 3) && $pushed->count == 4);
my $pushed_empty = LeanBridge::GenericRecords::push_count(array_box([], n(0)));
check(same_nats($pushed_empty->value, 0) && $pushed_empty->count == 1);
my $array_input = [n(1), $array_wide, n(3)];
my $array_record = array_box($array_input, n(3));
check(same_nats(LeanBridge::GenericRecords::push_count($array_record)->value, 1, $array_wide, 3, 3) && same_nats($array_input, 1, $array_wide, 3) && $array_record->count == 3);
my $row = [nat_box(2, 3), LeanBridge::GenericRecords::NatBox->new(value => $array_wide->copy, count => n(1)), nat_box(0, 5)];
my $row_expected = $array_wide->copy->badd(6);
check(LeanBridge::GenericRecords::row_total($row) == $row_expected && LeanBridge::GenericRecords::row_total([]) == 0);
check(@$row == 3 && same_box($row->[1], $array_wide, 1));
my $made = LeanBridge::GenericRecords::row_of(n(3));
check(@$made == 3 && same_box($made->[0], 0, 3) && same_box($made->[2], 2, 3) && @{LeanBridge::GenericRecords::row_of(n(0))} == 0 && LeanBridge::GenericRecords::row_total($made) == 9);
check(LeanBridge::GenericRecords::row_box_sum(row_box($row, n(4))) == $row_expected && LeanBridge::GenericRecords::row_box_sum(row_box([], n(9))) == 9 && LeanBridge::GenericRecords::row_box_sum(row_box($made, n(0))) == 3);
# Invalid members at the first, middle and last position are the generated XS's exact errors; the caller's input is unchanged and the next valid call succeeds.
my @array_members = ([n(-1), 'Nat cannot be negative'], [1, 'Expected Math::BigInt'], ['1', 'Expected Math::BigInt'], [undef, 'Expected Math::BigInt']);
my @row_members = ([nat_box(-1, 0), 'Nat cannot be negative'], [nat_box(0, -1), 'Nat cannot be negative']
  , [LeanBridge::GenericRecords::NatBox->new(value => 1, count => n(0)), 'Expected Math::BigInt']
  , [LeanBridge::GenericRecords::NatBoxAgain->new(value => n(1), count => n(0)), 'Expected exact LeanBridge::GenericRecords::NatBox']
  , [[1, 0], 'Expected exact LeanBridge::GenericRecords::NatBox'], [1, 'Expected exact LeanBridge::GenericRecords::NatBox']);
for my $position (0 .. 2) {
  for my $case (@array_members) {
    my ($member, $message) = @$case;
    my $values = [n(1), $array_wide, n(3)];
    $values->[$position] = $member;
    check(array_raises($message, sub { LeanBridge::GenericRecords::push_count(array_box($values, n(3))) }) && @$values == 3
      && (defined $member ? $values->[$position] eq $member : !defined $values->[$position]));
    check(same_nats(LeanBridge::GenericRecords::push_count(array_box([n(1), $array_wide, n(3)], n(3)))->value, 1, $array_wide, 3, 3));
  }
  for my $case (@row_members) {
    my ($member, $message) = @$case;
    my $broken = [@$row];
    $broken->[$position] = $member;
    check(array_raises($message, sub { LeanBridge::GenericRecords::row_total($broken) }) && @$broken == 3 && $broken->[$position] eq $member);
    check(array_raises($message, sub { LeanBridge::GenericRecords::row_box_sum(row_box($broken, n(4))) }) && $broken->[$position] eq $member);
    check(LeanBridge::GenericRecords::row_total($row) == $row_expected && LeanBridge::GenericRecords::row_box_sum(row_box($row, n(4))) == $row_expected);
  }
}
# Non-array Arrays, negative or non-Math::BigInt counts beside Array fields, a negative rowOf argument and wrong records are refused too.
for my $case (
  [sub { LeanBridge::GenericRecords::push_count(array_box(5, n(1))) }, 'Expected a plain untied array reference'],
  [sub { LeanBridge::GenericRecords::row_total(nat_box(1, 0)) }, 'Expected a plain untied array reference'],
  [sub { LeanBridge::GenericRecords::row_total({ 0 => nat_box(1, 0) }) }, 'Expected a plain untied array reference'],
  [sub { LeanBridge::GenericRecords::row_box_sum(row_box(nat_box(1, 0), n(1))) }, 'Expected a plain untied array reference'],
  [sub { LeanBridge::GenericRecords::push_count(array_box([n(1)], n(-1))) }, 'Nat cannot be negative'],
  [sub { LeanBridge::GenericRecords::row_box_sum(row_box($row, n(-1))) }, 'Nat cannot be negative'],
  [sub { LeanBridge::GenericRecords::row_box_sum(row_box($row, 4)) }, 'Expected Math::BigInt'],
  [sub { LeanBridge::GenericRecords::row_of(n(-1)) }, 'Nat cannot be negative'],
  [sub { LeanBridge::GenericRecords::push_count(row_box($row, n(1))) }, 'Expected exact LeanBridge::GenericRecords::ArrayBox'],
  [sub { LeanBridge::GenericRecords::row_box_sum(array_box([n(1)], n(1))) }, 'Expected exact LeanBridge::GenericRecords::RowBox'],
) {
  my ($call, $message) = @$case;
  check(array_raises($message, $call));
  check(LeanBridge::GenericRecords::row_box_sum(row_box($row, n(4))) == $row_expected);
}
# One thousand Array rounds: a rejected member, then valid Array input and result calls.
for my $round_index (0 .. 999) {
  my $position = $round_index % 3;
  my $size = $round_index % 4;
  my @values = (n(1), $array_wide, n(3));
  $values[$position] = n(-1);
  my $rejected_member = array_raises('Nat cannot be negative', sub { LeanBridge::GenericRecords::push_count(array_box([@values], n($round_index))) });
  $values[$position] = (n(1), $array_wide, n(3))[$position];
  my $round_row = LeanBridge::GenericRecords::row_of(n($size));
  my @broken = @$row;
  $broken[$position] = nat_box(-1, 0);
  my $triangle = $size * ($size ? $size - 1 : 0) / 2;
  my $round_pushed = LeanBridge::GenericRecords::push_count(array_box([@values], n($round_index)));
  check($rejected_member && same_nats($round_pushed->value, 1, $array_wide, 3, $round_index) && $round_pushed->count == $round_index + 1
    && @$round_row == $size && LeanBridge::GenericRecords::row_total($round_row) == $size * $triangle
    && LeanBridge::GenericRecords::row_box_sum(row_box($round_row, n($round_index))) == $round_index + $triangle
    && array_raises('Nat cannot be negative', sub { LeanBridge::GenericRecords::row_box_sum(row_box([@broken], n($round_index))) }));
}
