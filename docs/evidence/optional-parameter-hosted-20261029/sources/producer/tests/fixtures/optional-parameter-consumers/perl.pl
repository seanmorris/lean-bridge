use strict;
use warnings;
use utf8;
use Math::BigInt;
use LeanBridge::OptionalParameters;

my $checks = 0;
sub check { die "Optional-parameter mismatch\n" unless $_[0]; ++$checks; }
sub some { LeanBridge::OptionalParameters::Some->new($_[0]) }

check(LeanBridge::OptionalParameters::word() == 7);
check(LeanBridge::OptionalParameters::word(7) == 7);
check(LeanBridge::OptionalParameters::word(11) == 11);

my $large = Math::BigInt->new('184467440737095516160');
check(LeanBridge::OptionalParameters::natural()->bcmp($large) == 0);
check(LeanBridge::OptionalParameters::natural($large)->bcmp($large) == 0);
check(LeanBridge::OptionalParameters::natural(Math::BigInt->new(11))->bcmp(11) == 0);

check(LeanBridge::OptionalParameters::text() eq "Lean\nBridge");
check(LeanBridge::OptionalParameters::text("Lean\nBridge") eq "Lean\nBridge");
check(LeanBridge::OptionalParameters::text('other') eq 'other');

check(LeanBridge::OptionalParameters::character() eq 'λ');
check(LeanBridge::OptionalParameters::character('λ') eq 'λ');
check(LeanBridge::OptionalParameters::character('猫') eq '猫');

check(!defined LeanBridge::OptionalParameters::maybe());
check(!defined LeanBridge::OptionalParameters::maybe(undef));
check(LeanBridge::OptionalParameters::maybe(some(11))->{value} == 11);

my $present = LeanBridge::OptionalParameters::present();
check(ref($present) eq 'LeanBridge::OptionalParameters::Some' && $present->{value} == 9);
check(LeanBridge::OptionalParameters::present(some(9))->{value} == 9);
check(!defined LeanBridge::OptionalParameters::present(undef));
check(LeanBridge::OptionalParameters::present(some(11))->{value} == 11);

check(!defined LeanBridge::OptionalParameters::unit_value());
check(!defined LeanBridge::OptionalParameters::unit_value(undef));

for my $invalid (
  sub { LeanBridge::OptionalParameters::word(undef) },
  sub { LeanBridge::OptionalParameters::natural(undef) },
) {
  my $accepted = eval { $invalid->(); 1 };
  check(!$accepted && length($@));
}

print "optional-parameter-perl:$checks\n";
