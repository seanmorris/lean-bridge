# Independent Perl caller for proof-erased zero-payload checked records. The
# installed package supplies only the public namespace passed to the checker.
use strict;
use warnings;
use JSON::PP ();
use Math::BigInt;
use Scalar::Util qw(blessed reftype);

my @INPUTS = qw(witness_count absent_count token_tag marker_count mark_count);
my @RESULTS = qw(produce_witness produce_token witnesses maybe_witness produce_marker produce_mark);

sub zero_payload_snapshot {
    my ($value) = @_;
    return ['undef'] unless defined $value;
    return ['nat', $value->bstr]
        if blessed($value) && $value->isa('Math::BigInt');
    return ['array', map { zero_payload_snapshot($_) } @$value]
        if ref($value) eq 'ARRAY';
    if (my $class = blessed($value)) {
        die "unexpected non-hash public value: $class\n"
            unless (reftype($value) // '') eq 'HASH';
        return ['record', $class, map {
            [$_, zero_payload_snapshot($value->{$_})]
        } sort keys %$value];
    }
    return ['scalar', "$value"] unless ref($value);
    die 'unexpected public reference: ' . ref($value) . "\n";
}

sub check_zero_payload_records {
    my ($api, $result_only, $parameter_prefix) = @_;
    die "invalid zero-payload caller options\n"
        unless defined($api) && ($result_only == 0 || $result_only == 1)
            && ($parameter_prefix eq 'arg' || $parameter_prefix eq 'value');
    my ($checks, $calls, $rejections, $recoveries, $snapshots) = (0, 0, 0, 0, 0);
    my $check = sub {
        die "zero-payload assertion failed: $_[1]\n" unless $_[0];
        ++$checks;
    };
    my $same = sub {
        JSON::PP->new->canonical->encode(zero_payload_snapshot($_[0]))
            eq JSON::PP->new->canonical->encode(zero_payload_snapshot($_[1]));
    };
    my $class = sub { "${api}::$_[0]" };
    my $record = sub {
        my ($name, @fields) = @_;
        my $kind = $class->($name);
        return $kind->new(@fields);
    };
    my $call = sub {
        my ($name, @arguments) = @_;
        my $function = $api->can($name)
            or die "missing public function: $name\n";
        return $function->(@arguments);
    };
    my $invoke = sub {
        my ($name, $arguments, $expected, $label) = @_;
        my $before = zero_payload_snapshot($arguments);
        ++$calls;
        my $result = $call->($name, @$arguments);
        $check->($same->($result, $expected), "$label exact result");
        $check->($same->(zero_payload_snapshot($arguments), $before)
            , "$label preserves caller input");
        ++$snapshots;
        return $result;
    };
    my $refused = sub {
        my ($name, $arguments, $constructor, $label) = @_;
        my $before = zero_payload_snapshot($arguments);
        ++$calls;
        my $passed = eval { $call->($name, @$arguments); 1 };
        my $error = "$@"; $error =~ s/\n\z//;
        $check->(!$passed, "$label refuses invalid input");
        my $message = "${parameter_prefix}0 was rejected by ZeroPayloadCheckedRecords.$constructor";
        $check->(index($error, "$message at ") == 0
            , "$label exact checked-record refusal: $error");
        $check->($same->(zero_payload_snapshot($arguments), $before)
            , "$label preserves rejected input");
        ++$rejections; ++$snapshots;
    };
    my $host_refused = sub {
        my ($name, $arguments, $pattern, $label) = @_;
        my $before = zero_payload_snapshot($arguments);
        ++$calls;
        my $passed = eval { $call->($name, @$arguments); 1 };
        my $error = "$@";
        $check->(!$passed && $error =~ $pattern
            , "$label host refusal: $error");
        $check->($same->(zero_payload_snapshot($arguments), $before)
            , "$label preserves rejected input");
        ++$rejections; ++$snapshots;
    };
    my $witness = sub { $record->('Witness') };
    my $token = sub { $record->('Token', tag => $_[0]) };
    my $marker = sub { $record->('Marker') };
    my $blank = sub { $record->('Mark::Blank') };
    my $marked = sub { $record->('Mark::Marked', witness => $_[0]) };
    my $some = sub { my $kind = $class->('Some'); $kind->new($_[0]) };
    my $nat = sub { Math::BigInt->new("$_[0]") };
    my $recover = sub {
        $invoke->('witness_count', [$witness->()], $nat->(1), 'recovery Witness');
        ++$recoveries;
    };

    for my $name (@INPUTS) {
        $check->(!!$api->can($name) != !!$result_only, "input export selection: $name");
    }
    for my $name (@RESULTS) {
        $check->(!!$api->can($name), "result export selection: $name");
    }
    $check->(!$same->($witness->(), $marker->())
        && !$same->($witness->(), $blank->()) && defined($witness->())
        , 'empty carriers remain nominally distinct from undef');
    $check->(keys(%{$witness->()}) == 0 && keys(%{$marker->()}) == 0
        && keys(%{$blank->()}) == 0, 'empty carriers expose no payload fields');

    my $produced_witness = $invoke->('produce_witness', [], $witness->(), 'proof-only Witness');
    $check->((blessed($produced_witness) // '') eq $class->('Witness')
        , 'proof-only Witness is a real empty value');
    my $produced_token = $invoke->('produce_token', [], $token->(undef), 'Unit-bearing Token');
    $check->(!defined($produced_token->tag), 'Token retains its undef Unit payload');
    my $values = $invoke->('witnesses', [$nat->(3)]
        , [$witness->(), $witness->(), $witness->()], 'Witness array');
    $check->(ref($values) eq 'ARRAY' && @$values == 3
        && $same->($values->[0], $values->[2]), 'Witness array retains its length');
    $invoke->('witnesses', [$nat->(0)], [], 'empty Witness array');
    $invoke->('maybe_witness', [0], undef, 'absent Witness option');
    my $present = $invoke->('maybe_witness', [1], $some->($witness->())
        , 'present Witness option');
    $check->((blessed($present) // '') eq $class->('Some')
        && $same->($present->value, $witness->()), 'present empty Witness remains Some');
    my $produced_marker = $invoke->('produce_marker', [], $marker->(), 'plain Marker');
    $check->((blessed($produced_marker) // '') eq $class->('Marker')
        && !$same->($produced_marker, $produced_witness)
        , 'plain Marker remains distinct from checked Witness');
    my $produced_blank = $invoke->('produce_mark', [0], $blank->(), 'blank Mark');
    my $produced_marked = $invoke->('produce_mark', [1], $marked->($witness->()), 'marked Mark');
    $check->((blessed($produced_blank) // '') eq $class->('Mark::Blank')
        && (blessed($produced_marked) // '') eq $class->('Mark::Marked')
        && $same->($produced_marked->witness, $witness->())
        , 'both variant branches survive proof erasure');

    unless ($result_only) {
        $invoke->('witness_count', [$witness->()], $nat->(1), 'Witness input');
        $refused->('absent_count', [$witness->()], 'mkAbsent', 'refusing nullary constructor');
        $recover->();
        $invoke->('token_tag', [$token->(undef)], undef, 'Unit-bearing Token input');
        $invoke->('marker_count', [$marker->()], $nat->(0), 'Marker input');
        $invoke->('mark_count', [$blank->()], $nat->(0), 'blank Mark input');
        $invoke->('mark_count', [$marked->($witness->())], $nat->(1), 'marked Mark input');
        $host_refused->('witness_count', [undef], qr/expected .*::Witness/i, 'undef is not a Witness'); $recover->();
        $host_refused->('witness_count', [$marker->()], qr/expected .*::Witness/i, 'Marker is not a Witness'); $recover->();
        $host_refused->('marker_count', [$witness->()], qr/expected .*::Marker/i, 'Witness is not a Marker'); $recover->();
        $host_refused->('token_tag', [$token->($nat->(0))], qr/Unit requires undef/i, 'Unit payload must be undef'); $recover->();
        $host_refused->('mark_count', [$marked->(undef)], qr/expected .*::Witness/i, 'nested undef is not a Witness'); $recover->();
        $host_refused->('mark_count', [$witness->()], qr/Mark|constructor|expected/i, 'Witness is not a Mark'); $recover->();
        $host_refused->('witnesses', [$nat->(-1)], qr/Nat cannot be negative/i, 'negative Witness count'); $recover->();
    }

    my $expected = $result_only
        ? [9, 37, 0, 0, 9] : [30, 80, 8, 8, 30];
    my $actual = [$calls, $checks, $recoveries, $rejections, $snapshots];
    $check->(join(',', @$actual) eq join(',', @$expected)
        , 'exact caller totals ' . join(',', @$actual) . ' != ' . join(',', @$expected));
    return { calls => $calls, checks => $checks, recoveries => $recoveries
        , rejections => $rejections, snapshots => $snapshots };
}

unless ($ENV{LEAN_BRIDGE_ZERO_PAYLOAD_PERL_MODEL}) {
    my %allowed = map { $_ => 1 } ('', '--result-only', '--reviewed', '--result-only --reviewed');
    die "usage: perl.pl [--result-only] [--reviewed]\n"
        unless $allowed{join(' ', @ARGV)};
    require LeanBridge::ZeroPayloadCheckedRecords;
    print JSON::PP->new->canonical->encode(check_zero_payload_records(
        'LeanBridge::ZeroPayloadCheckedRecords'
        , scalar(grep { $_ eq '--result-only' } @ARGV) ? 1 : 0
        , scalar(grep { $_ eq '--reviewed' } @ARGV) ? 'value' : 'arg'
    )), "\n";
}

1;
