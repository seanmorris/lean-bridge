use strict;
use warnings;
use Math::BigInt;
use LeanBridge::FinRecords;
my $checks = 0;
sub check { die "failed: $_[1]\n" unless $_[0]; ++$checks; }
sub n { Math::BigInt->new("$_[0]") }
sub some { LeanBridge::FinRecords::Some->new($_[0]) }
sub tile { LeanBridge::FinRecords::Tile->new(digit => (ref $_[0] ? $_[0] : n($_[0])), count => (ref $_[1] ? $_[1] : n($_[1]))) }
sub nest { LeanBridge::FinRecords::Nest->new(inner => tile($_[0], $_[1]), tag => n($_[2])) }
sub late { LeanBridge::FinRecords::Late->new(label => 'ab', items => [n(1), n(2)], digit => n($_[0])) }
sub slot { LeanBridge::FinRecords::Slot->new(maybe => $_[0], count => n(8)) }
sub circle { LeanBridge::FinRecords::Shape::Circle->new(radius => n($_[0])) }
sub row { [tile(0, 1), tile(4, 2), tile(1, 0)] }
# Deep value equality: same classes, same keys, same numbers and text.
sub same {
  my ($x, $y) = @_;
  return !defined $y unless defined $x;
  return 0 if !defined $y || ref($x) ne ref($y);
  return "$x" eq "$y" unless ref $x;
  return $x->bcmp($y) == 0 if ref($x) eq 'Math::BigInt';
  if (ref($x) eq 'ARRAY') {
    return 0 unless @$x == @$y;
    for my $i (0 .. $#$x) { return 0 unless same($x->[$i], $y->[$i]); }
    return 1;
  }
  return 0 unless join(',', sort keys %$x) eq join(',', sort keys %$y);
  for my $key (keys %$x) { return 0 unless same($x->{$key}, $y->{$key}); }
  return 1;
}
# A rejected call names the failed leaf's path and its own bound.
sub rejected {
  my ($call, $path, $bound) = @_;
  my $passed = eval { $call->(); 1 }; my $error = "$@";
  return !$passed && index($error, "$path is not below its Fin $bound bound") == 0;
}
# The input and an independently built snapshot exist before the call; they are compared
# immediately after the rejection, before the caller changes anything back.
sub refused {
  my ($function, $build, $path, $bound) = @_;
  my ($input, $before) = ($build->(), $build->());
  return rejected(sub { $function->($input) }, $path, $bound) && same($input, $before);
}
sub dies { my ($call) = @_; my $passed = eval { $call->(); 1 }; my $error = "$@"; return !$passed && index($error, 'is not below its Fin') < 0; }
my $huge = Math::BigInt->new(2)->bpow(100);
# Malformed shapes fail conversion with their own errors before any bound is walked.
check(dies(sub { LeanBridge::FinRecords::tile_sum({ digit => n(5), count => n(0) }) }), 'plain hash instead of record');
check(dies(sub { LeanBridge::FinRecords::tile_sum(bless({ digit => n(5) }, 'LeanBridge::FinRecords::Tile')) }), 'missing record field');
check(dies(sub { LeanBridge::FinRecords::tile_sum(bless({ digit => n(5), count => n(0), extra => 1 }, 'LeanBridge::FinRecords::Tile')) }), 'extra record field');
check(dies(sub { LeanBridge::FinRecords::Tile->new(digit => n(1)) }), 'short record constructor');
check(dies(sub { LeanBridge::FinRecords::nest_sum(LeanBridge::FinRecords::Nest->new(inner => [n(5), n(0)], tag => n(3))) }), 'product instead of inner record');
check(dies(sub { LeanBridge::FinRecords::shape_size(bless({ radius => n(10) }, 'LeanBridge::FinRecords::Shape')) }), 'variant family instead of case');
check(dies(sub { LeanBridge::FinRecords::shape_size(bless({ radius => n(10) }, 'PretendCircle')) }), 'foreign case class');
check(dies(sub { LeanBridge::FinRecords::gate_open(undef) }), 'undefined variant');
check(dies(sub { LeanBridge::FinRecords::tiles(tile(5, 0)) }), 'record instead of array');
check(dies(sub { LeanBridge::FinRecords::late_sum(LeanBridge::FinRecords::Late->new(label => undef, items => [], digit => n(5))) }), 'undefined label');
# Tile: the digit is Fin 5; any count is valid.
for my $d (0 .. 4) { check(LeanBridge::FinRecords::tile_sum(tile($d, 10))->bstr eq $d + 10, "tile $d"); }
check(LeanBridge::FinRecords::tile_sum(tile(3, $huge->copy))->bstr eq $huge->copy->badd(3)->bstr, 'unbounded count');
check(refused(\&LeanBridge::FinRecords::tile_sum, sub { tile(5, $huge->copy) }, 'arg0.digit', '5'), 'tile at bound');
check(refused(\&LeanBridge::FinRecords::tile_sum, sub { tile(Math::BigInt->new(2)->bpow(70), $huge->copy) }, 'arg0.digit', '5'), 'tile beyond 64 bits');
# Nest: the inner record's own bound and the outer bound are both checked, each under its own path.
check(LeanBridge::FinRecords::nest_sum(nest(4, 6, 2))->bstr eq '210', 'nest valid');
check(refused(\&LeanBridge::FinRecords::nest_sum, sub { nest(5, 6, 2) }, 'arg0.inner.digit', '5'), 'nest inner at bound');
check(refused(\&LeanBridge::FinRecords::nest_sum, sub { nest(4, 6, 3) }, 'arg0.tag', '3'), 'nest tag at bound');
check(LeanBridge::FinRecords::nest_sum(nest(4, 6, 2))->bstr eq '210', 'nest recovery');
# Late: heap fields precede the bound; a rejection leaves them as the caller built them.
check(LeanBridge::FinRecords::late_sum(late(4))->bstr eq '4005', 'late valid');
check(refused(\&LeanBridge::FinRecords::late_sum, sub { late(5) }, 'arg0.digit', '5'), 'late at bound');
check(LeanBridge::FinRecords::late_sum(late(4))->bstr eq '4005', 'late recovery');
# Slot: Option (Fin 0) is valid only when absent.
check(LeanBridge::FinRecords::slot_count(slot(undef))->bstr eq '8', 'slot absent');
check(refused(\&LeanBridge::FinRecords::slot_count, sub { slot(some(n(0))) }, 'arg0.maybe?', '0'), 'slot present');
# Shape: only the active case is checked; the path names the case and field.
check(LeanBridge::FinRecords::shape_size(circle(9))->bstr eq '9', 'circle valid');
check(refused(\&LeanBridge::FinRecords::shape_size, sub { circle(10) }, 'arg0.circle.radius', '10'), 'circle at bound');
check(LeanBridge::FinRecords::shape_size(LeanBridge::FinRecords::Shape::Label->new(text => 'abc'))->bstr eq '1003', 'label');
check(LeanBridge::FinRecords::shape_size(LeanBridge::FinRecords::Shape::Empty->new)->bstr eq '7', 'empty');
# Gate: the never case holds Fin 0, so it is always rejected; the closed case is always valid.
check(LeanBridge::FinRecords::gate_open(LeanBridge::FinRecords::Gate::Closed->new)->bstr eq '1', 'gate closed');
check(refused(\&LeanBridge::FinRecords::gate_open, sub { LeanBridge::FinRecords::Gate::Never->new(value => n(0)) }, 'arg0.never.value', '0'), 'gate never');
# Array Tile: every element; the path carries the failing index.
my $tiles = row();
check(LeanBridge::FinRecords::tiles([])->bstr eq '0', 'tiles empty');
check(LeanBridge::FinRecords::tiles($tiles)->bstr eq '8', 'tiles valid');
for my $k (0 .. 2) {
  my $kept = $tiles->[$k]->{digit};
  $tiles->[$k]->{digit} = n(5);
  my $before = row(); $before->[$k]->{digit} = n(5);
  check(rejected(sub { LeanBridge::FinRecords::tiles($tiles) }, "arg0[$k].digit", '5') && same($tiles, $before), "tiles element $k");
  $tiles->[$k]->{digit} = $kept;
}
check(LeanBridge::FinRecords::tiles($tiles)->bstr eq '8', 'tiles recovery');
# Option Shape: absent, a valid present circle, then an invalid one.
check(LeanBridge::FinRecords::maybe_shape(undef)->bstr eq '99', 'maybe absent');
check(LeanBridge::FinRecords::maybe_shape(some(circle(3)))->bstr eq '3', 'maybe circle');
check(refused(\&LeanBridge::FinRecords::maybe_shape, sub { some(circle(10)) }, 'arg0?.circle.radius', '10'), 'maybe circle at bound');
# Results carrying bounds are produced by Lean and arrive below them.
check(same(LeanBridge::FinRecords::bump(tile(4, 9)), tile(0, 10)), 'bump');
check(refused(\&LeanBridge::FinRecords::bump, sub { tile(5, 9) }, 'arg0.digit', '5'), 'bump at bound');
check(same(LeanBridge::FinRecords::make_shape(n(4)), circle(4)), 'make circle');
check(same(LeanBridge::FinRecords::make_shape(n(23)), LeanBridge::FinRecords::Shape::Label->new(text => '23')), 'make label');
for my $i (0 .. 999) {
  die "round $i failed\n" unless LeanBridge::FinRecords::tile_sum(tile($i % 5, $i))->bstr eq $i % 5 + $i;
  die "rejection round $i failed\n" unless refused(\&LeanBridge::FinRecords::tile_sum, sub { tile(5 + $i, $i) }, 'arg0.digit', '5');
}
$checks += 2000;
print "fin-record-ok:$checks\n";
