use strict;
use warnings;
use B qw(svref_2object SVf_IOK SVf_NOK SVf_POK SVf_IVisUV);
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(blessed reftype);

# Independent CPAN primitive-base caller; executions require an installed package.
our @NOMINAL_PRIMITIVE_FIELDS = qw(unitValue boolValue uint8Value uint16Value uint32Value uint64Value
    int8Value int16Value int32Value int64Value natValue intValue float32Value float64Value
    textValue bytesValue charValue usizeValue isizeValue digit);
our @NOMINAL_PRIMITIVE_INPUTS = qw(echo_a echo_b refuse_unit combine echo_pair echo_event_a echo_event_b aliases);
my %NOMINAL_WRAPPERS = (
    Packet => join(',', sort @NOMINAL_PRIMITIVE_FIELDS), RawPacket => join(',', sort @NOMINAL_PRIMITIVE_FIELDS),
    Pair => 'left,right', Some => 'value', Ok => 'value', Err => 'value',
    'Event::Empty' => '', 'Event::Box' => 'value', 'Event::Choices' => 'values',
);

sub nominal_nat { Math::BigInt->new("$_[0]") }

# Copy every primitive value before a call. Do not trust generated equality, and
# distinguish the host representations that one Lean base keeps apart.
sub nominal_snapshot {
    my ($value) = @_;
    return ['none'] unless defined $value;
    my $class = blessed($value);
    return ['Math::BigInt', $value->bstr()] if defined($class) && $class eq 'Math::BigInt';
    if (defined $class) {
        my $name = $class; $name =~ s/\ALeanBridge::NominalPrimitiveSubtypes:://;
        die "unexpected wrapper $class" unless exists($NOMINAL_WRAPPERS{$name}) && $name ne $class && reftype($value) eq 'HASH';
        die "unexpected fields in $class" unless join(',', sort keys %$value) eq $NOMINAL_WRAPPERS{$name};
        return [$class, [map { [$_, nominal_snapshot($value->{$_})] } sort keys %$value]];
    }
    return ['array', [map { nominal_snapshot($_) } @$value]] if ref($value) eq 'ARRAY';
    die 'unexpected reference' if ref $value;
    my $flags = svref_2object(\$value)->FLAGS;
    return ['bool', $value ? 1 : 0] if ($flags & SVf_IOK) && ($flags & SVf_NOK) && ($flags & SVf_POK);
    return ['int', ($flags & SVf_IVisUV) ? sprintf('%u', $value) : sprintf('%d', $value)] if $flags & SVf_IOK;
    return ['float', unpack('H*', pack('d>', $value))] if $flags & SVf_NOK;
    return ['string', [unpack('U*', $value)]] if $flags & SVf_POK;
    die 'unexpected scalar';
}

sub nominal_same {
    my $json = JSON::PP->new->canonical;
    return $json->encode(nominal_snapshot($_[0])) eq $json->encode(nominal_snapshot($_[1]));
}

# XS croak adds exactly one source location to the complete cause.
sub nominal_diagnostic {
    my ($actual, $cause, $file) = @_;
    return $actual =~ /\A\Q$cause\E at \Q$file\E line [1-9][0-9]*\.\n\z/ ? 1 : 0;
}

# The API is installed XS, or the explicitly labelled oracle-test double.
sub check_nominal_primitive_subtypes {
    my ($api, $result_only, $prefix, $rounds) = @_;
    $prefix //= 'arg'; $rounds //= 256;
    die "invalid parameter prefix\n" unless $prefix eq 'arg' || $prefix eq 'value';
    die "invalid primitive caller options\n" unless !ref($rounds) && $rounds =~ /\A[1-9][0-9]*\z/ && $rounds <= 1000;
    my ($checks, $rejections, $snapshot_controls) = (0, 0, 0);
    my ($true, $false) = @{$api}{qw(true false)};
    my ($some, $ok, $err) = map { my $c = $_; sub { $api->{$c}->($_[0]) } } qw(Some Ok Err);
    my $pair = sub { $api->{Pair}->(left => $_[0], right => $_[1]) };
    my $empty = sub { $api->{'Event::Empty'}->() };
    my $event_box = sub { $api->{'Event::Box'}->(value => $_[0]) };
    my $choices = sub { $api->{'Event::Choices'}->(values => $_[0]) };
    my $json = JSON::PP->new->canonical;
    my $snapshot = sub { $json->encode(nominal_snapshot($_[0])) };
    my $check = sub { die "failed: $_[1]\n" unless $_[0]; $checks++ };
    my $call = sub {
        my ($name, $args, $expected) = @_;
        my $before = $snapshot->($args);
        my $result = $api->{$name}->(@$args);
        $check->(nominal_same($result, $expected), "$name exact result");
        $check->($snapshot->($args) eq $before, "$name inputs unchanged");
        return $result;
    };
    my $refused = sub {
        my ($name, $args, $path, $constructor, $bound) = @_;
        my $before = $snapshot->($args);
        my $cause = defined($bound) ? "$path is not below its Fin $bound bound"
            : "$path was rejected by NominalPrimitiveSubtypes.$constructor";
        my $accepted = eval { $api->{$name}->(@$args); 1 }; my $error = $@;
        die "accepted: $cause\n" if $accepted;
        $check->(nominal_diagnostic($error, $cause, __FILE__), "refusal: $cause; got $error");
        $check->($snapshot->($args) eq $before, "$name rejected inputs unchanged");
        $rejections++;
    };
    my $huge = nominal_nat(2)->bpow(100);
    my $packet = sub {
        my ($kind, %changes) = @_;
        my %values = (unitValue => undef, boolValue => $true, uint8Value => 42, uint16Value => 42,
            uint32Value => 42, uint64Value => 42, int8Value => -42, int16Value => -42,
            int32Value => -42, int64Value => -42, natValue => nominal_nat(42), intValue => nominal_nat(-42),
            float32Value => 1.5, float64Value => 1.5, textValue => 'a',
            bytesValue => pack('C*', 0, 128, 255), charValue => 'a',
            usizeValue => 42, isizeValue => -42, digit => nominal_nat(2), %changes);
        return $api->{$kind}->(%values);
    };
    my $normalized = sub {
        my %changes = @_;
        return $packet->('Packet', uint8Value => 44, uint16Value => 44, uint32Value => 44, uint64Value => 44,
            int8Value => -40, int16Value => -40, int32Value => -40, int64Value => -40,
            natValue => nominal_nat(44), intValue => nominal_nat(-40), float32Value => -1.5, float64Value => -1.5,
            textValue => 'a!', bytesValue => pack('C*', 0, 128, 255, 255),
            charValue => 'b', usizeValue => 44, isizeValue => -40, %changes);
    };
    my $produced = sub {
        my ($kind, %changes) = @_;
        return $packet->($kind, uint8Value => 200, uint16Value => 200, uint32Value => 200, uint64Value => 200,
            int8Value => 120, int16Value => 120, int32Value => 120, int64Value => 120,
            natValue => $huge->copy, intValue => $huge->copy->bneg, float32Value => 12.5,
            float64Value => 12.5, textValue => "long \x{3bb} text",
            bytesValue => pack('C*', 0, 1, 2, 3, 4, 5, 128, 254, 255),
            charValue => "\x{3bb}", usizeValue => 200, isizeValue => 200, %changes);
    };
    for my $name (@NOMINAL_PRIMITIVE_INPUTS) {
        $check->((exists $api->{$name} ? 1 : 0) != ($result_only ? 1 : 0), "input export selection: $name");
    }
    my ($a, $b, $n) = ($packet->('Packet'), $packet->('Packet', boolValue => $false), $normalized->());
    my ($out, $raw_out) = ($produced->('Packet'), $produced->('RawPacket'));
    for my $control ([undef, $false], [$false, 0], [0, 0.0], [0.0, -0.0],
        [pack('C', 0), pack('C', 1)], ["a\0\x{3bb}\x{1F600}", "a\x{3bb}\x{1F600}"],
        [[undef, $some->($out)], [$some->($out), undef]],
        [$event_box->($out), $choices->([$some->($ok->($out))])],
        [$packet->('Packet'), $packet->('RawPacket')]) {
        $check->(!nominal_same($control->[0], $control->[1]), 'independent snapshot mutation');
        $snapshot_controls++;
    }
    $call->('word_bits', [], 64);
    my $group = [undef, $some->($out)];
    $call->('produce', [$raw_out], $some->($out));
    $call->('produce_group', [$raw_out], $group);
    $call->('produce_pair', [$raw_out], $pair->($group, $group));
    $call->('produce_event', [$raw_out], $event_box->($out));
    $call->('produce_choices', [$raw_out], $choices->([undef, $some->($ok->($out)), $some->($err->($out))]));
    my $infinity = 9**9**9;
    my @invalid = (
        [boolValue => $false, 'boolA'], [uint8Value => 43, 'uint8A'], [uint16Value => 43, 'uint16A'],
        [uint32Value => 43, 'uint32A'], [uint64Value => 43, 'uint64A'], [int8Value => -43, 'int8A'],
        [int16Value => -43, 'int16A'], [int32Value => -43, 'int32A'], [int64Value => -43, 'int64A'],
        [natValue => nominal_nat(43), 'natA'], [intValue => nominal_nat(-43), 'intA'],
        [float32Value => $infinity, 'float32A'], [float64Value => $infinity, 'float64A'],
        [textValue => '', 'textA'], [bytesValue => '', 'bytesA'], [charValue => "\0", 'charA'],
        [usizeValue => 43, 'usizeA'], [isizeValue => -43, 'isizeA'], [digit => nominal_nat(3), undef],
    );
    for my $case (@invalid) {
        my ($field, $value, $constructor) = @$case;
        $call->('produce', [$packet->('RawPacket', $field => $value)], undef);
        next if $result_only;
        $refused->('echo_a', [$packet->('Packet', $field => $value)], "${prefix}0.$field", $constructor, defined($constructor) ? undef : 3);
    }
    my $absent = $packet->('RawPacket', natValue => nominal_nat(43));
    $call->('produce_group', [$absent], [undef]);
    $call->('produce_pair', [$absent], $pair->([undef], [undef]));
    $call->('produce_event', [$absent], $empty->());
    $call->('produce_choices', [$absent], $choices->([undef]));
    if ($result_only) {
        for my $round (0 .. $rounds - 1) {
            my $value = $huge->copy->badd(2 * $round);
            $call->('produce', [$produced->('RawPacket', natValue => $value)], $some->($produced->('Packet', natValue => $value->copy)));
        }
        return {checks => $checks, rejections => $rejections, snapshotControls => $snapshot_controls, rounds => 0 + $rounds, wordBits => 64};
    }
    $call->('echo_a', [$a], $a);
    $call->('echo_b', [$b], $n);
    $refused->('refuse_unit', [$a], "${prefix}0.unitValue", 'unitReject');
    $call->('combine', [$a, $b], [$a, $n]);
    $call->('echo_pair', [$pair->([undef, $some->($a)], [$some->($b)])], $pair->([undef, $some->($a)], [$some->($n)]));
    $call->('aliases', [[undef, $some->($a)], [$some->($b), undef]], [undef, $some->($a), $some->($n), undef]);
    for my $name (qw(echo_event_a echo_event_b)) {
        $call->($name, [$empty->()], $empty->());
    }
    $call->('echo_event_a', [$event_box->($a)], $event_box->($a));
    $call->('echo_event_b', [$event_box->($b)], $event_box->($n));
    $call->('echo_event_a', [$choices->([undef, $some->($ok->($a)), $some->($err->($b))])],
        $choices->([undef, $some->($ok->($a)), $some->($err->($n))]));
    $call->('echo_event_b', [$choices->([undef, $some->($ok->($b)), $some->($err->($a))])],
        $choices->([undef, $some->($ok->($n)), $some->($err->($a))]));
    my @cases = (
        [uint8Value => 254, 0], [uint16Value => 65534, 0],
        [uint32Value => 4294967294, 0], [uint64Value => 18446744073709551614, 0],
        [int8Value => 126, -128], [int16Value => 32766, -32768],
        [int32Value => 2147483646, -2147483648], [int64Value => 9223372036854775806, -9223372036854775807 - 1],
        [usizeValue => 18446744073709551614, 0], [isizeValue => 9223372036854775806, -9223372036854775807 - 1],
        [natValue => $huge->copy, $huge->copy->badd(2)], [intValue => $huge->copy->bneg, $huge->copy->bneg->badd(2)],
        [float32Value => 0.0, -0.0], [float64Value => 0.0, -0.0],
        [float32Value => -0.0, 0.0], [float64Value => -0.0, 0.0],
        [textValue => "a\0\x{3bb}\x{1F600}", "a\0\x{3bb}\x{1F600}!"], [bytesValue => '', "\xff"],
        [charValue => "\x{1F600}", "\x{1F600}"],
    );
    for my $case (@cases) {
        my ($field, $value, $expected) = @$case;
        $call->('echo_b', [$packet->('Packet', boolValue => $false, $field => $value)], $normalized->($field => $expected));
    }
    my $nan = $infinity - $infinity;
    for my $selection ([float32Value => 'float32B'], [float64Value => 'float64B']) {
        my ($field, $constructor) = @$selection;
        for my $value ($nan, $infinity, -$infinity) {
            $refused->('echo_b', [$packet->('Packet', boolValue => $false, $field => $value)], "${prefix}0.$field", $constructor);
            $call->('produce', [$packet->('RawPacket', $field => $value)], undef);
        }
    }
    # The late Fin error must win over the earlier refusing constructor.
    $refused->('combine', [$packet->('Packet', natValue => nominal_nat(43)), $packet->('Packet', boolValue => $false, digit => nominal_nat(3))],
        "${prefix}1.digit", undef, 3);
    for my $round (0 .. $rounds - 1) {
        my $position = $round % 3;
        my $items = [$some->($b), undef, $some->($b)];
        $items->[$position] = $some->($packet->('Packet', boolValue => $false, natValue => nominal_nat(43)));
        $refused->('echo_pair', [$pair->([$some->($a)], $items)], "${prefix}0.right[$position]?.natValue", 'natB');
        $call->('echo_b', [$b], $n);
    }
    return {checks => $checks, rejections => $rejections, snapshotControls => $snapshot_controls, rounds => 0 + $rounds, wordBits => 64};
}

unless (caller) {
    my %options;
    for my $argument (@ARGV) {
        die "usage: consumer.pl [--result-only] [--reviewed]\n" unless $argument =~ /\A--(result-only|reviewed)\z/ && !$options{$1}++;
    }
    my $result_only = $options{'result-only'} ? 1 : 0;
    require LeanBridge::NominalPrimitiveSubtypes;
    my %api;
    for my $name (@NOMINAL_PRIMITIVE_INPUTS) {
        die "unexpected input export $name" if $result_only && LeanBridge::NominalPrimitiveSubtypes->can($name);
    }
    for my $name (qw(word_bits produce produce_group produce_pair produce_event produce_choices), $result_only ? () : @NOMINAL_PRIMITIVE_INPUTS) {
        $api{$name} = LeanBridge::NominalPrimitiveSubtypes->can($name) or die "missing export $name";
    }
    for my $name (qw(true false)) {
        my $constant = LeanBridge::NominalPrimitiveSubtypes->can($name) or die "missing $name";
        $api{$name} = $constant->();
    }
    for my $name (qw(Some Ok Err)) {
        my $class = "LeanBridge::NominalPrimitiveSubtypes::$name";
        $api{$name} = sub { $class->new($_[0]) };
    }
    for my $name (qw(Packet RawPacket Pair Event::Empty Event::Box Event::Choices)) {
        my $class = "LeanBridge::NominalPrimitiveSubtypes::$name";
        $api{$name} = sub { $class->new(@_) };
    }
    print JSON::PP->new->canonical->encode(check_nominal_primitive_subtypes(\%api, $result_only, $options{reviewed} ? 'value' : 'arg')), "\n";
}
1;
