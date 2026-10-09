use strict;
use warnings;
use utf8;
use Math::BigInt;
use LeanBridge::GenericRecords;
my $api = 'LeanBridge::GenericRecords';
my $checks = 0;
sub check { die "Generic record mismatch at line " . (caller)[2] . "\n" unless $_[0]; ++$checks; }
sub rejected { my ($call) = @_; my $ok = eval { $call->(); 1 }; return !$ok; }
sub some { LeanBridge::GenericRecords::Some->new($_[0]) }
sub n { Math::BigInt->new("$_[0]") }
sub nat_box { LeanBridge::GenericRecords::NatBox->new(value => n($_[0]), count => n($_[1])) }
# Each alias is its own blessed record with the structure's fields instantiated; Nat fields are Math::BigInt.
my $box = nat_box(4, 1);
my $bumped = LeanBridge::GenericRecords::bump($box);
check(ref($bumped) eq 'LeanBridge::GenericRecords::NatBox' && $bumped->value == 5 && $bumped->count == 2 && $box->value == 4);
my $again = LeanBridge::GenericRecords::again(LeanBridge::GenericRecords::NatBoxAgain->new(value => n(4), count => n(1)));
check(ref($again) eq 'LeanBridge::GenericRecords::NatBoxAgain' && $again->value == 8 && $again->count == 1);
# Two aliases of one application are two distinct classes with the same layout; each call checks the exact class.
check(rejected(sub { LeanBridge::GenericRecords::bump(LeanBridge::GenericRecords::NatBoxAgain->new(value => n(1), count => n(2))) }));
check(rejected(sub { LeanBridge::GenericRecords::again(nat_box(1, 2)) }));
my $greeting = "h\x{e9}llo \x{1F642}";
my $shouted = LeanBridge::GenericRecords::shout(LeanBridge::GenericRecords::TextBox->new(value => $greeting, count => n(3)));
check($shouted->value eq "$greeting!" && $shouted->count == 3);
my $swapped = LeanBridge::GenericRecords::swap_named(LeanBridge::GenericRecords::WordPair->new(first => 'a', second => n(1)));
check($swapped->first eq 'a!' && $swapped->second == 2);
# A parameter instantiated with Option Nat and a List of a named instantiation.
check(LeanBridge::GenericRecords::or_zero(LeanBridge::GenericRecords::MaybeBox->new(value => some(n(5)), count => n(2))) == 7);
check(LeanBridge::GenericRecords::or_zero(LeanBridge::GenericRecords::MaybeBox->new(value => undef, count => n(2))) == 2);
my $huge = Math::BigInt->new(2)->bpow(70);
my $boxes = [nat_box(1, 0), nat_box(2, 0), nat_box($huge, 0)];
check(LeanBridge::GenericRecords::total($boxes)->bstr eq $huge->copy->badd(3)->bstr && LeanBridge::GenericRecords::total([]) == 0);
my $first = LeanBridge::GenericRecords::first_boxes(n(2));
check(ref($first) eq 'LeanBridge::GenericRecords::Some' && @{$first->value} == 2 && $first->value->[1]->value == 1 && $first->value->[1]->count == 2);
check(!defined LeanBridge::GenericRecords::first_boxes(n(0)));
# A pair of two named instantiations.
check(LeanBridge::GenericRecords::unpair(LeanBridge::GenericRecords::BoxPair->new(first => nat_box(3, 0), second => LeanBridge::GenericRecords::TextBox->new(value => 'abcd', count => n(0)))) == 7);
# A universe-polymorphic structure instantiated at Type.
my $retagged = LeanBridge::GenericRecords::retag(LeanBridge::GenericRecords::TaggedNat->new(tag => 't', payload => n(1)));
check($retagged->tag eq 't#' && $retagged->payload == 2);
# A phantom argument: the instantiation names Marker, which no field carries.
check(LeanBridge::GenericRecords::relabel(LeanBridge::GenericRecords::MarkerTag->new(label => 'm'))->label eq 'm?');
# Field and shape checks stay exact: wrong field types, wrong records, missing and extra fields are refused.
check(rejected(sub { LeanBridge::GenericRecords::bump(LeanBridge::GenericRecords::NatBox->new(value => 'four', count => n(1))) }));
check(rejected(sub { LeanBridge::GenericRecords::bump(LeanBridge::GenericRecords::NatBox->new(value => 4, count => n(1))) }));
check(rejected(sub { LeanBridge::GenericRecords::bump(nat_box(-1, 1)) }));
check(rejected(sub { LeanBridge::GenericRecords::bump({ value => n(4), count => n(1) }) }));
check(rejected(sub { LeanBridge::GenericRecords::bump(bless({ value => n(4) }, 'LeanBridge::GenericRecords::NatBox')) }));
check(rejected(sub { LeanBridge::GenericRecords::bump(bless({ value => n(4), count => n(1), extra => 1 }, 'LeanBridge::GenericRecords::NatBox')) }));
check(rejected(sub { LeanBridge::GenericRecords::unpair(LeanBridge::GenericRecords::BoxPair->new(first => nat_box(3, 0), second => nat_box(4, 0))) }));
check(rejected(sub { LeanBridge::GenericRecords::total([nat_box(1, 0), [1, 0]]) }));
check(!$api->can($_)) for qw(swap Pair Box);
for my $i (0 .. 999) {
  my $round = LeanBridge::GenericRecords::bump(nat_box($i, $i));
  die "round $i failed\n" unless $round->value == $i + 1 && $round->count == $i + 1;
}
$checks += 1000;
print "generic-records-ok:$checks\n";
