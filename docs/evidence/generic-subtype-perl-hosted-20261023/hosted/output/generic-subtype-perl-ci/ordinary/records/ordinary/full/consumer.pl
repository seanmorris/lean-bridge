use strict;
use warnings;
use JSON::PP;
use Math::BigInt;

sub nat { Math::BigInt->new("$_[0]") }

sub same_generic {
    my ($value, $member, $marker) = @_;
    return ref($value) eq 'LeanBridge::NominalSubtypes::GenericNat'
        && $value->{value}->bcmp($member) == 0
        && $value->{marker}->bcmp($marker) == 0;
}

sub exact_failure {
    my ($failure, $cause) = @_;
    my $file = __FILE__;
    return $failure =~ /\A\Q$cause\E at \Q$file\E line [1-9][0-9]*\.\n\z/ ? 1 : 0;
}

require LeanBridge::NominalSubtypes;
my $class = 'LeanBridge::NominalSubtypes::GenericNat';
my $make = sub { $class->new(value => nat($_[0]), marker => nat($_[1])) };
my ($checks, $rejections) = (0, 0);
my $check = sub { die "failed: $_[1]\n" unless $_[0]; $checks++ };
my $call = sub {
    my ($name, $input, $member, $marker) = @_;
    my ($before_member, $before_marker) = ($input->{value}->copy, $input->{marker}->copy);
    my $result = LeanBridge::NominalSubtypes->can($name)->($input);
    $check->(same_generic($result, nat($member), nat($marker)), $name);
    $check->(same_generic($input, $before_member, $before_marker), "$name input unchanged");
};
my $scalar = sub {
    my ($input, $expected) = @_;
    my ($before_member, $before_marker) = ($input->{value}->copy, $input->{marker}->copy);
    my $result = LeanBridge::NominalSubtypes::generic_use($input);
    $check->($result->bcmp($expected) == 0, 'generic_use');
    $check->(same_generic($input, $before_member, $before_marker), 'generic_use input unchanged');
};
my $refused = sub {
    my ($name, $input, $constructor) = @_;
    my ($before_member, $before_marker) = ($input->{value}->copy, $input->{marker}->copy);
    my $accepted = eval { LeanBridge::NominalSubtypes->can($name)->($input); 1 };
    my $failure = $@;
    my $cause = "arg0.value was rejected by NominalSubtypes.$constructor";
    die "accepted: $cause\n" if $accepted;
    $check->(exact_failure($failure, $cause), "$name diagnostic: $failure");
    $check->(same_generic($input, $before_member, $before_marker), "$name rejected input unchanged");
    $rejections++;
};

$scalar->($make->(40, 2), nat(43));
$call->('echo_generic_first', $make->(40, 2), 41, 2);
$call->('echo_generic_second', $make->(40, 2), 42, 2);
$scalar->($make->(99, 7), nat(107));
$call->('echo_generic_first', $make->(99, 7), 100, 7);
$refused->('generic_use', $make->(100, 2), 'plusOne');
$refused->('echo_generic_first', $make->(100, 2), 'plusOne');
$refused->('echo_generic_second', $make->(90, 2), 'plusTwo');
$call->('echo_generic_second', $make->(40, 2), 42, 2);

print JSON::PP->new->canonical->encode({checks => $checks, rejections => $rejections}), "\n";
