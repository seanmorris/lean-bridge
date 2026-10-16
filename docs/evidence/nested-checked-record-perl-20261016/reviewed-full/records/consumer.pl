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

my $first = packet(2, 3);
my $second = packet(7, 0);
accepted('first', [$first], n(3), 'direct packet');
accepted('second', [$second], n(8), 'normalized direct packet');
accepted('pair', [$first, $second], n(11), 'repeated packet parameters');
accepted('in_array', [[packet(1, 2), packet(3, 5)]], n(7), 'array packets');
accepted('in_list', [[packet(1, 0), packet(3, 100)]], n(6), 'List packets');
accepted('in_option', [undef], n(0), 'absent packet option');
accepted('in_option', [some(packet(1, 2))], n(3), 'present packet option');
accepted('in_product', [[packet(1, 2), packet(3, 0)]], n(6), 'packet product');
accepted('in_except', [ok(packet(2, 9))], n(3), 'success packet branch');
accepted('in_except', [err(packet(1, 2))], n(3), 'error packet branch');
accepted('in_holder', [holder(packet(3, 1), 9)], n(13), 'enclosing record field');
accepted('in_choice', [empty_choice()], n(0), 'empty variant case');
accepted('in_choice', [packet_choice(packet(2, 4))], n(5), 'active variant field');
my $echo_input = [$first, packet(1, $huge)];
my $echoed = accepted('echo_array', [$echo_input], [$first, packet(1, $huge)], 'proof-free packet result');
check(refaddr($echoed) != refaddr($echo_input) && refaddr($echoed->[0]) != refaddr($first), 'result owns independent storage');

refused('first', [packet(0, 0)], 'value0.word was rejected by NestedCheckedRecords.mkWord'); recovered();
refused('first', [packet(4, 2)], 'value0 was rejected by NestedCheckedRecords.mkPacket'); recovered();
refused('first', [packet(10, 12)], 'value0.digit is not below its Fin 10 bound'); recovered();
refused('pair', [$first, packet(10, 0)], 'value1.digit is not below its Fin 10 bound'); recovered();
refused('in_array', [[$first, packet(1, 0)]], 'value0[1].word was rejected by NestedCheckedRecords.mkWord'); recovered();
refused('in_list', [[$first, packet(10, 2)]], 'value0[1].digit is not below its Fin 10 bound'); recovered();
refused('in_option', [some(packet(5, 2))], 'value0? was rejected by NestedCheckedRecords.mkPacket'); recovered();
refused('in_product', [[$first, packet(10, 0)]], 'value0.1.digit is not below its Fin 10 bound'); recovered();
refused('in_except', [ok(packet(10, 0))], 'value0.ok.digit is not below its Fin 10 bound'); recovered();
refused('in_except', [err(packet(3, 1))], 'value0.error was rejected by NestedCheckedRecords.mkPacket'); recovered();
refused('in_holder', [holder(packet(10, 0), 9)], 'value0.packet.digit is not below its Fin 10 bound'); recovered();
refused('in_choice', [packet_choice(packet(3, 1))], 'value0.packet.value was rejected by NestedCheckedRecords.mkPacket'); recovered();

host_refused('first', [{digit => n(2), word => n(3)}], qr/expected LeanBridge::NestedCheckedRecords::Packet/); recovered();
host_refused('first', [bless({digit => n(2)}, 'LeanBridge::NestedCheckedRecords::Packet')], qr/missing record field/); recovered();
host_refused('first', [bless({digit => n(2), word => n(3), linked => 1}, 'LeanBridge::NestedCheckedRecords::Packet')], qr/unknown record fields/); recovered();
host_refused('first', [packet(-1, 1)], qr/Nat cannot be negative/); recovered();

for my $round (0 .. $rounds - 1) {
    my $valid = packet($round % 10, $round + 10);
    accepted('first', [$valid], n($round + 10), 'round direct packet');
    refused('first', [packet(2, 1)], 'value0 was rejected by NestedCheckedRecords.mkPacket'); recovered();
    accepted('second', [packet($round % 10, 0)], n($round % 10 + 1), 'round normalized packet');
    my $rows = [$valid, packet(1, 0)];
    refused('in_array', [$rows], 'value0[1].word was rejected by NestedCheckedRecords.mkWord');
    $rows->[1] = packet(2, 3);
    my $sum = call('in_array', $rows);
    check($sum->bstr eq '' . ($round + 13), 'recovery after late rejection');
    ++$recoveries;
}
check(same($second, packet(7, 0)), 'normalization never mutates caller data');


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
