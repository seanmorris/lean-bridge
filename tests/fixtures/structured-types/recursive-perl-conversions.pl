use strict;
use warnings;
use utf8;
use B;
use Encode ();
require './fixture.pl';
our $checks;
open my $input, '<', 'types.json' or die $!;
my $types = JSON::PP::decode_json(do { local $/; <$input> }); close $input;
my %types = map { (($_->{ref}{id} // $_->{ref}{name} // '') => $_->{index}) } @$types;
sub echo_type { LeanBridge::Recursive::Probe::echo($types{$_[0]}, $_[1]) }
sub echo { echo_type('lean:Recursive.' . $_[0], $_[1]) }

my $scalars = payload();
my $copy = echo('Scalars', $scalars);
check(same_value($copy, $scalars));
check(refaddr($copy) != refaddr($scalars));
check(refaddr($copy->natural) != refaddr($scalars->natural));
check(utf8::is_utf8($copy->text) && !utf8::is_utf8($copy->bytes));
check(utf8::is_utf8($copy->char));
for my $key (qw(u8 u16 u32 u64 i8 i16 i32 i64 word signedWord f32 f64)) { check($copy->$key() == $scalars->$key()); }
my $special = echo('Scalars', payload(f32 => POSIX::nan(0), f64 => -0.0));
check(isnan($special->f32)); check(pack('d>', $special->f64) eq pack('d>', -0.0));
$special = echo('Scalars', payload(f32 => -HUGE_VAL(), f64 => HUGE_VAL()));
check($special->f32 == -HUGE_VAL() && $special->f64 == HUGE_VAL());
$special = echo('Scalars', payload(f32 => 1.1));
check($special->f32 == unpack('f', pack('f', 1.1)));
for my $text ('', "a\0b", '🌱', pack('C', 233)) {
  my $value = echo_type('string', $text); check($value eq $text); check(utf8::is_utf8($value));
}
for my $char ("\0", pack('C', 233), '🌱', chr(0x10ffff)) { check(echo_type('char', $char) eq $char); }
for my $integer (0, 1, -1, 4294967295, -4294967295, '1' . ('0' x 1000)) {
  my $value = Math::BigInt->new($integer);
  check(echo_type('int', $value)->bcmp($value) == 0);
  if (!$value->is_neg()) { check(echo_type('nat', $value)->bcmp($value) == 0); }
}

my $leaf = LeanBridge::Recursive::Tree::Leaf->new(payload => $scalars);
my $tree = LeanBridge::Recursive::Tree::Branch->new(children => [$leaf, $leaf]);
my $out = echo('Tree', $tree);
check(same_value($out, $tree)); check(refaddr($out->children->[0]) != refaddr($out->children->[1]));
$out->children->[0]->payload->{text} = 'changed'; check($out->children->[1]->payload->text eq $scalars->text);
check($tree->children->[0]->payload->text eq $scalars->text);
my $empty = LeanBridge::Recursive::Tree::Branch->new(children => []);
check(same_value(echo('Tree', $empty), $empty));
for my $marker (undef, LeanBridge::Recursive::Some->new(undef), LeanBridge::Recursive::Some->new(LeanBridge::Recursive::Some->new(undef))) {
  for my $outcome (LeanBridge::Recursive::Ok->new([$tree, $empty]), LeanBridge::Recursive::Err->new("error\0🌱")) {
    my $value = envelope_value(marker => $marker, outcome => $outcome, fallback => undef);
    check(same_value(echo('Envelope', $value), $value));
  }
}
my $left = LeanBridge::Recursive::LeftTree::Next->new(right => LeanBridge::Recursive::RightTree::Many->new(lefts => [LeanBridge::Recursive::LeftTree::Leaf->new(value => 9)]));
check(same_value(echo('LeftTree', $left), $left));
my $right = LeanBridge::Recursive::RightTree::Many->new(lefts => [$left, $left]);
check(same_value(echo('RightTree', $right), $right));
my $link = LeanBridge::Recursive::Link->new(tail => LeanBridge::Recursive::Some->new(LeanBridge::Recursive::Link->new(tail => undef)));
check(same_value(echo('Link', $link), $link));
my $result_link = LeanBridge::Recursive::ResultLink->new(tail => LeanBridge::Recursive::Ok->new(LeanBridge::Recursive::ResultLink->new(tail => LeanBridge::Recursive::Err->new('end'))));
check(same_value(echo('ResultLink', $result_link), $result_link));
for my $marker (LeanBridge::Recursive::Marker::Empty->new(), LeanBridge::Recursive::Marker::Unit->new(value => undef), LeanBridge::Recursive::Marker::Next->new(value => LeanBridge::Recursive::Marker::Empty->new())) {
  check(same_value(echo('Marker', $marker), $marker));
}
check(same_value(echo('EmptyRecord', LeanBridge::Recursive::EmptyRecord->new()), LeanBridge::Recursive::EmptyRecord->new()));
my $wide = LeanBridge::Recursive::Wide::Leaf->new(value => 17);
for (1 .. 127) { $wide = LeanBridge::Recursive::Wide::Next->new((map { ('field' . $_ => $_) } 0 .. 254), child => $wide); }
my $wide_copy = echo('Wide', $wide);
for (1 .. 127) {
  check(refaddr($wide) != refaddr($wide_copy));
  for my $i (0 .. 254) { check($wide_copy->{'field' . $i} == $i); }
  $wide = $wide->child; $wide_copy = $wide_copy->child;
}
check($wide_copy->value == 17);

my $spine = LeanBridge::Recursive::Spine::Leaf->new(value => 7);
for (1 .. 127) { $spine = LeanBridge::Recursive::Spine::Next->new(value => $spine); }
my $spine_copy = echo('Spine', $spine);
for (1 .. 127) { check(refaddr($spine) != refaddr($spine_copy)); $spine = $spine->value; $spine_copy = $spine_copy->value; }
check($spine_copy->value == 7);
for (1 .. 128) { $spine = LeanBridge::Recursive::Spine::Next->new(value => $spine); }
rejects(qr/depth/, sub { echo('Spine', $spine) }); clean();
my $cycle = LeanBridge::Recursive::Spine::Next->new(value => undef); $cycle->{value} = $cycle;
rejects(qr/Cyclic/, sub { echo('Spine', $cycle) }); $cycle->{value} = undef; clean();
$link->{tail}->{value} = $link; rejects(qr/Cyclic/, sub { echo('Link', $link) }); $link->{tail} = undef; clean();
my $never = bless {value => undef}, 'LeanBridge::Recursive::Never::Again';
rejects(qr/no finite value/, sub { echo('Never', $never) }); clean();

my @invalid = (
  [unit => 0], [bool => 1], [bool => 'true'], [u8 => 256], [u8 => -1], [u16 => 65536], [u32 => 4294967296],
  [u64 => -1], [u64 => 1.5], [i8 => -129], [i8 => 128], [i16 => -32769], [i16 => 32768],
  [i32 => -2147483649], [i32 => 2147483648], [i64 => 18446744073709551615], [signedWord => 18446744073709551615],
  [natural => Math::BigInt->new(-1)], [natural => Math::BigInt->bnan()], [integer => Math::BigInt->binf()], [integer => 3],
  [f32 => '1.5x'], [f64 => undef], [bytes => '🌱'], [char => 'ab'], [char => ''], [text => 17], [word => -1]
);
for my $change (@invalid) { rejects(qr/requires|Expected|out of range|negative|finite/, sub { echo('Scalars', payload(@$change)) }); clean(); }
my $broken = pack('C*', 0xed, 0xa0, 0x80); Encode::_utf8_on($broken);
for my $kind (qw(string char)) { rejects(qr/Unicode/, sub { echo_type($kind, $broken) }); clean(); }
for my $value ({%$scalars}, bless({%$scalars}, 'ForeignScalars'), bless({%$scalars, extra => 1}, 'LeanBridge::Recursive::Scalars')) {
  rejects(qr/Expected|fields/, sub { echo('Scalars', $value) }); clean();
}
my $missing = payload(); delete $missing->{char}; rejects(qr/fields/, sub { echo('Scalars', $missing) });
rejects(qr/exact generated variant/, sub { echo('Tree', $scalars) });
rejects(qr/exact generated variant/, sub { echo('Tree', bless({children => []}, 'LeanBridge::Recursive::Tree')) });
my @sparse; $sparse[1] = $empty;
rejects(qr/Sparse/, sub { echo('Tree', LeanBridge::Recursive::Tree::Branch->new(children => \@sparse)) }); clean();
{
  package TiedGraphArray;
  sub TIEARRAY { bless {}, shift }
  sub FETCHSIZE { die 'tied array should not be fetched' }
  package TiedGraphHash;
  sub TIEHASH { bless {}, shift }
  sub FIRSTKEY { die 'tied hash should not be fetched' }
  package GraphMagic;
  sub TIESCALAR { bless {callback => $_[1]}, $_[0] }
  sub FETCH { $_[0]->{callback}->() }
  package GraphBigInt;
  our @ISA = ('Math::BigInt');
  our $callback;
  sub bstr { $callback->(); '17' }
}
tie my @tied, 'TiedGraphArray';
rejects(qr/untied/, sub { echo('Tree', LeanBridge::Recursive::Tree::Branch->new(children => \@tied)) });
tie my %tied, 'TiedGraphHash';
rejects(qr/untied/, sub { echo('Scalars', bless(\%tied, 'LeanBridge::Recursive::Scalars')) }); clean();
my $magic = payload(); tie $magic->{text}, 'GraphMagic', sub { die "magic failure\n" };
rejects(qr/magic failure/, sub { echo('Scalars', $magic) }); clean();
my $mutated = payload(natural => bless({}, 'GraphBigInt'));
{
  local $GraphBigInt::callback = sub { %$mutated = (); };
  my $value = echo('Scalars', $mutated);
  check($value->natural->bcmp(17) == 0 && $value->text eq "A\0🌱");
}
my $mutating_leaf = LeanBridge::Recursive::Tree::Leaf->new(payload => payload(natural => bless({}, 'GraphBigInt')));
my $mutating_children = [$mutating_leaf, $empty];
{
  local $GraphBigInt::callback = sub { @$mutating_children = (); };
  my $value = echo('Tree', LeanBridge::Recursive::Tree::Branch->new(children => $mutating_children));
  check(@{$value->children} == 2 && $value->children->[0]->payload->natural->bcmp(17) == 0);
}
{
  local $GraphBigInt::callback = sub { my @grow = (1) x 20000; check(scalar(@grow) == 20000); my @nested = echo('Tree', $empty); check(@nested == 1); };
  my @results = echo('Scalars', payload(natural => bless({}, 'GraphBigInt')));
  check(@results == 1 && $results[0]->natural->bcmp(17) == 0);
}
clean();

my $exception = bless {}, 'GraphException';
{
  no warnings qw(redefine once);
  local *Math::BigInt::new = sub { die $exception; };
  my $ok = eval { echo('Tree', $tree); 1 };
  check(!$ok && refaddr($@) == refaddr($exception));
}
clean(); graph_reset();
my $before_refs = identity_count($tree);
echo('Tree', $tree); my $baseline = snapshot();
check($baseline->[4] == 1); clean();
my ($input_failures, $output_failures) = (0, 0);
local $SIG{USR1} = sub { die "interrupted Perl graph conversion\n" };
for my $signal (0, 1) {
  for my $point (1 .. $baseline->[3]) {
    graph_reset(0, $point, 0, $signal);
    rejects($signal ? qr/interrupted/ : qr/injected/, sub { echo('Tree', $tree) });
    my $state = snapshot();
    check($state->[4] <= 1 && $state->[5] == 0); clean();
    if (!$signal) { if ($state->[4]) { ++$output_failures; } else { ++$input_failures; } }
  }
}
for my $point (1 .. $baseline->[2]) {
  graph_reset($point); rejects(qr/allocation/, sub { echo('Tree', $tree) }); clean();
}
graph_reset(); check(identity_count($tree) == $before_refs);
check($input_failures && $output_failures);

my ($units) = grep { $_->{kind} eq 'array' && $_->{ref}{arguments}[0]{name} && $_->{ref}{arguments}[0]{name} eq 'unit' } @$types;
my $unit_values = [(undef) x 131071];
my $unit_copy = LeanBridge::Recursive::Probe::echo($units->{index}, $unit_values);
check(@$unit_copy == 131071 && !defined($unit_copy->[131070]));
push @$unit_values, undef;
rejects(qr/node/, sub { LeanBridge::Recursive::Probe::echo($units->{index}, $unit_values) }); clean();
my $long = 'a' x (7 * 1024 * 1024); check(echo_type('string', $long) eq $long);
rejects(qr/storage limit/, sub { echo_type('string', 'a' x (9 * 1024 * 1024)) }); clean();
check(snapshot()->[5] == 0);

my ($option_type) = grep { $_->{kind} eq 'option' && ($_->{ref}{arguments}[0]{id} // '') eq 'lean:Recursive.Tree' } @$types;
my ($result_type) = grep { $_->{kind} eq 'result' && ($_->{ref}{arguments}[0]{constructor} // '') eq 'tuple' } @$types;
my ($list_type) = grep { $_->{kind} eq 'list' && ($_->{ref}{arguments}[0]{id} // '') eq 'lean:Recursive.Tree' } @$types;
for my $entry (
  [$option_type, LeanBridge::Recursive::Some->new($tree)],
  [$result_type, LeanBridge::Recursive::Ok->new([$tree, $empty])],
  [$list_type, [$tree, $empty]]
) {
  graph_reset(0, 0, 1);
  rejects(qr/Invalid native/, sub { LeanBridge::Recursive::Probe::echo($entry->[0]{index}, $entry->[1]) });
  check(snapshot()->[4] == 1 && snapshot()->[5] == 1); clean();
}
graph_reset();
for my $value (bless({}, 'LeanBridge::Recursive::Some'), bless({value => $tree, extra => 1}, 'LeanBridge::Recursive::Some'), $tree) {
  rejects(qr/fields|Expected/, sub { LeanBridge::Recursive::Probe::echo($option_type->{index}, $value) }); clean();
}
for my $value (LeanBridge::Recursive::Ok->new([$tree]), LeanBridge::Recursive::Err->new($tree), LeanBridge::Recursive::Some->new($tree)) {
  rejects(qr/Prod|Expected/, sub { LeanBridge::Recursive::Probe::echo($result_type->{index}, $value) }); clean();
}

my @bad_outputs = (['Tree', $tree, 1], ['Spine', LeanBridge::Recursive::Spine::Next->new(value => LeanBridge::Recursive::Spine::Leaf->new(value => 3)), 7]);
for my $entry (@bad_outputs) {
  graph_reset(0, 0, $entry->[2]); rejects(qr/Invalid native/, sub { echo($entry->[0], $entry->[1]) });
  check(snapshot()->[4] == 1 && snapshot()->[5] == 1); clean();
}
for my $entry ([unit => undef], [bool => LeanBridge::Recursive::false()], [char => 'a'], [string => 'hello'], [bytes => 'abc'], [nat => Math::BigInt->new(17)], [int => Math::BigInt->new(-17)]) {
  my ($kind, $value) = @$entry;
  my @modes = (1);
  push @modes, 2, 3 if $kind =~ /^(string|bytes|nat|int)$/;
  push @modes, 4 if $kind =~ /^(nat|int)$/;
  push @modes, 5 if $kind eq 'string'; push @modes, 6 if $kind eq 'int';
  for my $mode (@modes) {
    graph_reset(0, 0, $mode); rejects($mode == 3 ? qr/storage limit/ : qr/Invalid native/, sub { echo_type($kind, $value) });
    check(snapshot()->[5] == ($mode == 3 ? 0 : 1)); clean();
  }
}
graph_reset(); check(same_value(echo('Tree', $tree), $tree)); clean();
print JSON::PP->new->canonical->encode({ checks => $checks, checkpoints => $baseline->[3], allocations => $baseline->[2],
  inputFailures => $input_failures, outputFailures => $output_failures, perl_identity() }), "\n";
