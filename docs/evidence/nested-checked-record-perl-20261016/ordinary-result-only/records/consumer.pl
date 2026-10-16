# Independent public caller for installed nested checked-record CPAN packages.
use strict;
use warnings;
use Config;
use Cwd qw(abs_path);
use Digest::SHA qw(sha256_hex);
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(blessed refaddr reftype);
use LeanBridge::NestedCheckedRecords;

my ($checks, $rejections, $host_rejections, $recoveries, $snapshots) = (0, 0, 0, 0, 0);
my $rounds = 256;
sub check {
    die "nested checked-record assertion failed: " . ($_[1] // 'unknown') . "\n" unless $_[0];
    ++$checks;
}
sub n { Math::BigInt->new("$_[0]") }
sub plus { $_[0]->copy->badd($_[1]) }
sub packet {
    LeanBridge::NestedCheckedRecords::Packet->new(digit => n($_[0]), word => n($_[1]));
}
sub holder {
    LeanBridge::NestedCheckedRecords::Holder->new(packet => $_[0], tag => n($_[1]));
}
sub some { LeanBridge::NestedCheckedRecords::Some->new($_[0]) }
sub ok { LeanBridge::NestedCheckedRecords::Ok->new($_[0]) }
sub err { LeanBridge::NestedCheckedRecords::Err->new($_[0]) }
sub empty_choice { LeanBridge::NestedCheckedRecords::Choice::Empty->new() }
sub packet_choice { LeanBridge::NestedCheckedRecords::Choice::Packet->new(value => $_[0]) }

sub snapshot_value {
    my ($value, $seen) = @_;
    return ['undef'] unless defined $value;
    if (blessed($value) && $value->isa('Math::BigInt')) {
        return ['bigint', $value->bstr];
    }
    my $reference = ref($value);
    return ['scalar', "$value"] unless $reference;
    my $identity = refaddr($value);
    die "cyclic snapshot input\n" if $seen->{$identity};
    local $seen->{$identity} = 1;
    my $kind = reftype($value) // '';
    if ($kind eq 'ARRAY') {
        return ['array', map { snapshot_value($_, $seen) } @$value];
    }
    if ($kind eq 'HASH') {
        my $class = blessed($value) // '';
        return ['object', $class, map { [$_, snapshot_value($value->{$_}, $seen)] } sort keys %$value];
    }
    die "unsupported snapshot reference: $reference\n";
}
sub snapshot { JSON::PP->new->canonical->encode(snapshot_value($_[0], {})) }
sub same { snapshot($_[0]) eq snapshot($_[1]) }
sub call {
    my ($name, @arguments) = @_;
    my $function = LeanBridge::NestedCheckedRecords->can($name);
    check($function, "public function $name");
    return $function->(@arguments);
}
sub accepted {
    my ($name, $arguments, $expected, $label) = @_;
    my $before = snapshot($arguments);
    my $result = call($name, @$arguments);
    check(same($result, $expected), "$label result");
    check(snapshot($arguments) eq $before, "$label preserves every input");
    ++$snapshots;
    return $result;
}
sub refused {
    my ($name, $arguments, $message) = @_;
    my $before = snapshot($arguments);
    my $passed = eval { call($name, @$arguments); 1 };
    my $error = "$@";
    check(!$passed, "$name rejects invalid checked input");
    check(index($error, $message . ' at ') == 0, "$name exact rejection: $error");
    check(snapshot($arguments) eq $before, "$name rejection preserves every input");
    ++$rejections; ++$snapshots;
}
sub host_refused {
    my ($name, $arguments, $pattern) = @_;
    my $before = snapshot($arguments);
    my $passed = eval { call($name, @$arguments); 1 };
    my $error = "$@";
    check(!$passed && $error =~ $pattern, "$name host rejection: $error");
    check(snapshot($arguments) eq $before, "$name host rejection preserves every input");
    ++$host_rejections; ++$snapshots;
}
sub recovered {
    my $value = call('first', packet(2, 3));
    check($value->bstr eq '3', 'valid call recovers after rejection');
    ++$recoveries;
}

my $huge = Math::BigInt->bone->blsft(100);
for my $value (n(0), n(4), $huge) {
    accepted('produce_option', [$value], some(packet(0, plus($value, 1))), 'projected option');
    accepted('produce_array', [$value], [packet(0, plus($value, 1)), packet(0, plus($value, 2))], 'projected array');
}


for my $name (qw(first second pair in_array in_list in_option in_product in_except in_holder in_choice echo_array)) {
    check(!LeanBridge::NestedCheckedRecords->can($name), "result-only package omits $name");
}
host_refused('produce_option', [n(-1)], qr/Nat cannot be negative/);
accepted('produce_option', [n(0)], some(packet(0, 1)), 'result projection recovers after host rejection');
++ $recoveries;
for my $round (0 .. $rounds - 1) {
    my $value = plus($huge, $round);
    accepted('produce_option', [$value], some(packet(0, plus($value, 1))), 'round projected option');
    accepted('produce_array', [$value], [packet(0, plus($value, 1)), packet(0, plus($value, 2))], 'round projected array');
}

my $root = abs_path($ENV{PERL5LIB});
open my $maps, '<', '/proc/self/maps' or die $!;
my %libraries;
while (<$maps>) {
    my ($path) = /\s(\/\S+\.so)$/;
    next unless $path && index($path, "$root/") == 0;
    open my $file, '<:raw', $path or die $!;
    local $/;
    $libraries{substr($path, length($root) + 1)} = sha256_hex(<$file>);
}
print JSON::PP->new->canonical->encode({
    checks => $checks, rejections => $rejections, hostRejections => $host_rejections,
    recoveries => $recoveries, snapshots => $snapshots, rounds => $rounds,
    wordBits => 8 * $Config{ptrsize}, perl => "$^V",
    threaded => ($Config{useithreads} // '') eq 'define' ? JSON::PP::true : JSON::PP::false,
    api => abs_path($INC{'LeanBridge/NestedCheckedRecords.pm'}), nativeLibraries => \%libraries
}) . "\n";
