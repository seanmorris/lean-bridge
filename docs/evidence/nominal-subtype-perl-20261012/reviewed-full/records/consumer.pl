use strict;
use warnings;
use B qw(svref_2object SVf_IOK SVf_NOK SVf_POK);
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(blessed reftype);

sub nominal_nat { Math::BigInt->new("$_[0]") }

# Copy every primitive value before a call. Do not trust generated equality.
sub nominal_snapshot {
    my ($value) = @_;
    return ['none'] unless defined $value;
    my $class = blessed($value);
    return ['Math::BigInt', $value->bstr()] if defined($class) && $class eq 'Math::BigInt';
    if (defined $class) {
        my %fields = (
            Some => 'value', Ok => 'value', Err => 'value', Envelope => 'digit,payload',
            Pair => 'left,right', AliasPair => 'left,right',
            'Event::Empty' => '', 'Event::Box' => 'value', 'Event::Choices' => 'values',
        );
        my $name = $class; $name =~ s/\ALeanBridge::NominalSubtypes:://;
        die "unexpected wrapper $class" unless exists($fields{$name}) && $name ne $class && reftype($value) eq 'HASH';
        die "unexpected fields in $class" unless join(',', sort keys %$value) eq $fields{$name};
        return [$class, [map { [$_, nominal_snapshot($value->{$_})] } sort keys %$value]];
    }
    return ['array', [map { nominal_snapshot($_) } @$value]] if ref($value) eq 'ARRAY';
    die 'unexpected reference' if ref $value;
    my $flags = svref_2object(\$value)->FLAGS;
    return ['number', 0 + $value] if $flags & (SVf_IOK | SVf_NOK);
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
sub check_nominal_subtypes {
    my ($api, $result_only) = @_;
    my ($checks, $rejections, $snapshot_controls) = (0, 0, 0);
    my ($some, $ok, $err) = @{$api}{qw(Some Ok Err)};
    my $box = sub { $api->{Envelope}->(payload => nominal_nat($_[0]), digit => nominal_nat($_[1] // 2)) };
    my $pair = sub { $api->{AliasPair}->(left => $_[0], right => $_[1]) };
    my $empty = sub { $api->{'Event::Empty'}->() };
    my $event_box = sub { $api->{'Event::Box'}->(value => $_[0]) };
    my $choices = sub { $api->{'Event::Choices'}->(values => $_[0]) };
    my $values = sub { [undef, $some->($box->(nominal_nat($_[0])->binc))] };
    my $check = sub { die "failed: $_[1]\n" unless $_[0]; $checks++ };
    my $equal = sub { $check->(nominal_same($_[0], $_[1]), $_[2]) };
    my $json = JSON::PP->new->canonical;
    my $snapshot = sub { $json->encode(nominal_snapshot($_[0])) };
    my $call = sub {
        my ($name, $args, $expected) = @_;
        my $before = $snapshot->($args);
        my $result = $api->{$name}->(@$args);
        $equal->($result, $expected, $name);
        $check->($snapshot->($args) eq $before, "$name inputs unchanged");
        return $result;
    };
    my $refused = sub {
        my ($name, $args, $path, $constructor, $bound) = @_;
        my $before = $snapshot->($args);
        my $cause = defined($bound) ? "$path is not below its Fin $bound bound"
            : "$path was rejected by NominalSubtypes.$constructor";
        my $accepted = eval { $api->{$name}->(@$args); 1 }; my $error = $@;
        die "accepted: $cause\n" if $accepted;
        $check->(nominal_diagnostic($error, $cause, __FILE__), "refusal: $cause; got $error");
        $check->($snapshot->($args) eq $before, "$name rejected inputs unchanged");
        $rejections++;
    };
    my $huge = nominal_nat(2)->bpow(100);
    my $original = $choices->([undef, $some->($ok->($huge))]);
    for my $changed (
        $choices->([undef, $some->($ok->($huge->copy->binc))]),
        $choices->([undef, $some->($err->($huge))]),
        $choices->([$some->($ok->($huge)), undef]),
        $choices->([undef, undef]), $choices->([undef, $some->($ok->($huge)), undef]),
        $event_box->($box->($huge)), $empty->(),
        $choices->([undef, $ok->($some->($huge))]),
    ) {
        $check->(!nominal_same($changed, $original), 'snapshot mutation control');
        $snapshot_controls++;
    }
    # These results exceed both input constructor limits and must not be revalidated.
    for my $value (nominal_nat(0), nominal_nat(40), $huge) {
        my ($one, $two) = ($value->copy->binc, $value->copy->badd(2));
        $call->('scalar', [$value], $one);
        $call->('produce_envelope', [$value], $box->($one));
        $call->('array_values', [$value], [$one, $two]);
        $call->('list_values', [$value], [$one, $two]);
        $call->('optional', [$value], $value->is_zero ? undef : $some->($one));
        $call->('product', [$value], [$one, $two]);
        $call->('branch', [$value], $value->is_zero ? $err->($one) : $ok->($one));
        $call->('group_values', [$value], $values->($value));
        $call->('pair_values', [$value], $pair->($values->($value), $values->($one)));
        $call->('event_value', [$value], $event_box->($box->($one)));
        $call->('event_empty', [$value], $empty->());
        $call->('event_choices', [$value], $choices->([undef, $some->($ok->($one)), $some->($err->($two))]));
        $call->('no_items', [$value], []);
    }
    if ($result_only) {
        for my $round (0..999) {
            my $value = $huge->copy->badd($round);
            $call->('pair_values', [$value], $pair->($values->($value), $values->($value->copy->binc)));
        }
        return {checks => $checks, rejections => $rejections, snapshotControls => $snapshot_controls};
    }
    my $input = $box->(40);
    $call->('first', [$input], nominal_nat(41)); $call->('second', [$input], nominal_nat(42));
    $call->('combine', [$input, $input], nominal_nat(4142));
    $call->('nested', [$api->{Pair}->(left => $input, right => $input)], nominal_nat(4142));
    $call->('first', [$box->(99)], nominal_nat(100)); $call->('second', [$box->(89)], nominal_nat(91));
    $call->('first', [$box->(90)], nominal_nat(91));
    $refused->('first', [$box->(100)], 'value0.payload', 'plusOne');
    $refused->('second', [$box->(90)], 'value0.payload', 'plusTwo');
    $refused->('combine', [$box->(100), $input], 'value0.payload', 'plusOne');
    $refused->('combine', [$input, $box->(90)], 'value1.payload', 'plusTwo');
    $refused->('nested', [$api->{Pair}->(left => $box->(100), right => $input)], 'value0.left.payload', 'plusOne');
    $refused->('nested', [$api->{Pair}->(left => $input, right => $box->(90))], 'value0.right.payload', 'plusTwo');
    $call->('echo', [$input], $box->(41));
    for my $selection (['event_first', 1, 2], ['event_second', 2, 1]) {
        my ($name, $one, $two) = @$selection;
        $call->($name, [$empty->()], nominal_nat(0));
        $call->($name, [$event_box->($input)], nominal_nat(40 + $one));
        $call->($name, [$choices->([])], nominal_nat(0));
        $call->($name, [$choices->([undef])], nominal_nat(0));
        $call->($name, [$choices->([undef, $some->($ok->(nominal_nat(40)))])], nominal_nat(40 + $one));
        $call->($name, [$choices->([$some->($err->(nominal_nat(40))), undef])], nominal_nat(40 + $two));
        for my $branch (['ok', $ok, $one], ['error', $err, $two]) {
            for my $position (0..2) {
                my $items = [$some->($ok->(nominal_nat(40))), undef, $some->($err->(nominal_nat(40)))];
                $items->[$position] = $some->($branch->[1]->(nominal_nat(100)));
                $refused->($name, [$choices->($items)], "value0.choices.values[$position]?.$branch->[0]", $branch->[2] == 1 ? 'plusOne' : 'plusTwo');
            }
        }
    }
    my $left = [undef, $some->($input), $some->($box->(1, 0))];
    my $right = [$some->($box->(2, 1)), undef];
    my $normalized_left = [undef, $some->($box->(41)), $some->($box->(2, 0))];
    my $normalized_right = [$some->($box->(4, 1)), undef];
    $call->('aliases', [$left, $right], nominal_nat(47));
    $call->('inspect_alias_pair', [$pair->($left, $right)], nominal_nat(47));
    $call->('echo_groups', [$left], $normalized_left);
    my $projected = $call->('echo_pair', [$pair->($left, $right)], $pair->($normalized_left, $normalized_right));
    $call->('echo_pair', [$projected], $pair->([undef, $some->($box->(42)), $some->($box->(3, 0))], [$some->($box->(6, 1)), undef]));
    $call->('echo_event', [$choices->([undef, $some->($ok->(nominal_nat(40))), $some->($err->(nominal_nat(40)))])], $choices->([undef, $some->($ok->(nominal_nat(41))), $some->($err->(nominal_nat(42)))]));
    $call->('echo_event', [$empty->()], $empty->());
    $call->('echo_event', [$event_box->($input)], $event_box->($box->(41)));
    $call->('echo_groups', [[]], []);
    $call->('echo_pair', [$pair->([], [undef])], $pair->([], [undef]));
    for my $position (0..2) {
        my $bad = [$some->($input), undef, $some->($input)]; $bad->[$position] = $some->($box->(100));
        $refused->('echo_groups', [$bad], "value0[$position]?.payload", 'plusOne');
        $refused->('inspect_alias_pair', [$pair->($bad, $right)], "value0.left[$position]?.payload", 'plusOne');
        $refused->('inspect_alias_pair', [$pair->($left, $bad)], "value0.right[$position]?.payload", 'plusTwo');
    }
    # The late Fin error must win over the earlier refusing constructor.
    $refused->('combine', [$box->(100), $box->(40, 3)], 'value1.digit', undef, 3);
    $refused->('nested', [$api->{Pair}->(left => $box->(100), right => $box->(40, 3))], 'value0.right.digit', undef, 3);
    $refused->('aliases', [[$some->($box->(100))], [undef, $some->($box->(40, 3))]], 'value1[1]?.digit', undef, 3);
    $refused->('echo_event', [$event_box->($box->(100, 3))], 'value0.box.value.digit', undef, 3);
    $call->('plain_fin', [nominal_nat(2)], nominal_nat(2));
    $refused->('plain_fin', [nominal_nat(3)], 'value0', undef, 3);
    for my $round (0..999) {
        my $position = $round % 3;
        my $bad = [undef, $some->($box->(1)), undef]; $bad->[$position] = $some->($box->(90));
        $refused->('echo_pair', [$pair->($left, $bad)], "value0.right[$position]?.payload", 'plusTwo');
        $call->('echo_pair', [$pair->($left, $right)], $pair->($normalized_left, $normalized_right));
    }
    return {checks => $checks, rejections => $rejections, snapshotControls => $snapshot_controls};
}

unless (caller) {
    my $result_only = @ARGV == 1 && $ARGV[0] eq '--result-only';
    die "usage: consumer.pl [--result-only]\n" if @ARGV && !$result_only;
    require LeanBridge::NominalSubtypes;
    my %api;
    my @inputs = qw(first second combine nested event_first event_second echo aliases inspect_alias_pair echo_groups echo_pair echo_event plain_fin);
    for my $name (@inputs) {
        die "unexpected input export $name" if $result_only && LeanBridge::NominalSubtypes->can($name);
    }
    for my $name (qw(scalar produce_envelope array_values list_values optional product branch group_values pair_values event_value event_empty event_choices no_items), $result_only ? () : @inputs) {
        $api{$name} = LeanBridge::NominalSubtypes->can($name) or die "missing export $name";
    }
    for my $name (qw(Some Ok Err)) {
        my $class = "LeanBridge::NominalSubtypes::$name";
        $api{$name} = sub { $class->new($_[0]) };
    }
    for my $name (qw(Envelope AliasPair Event::Empty Event::Box Event::Choices), $result_only ? () : ('Pair')) {
        my $class = "LeanBridge::NominalSubtypes::$name";
        $api{$name} = sub { $class->new(@_) };
    }
    print JSON::PP->new->canonical->encode(check_nominal_subtypes(\%api, $result_only)), "\n";
}
1;
