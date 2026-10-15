# Exercise a standalone caller oracle only; no Lean or installed library executes.
use strict;
use warnings;
no warnings 'once';
use JSON::PP;
use Math::BigInt;
use Scalar::Util qw(blessed);
my ($caller_file) = @ARGV;
die "usage: nominal-primitive-subtype-perl-model.pl <caller.pl>\n" unless @ARGV == 1 && defined($caller_file);
require $caller_file;

my $M = 'LeanBridge::NominalPrimitiveSubtypes';
my @names = @main::NOMINAL_PRIMITIVE_FIELDS;
my @numeric = (@names[2 .. 11], @names[17 .. 18]);
my %bits = (uint8Value => 8, uint16Value => 16, uint32Value => 32, uint64Value => 64, int8Value => 8, int16Value => 16,
    int32Value => 32, int64Value => 64, usizeValue => 64, isizeValue => 64);
my %signed = map { $_ => 1 } qw(int8Value int16Value int32Value int64Value isizeValue);
my %big = map { $_ => 1 } qw(natValue intValue);
my $packet_class = sub { my ($name) = @_; sub { bless {@_}, "${M}::$name" } };
my $wrapper_class = sub { my ($name) = @_; sub { bless {value => $_[0]}, "${M}::$name" } };
my $is = sub { my ($value, $name) = @_; (blessed($value) // '') eq "${M}::$name" };
my $finite = sub { my ($value) = @_; $value == $value && $value != 9**9**9 && $value != -9**9**9 };
my $even = sub { my ($field, $value) = @_; $big{$field} ? $value->copy->bmod(2)->is_zero : ($value % 2) == 0 };
my $below = sub { my ($field, $value, $limit) = @_; $big{$field} ? $value->bcmp($limit) < 0 : $value < $limit };
my $refusal = sub { my ($path, $constructor) = @_; die "$path was rejected by NominalPrimitiveSubtypes.$constructor at $caller_file line 42.\n" };
my $bound = sub { my ($path) = @_; die "$path is not below its Fin 3 bound at $caller_file line 42.\n" };

sub make_nominal_primitive_api {
    my ($result_only, $prefix) = @_;
    my %api = (true => !!1, false => !!0);
    $api{$_} = $packet_class->($_) for qw(Packet RawPacket Pair Event::Empty Event::Box Event::Choices);
    $api{$_} = $wrapper_class->($_) for qw(Some Ok Err);
    my $valid = sub {
        my ($value) = @_;
        return 0 unless $value->{boolValue};
        for my $field (@numeric) { return 0 unless $even->($field, $value->{$field}) }
        return 0 unless $finite->($value->{float32Value}) && $finite->($value->{float64Value});
        return 0 unless length($value->{textValue}) > 0 && length($value->{bytesValue}) > 0;
        return 0 unless $value->{charValue} ne "\0";
        return $value->{digit}->bcmp(3) < 0 ? 1 : 0;
    };
    my $fin; $fin = sub {
        my ($value, $path) = @_;
        return unless ref $value;
        if (ref($value) eq 'ARRAY') { $fin->($value->[$_], "$path\[$_]") for 0 .. $#$value; return }
        $bound->("$path.digit") if $is->($value, 'Packet') && $value->{digit}->bcmp(3) >= 0;
        if ($is->($value, 'Packet') || $is->($value, 'RawPacket')) { return }
        if ($is->($value, 'Some')) { $fin->($value->{value}, "$path?"); return }
        if ($is->($value, 'Ok')) { $fin->($value->{value}, "$path.ok"); return }
        if ($is->($value, 'Err')) { $fin->($value->{value}, "$path.error"); return }
        if ($is->($value, 'Pair')) { $fin->($value->{$_}, "$path.$_") for qw(left right); return }
        if ($is->($value, 'Event::Box')) { $fin->($value->{value}, "$path.box.value"); return }
        if ($is->($value, 'Event::Choices')) { $fin->($value->{values}, "$path.choices.values"); return }
    };
    my $convert = sub {
        my ($value, $choice, $path) = @_;
        my %values = map { $_ => $value->{$_} } @names;
        if ($choice eq 'B') {
            $values{boolValue} = $values{boolValue} ? !!0 : !!1;
            for my $field (@numeric) {
                my $number = Math::BigInt->new("$values{$field}")->badd(2);
                unless ($big{$field}) {
                    my $modulus = Math::BigInt->new(2)->bpow($bits{$field});
                    my $half = Math::BigInt->new(2)->bpow($bits{$field} - 1);
                    $number->bmod($modulus);
                    $number->bsub($modulus) if $signed{$field} && $number->bcmp($half) >= 0;
                }
                $values{$field} = $big{$field} ? $number : 0 + $number->bstr;
            }
            $values{$_} = -$values{$_} for qw(float32Value float64Value);
            $values{textValue} .= '!';
            $values{bytesValue} .= "\xff";
            $values{charValue} = 'b' if $values{charValue} eq 'a';
        }
        for my $field (@names[0 .. $#names - 1]) {
            my $item = $values{$field};
            my $okay = $field eq 'unitValue' ? 1 : $field eq 'boolValue' ? ($item ? 1 : 0)
                : (grep { $_ eq $field } @numeric) ? $even->($field, $item)
                : $field =~ /\Afloat/ ? $finite->($item)
                : ($field eq 'textValue' || $field eq 'bytesValue') ? length($item) > 0
                : $item ne "\0";
            if ($choice eq 'A') {
                $okay &&= (grep { $_ eq $field } @numeric) ? $below->($field, $item, 100)
                    : $field =~ /\Afloat/ ? $item < 10
                    : ($field eq 'textValue' || $field eq 'bytesValue') ? length($item) < 8
                    : $field eq 'charValue' ? ord($item) < 128 : 1;
            }
            (my $constructor = $field) =~ s/Value\z//;
            $refusal->("$path.$field", $constructor . $choice) unless $okay;
        }
        return $api{Packet}->(%values);
    };
    my $checked = sub {
        my ($function) = @_;
        return sub { my @args = @_; $fin->($args[$_], $prefix . $_) for 0 .. $#args; return $function->(@args) };
    };
    my $group = sub {
        my ($values, $choice, $path) = @_;
        return [map { defined($values->[$_]) ? $api{Some}->($convert->($values->[$_]{value}, $choice, "$path\[$_]?")) : undef } 0 .. $#$values];
    };
    my $event = sub {
        my ($value, $first, $second) = @_;
        return $api{'Event::Empty'}->() if $is->($value, 'Event::Empty');
        return $api{'Event::Box'}->(value => $convert->($value->{value}, $first, "${prefix}0.box.value")) if $is->($value, 'Event::Box');
        my $items = $value->{values};
        return $api{'Event::Choices'}->(values => [map {
            my $i = $_; my $item = $items->[$i];
            !defined($item) ? undef : $is->($item->{value}, 'Ok')
                ? $api{Some}->($api{Ok}->($convert->($item->{value}{value}, $first, "${prefix}0.choices.values[$i]?.ok")))
                : $api{Some}->($api{Err}->($convert->($item->{value}{value}, $second, "${prefix}0.choices.values[$i]?.error")))
        } 0 .. $#$items]);
    };
    my $produced = sub { my ($value) = @_; $api{Packet}->(map { $_ => $value->{$_} } @names) };
    my $produced_group = sub { my ($value) = @_; $valid->($value) ? [undef, $api{Some}->($produced->($value))] : [undef] };
    $api{word_bits} = sub { 64 };
    $api{produce} = sub { $valid->($_[0]) ? $api{Some}->($produced->($_[0])) : undef };
    $api{produce_group} = $produced_group;
    $api{produce_pair} = sub { $api{Pair}->(left => $produced_group->($_[0]), right => $produced_group->($_[0])) };
    $api{produce_event} = sub { $valid->($_[0]) ? $api{'Event::Box'}->(value => $produced->($_[0])) : $api{'Event::Empty'}->() };
    $api{produce_choices} = sub {
        my ($value) = @_;
        return $api{'Event::Choices'}->(values => $valid->($value)
            ? [undef, $api{Some}->($api{Ok}->($produced->($value))), $api{Some}->($api{Err}->($produced->($value)))] : [undef]);
    };
    return \%api if $result_only;
    $api{echo_a} = $checked->(sub { $convert->($_[0], 'A', "${prefix}0") });
    $api{echo_b} = $checked->(sub { $convert->($_[0], 'B', "${prefix}0") });
    $api{refuse_unit} = $checked->(sub { $refusal->("${prefix}0.unitValue", 'unitReject') });
    $api{combine} = $checked->(sub { [$convert->($_[0], 'A', "${prefix}0"), $convert->($_[1], 'B', "${prefix}1")] });
    $api{echo_pair} = $checked->(sub { $api{Pair}->(left => $group->($_[0]{left}, 'A', "${prefix}0.left"), right => $group->($_[0]{right}, 'B', "${prefix}0.right")) });
    $api{aliases} = $checked->(sub { [@{$group->($_[0], 'A', "${prefix}0")}, @{$group->($_[1], 'B', "${prefix}1")}] });
    $api{echo_event_a} = $checked->(sub { $event->($_[0], 'A', 'B') });
    $api{echo_event_b} = $checked->(sub { $event->($_[0], 'B', 'A') });
    return \%api;
}

my @results;
for my $result_only (0, 1) {
    for my $prefix (qw(arg value)) {
        my $result = check_nominal_primitive_subtypes(make_nominal_primitive_api($result_only, $prefix), $result_only, $prefix);
        push @results, {resultOnly => $result_only ? JSON::PP::true : JSON::PP::false, parameterPrefix => $prefix, %$result};
    }
}
my @mutations;
for my $field (@names) {
    my $api = make_nominal_primitive_api(0, 'arg');
    my $original = $api->{echo_a};
    $api->{echo_a} = sub { my $result = $original->(@_); my %items = %$result; $items{$field} = 'wrong'; return $api->{Packet}->(%items) };
    my $accepted = eval { check_nominal_primitive_subtypes($api, 0, 'arg', 1); 1 }; my $error = $@;
    die "Caller accepted field mutation: $field" if $accepted;
    die "Unexpected field mutation failure: $error" unless $error =~ /echo_a exact result/;
    push @mutations, $field;
}
for my $mutation (
    ['wrong-word-width', sub { $_[0]{word_bits} = sub { 32 } }],
    ['normalization-bypass', sub { $_[0]{echo_b} = sub { $_[0] } }],
    ['unit-refusal-bypass', sub { $_[0]{refuse_unit} = sub { $_[0] } }],
    ['inactive-branch-added', sub { my $api = $_[0]; $api->{produce_event} = sub { $api->{'Event::Empty'}->() } }],
) {
    my ($name, $mutate) = @$mutation;
    my $api = make_nominal_primitive_api(0, 'arg'); $mutate->($api);
    die "Caller accepted semantic mutation: $name" if eval { check_nominal_primitive_subtypes($api, 0, 'arg', 1); 1 };
    push @mutations, $name;
}
my $cause = 'arg0.right[2]?.natValue was rejected by NominalPrimitiveSubtypes.natB';
my $message = "$cause at $caller_file line 42.\n";
die 'valid diagnostic rejected' unless nominal_diagnostic($message, $cause, $caller_file);
my @bad = ($cause, "$message\n", "$message\0", "prefix $message", "$cause suffix at $caller_file line 42.\n",
    "$cause at other.pl line 42.\n", "$cause at $caller_file line 0.\n", "$cause at $caller_file line -1.\n",
    "$cause at $caller_file line 42\n", "$cause at $caller_file line 42.\r\n", "$message$message", "$cause\0 at $caller_file line 42.\n");
for my $bad (@bad) { die 'invalid diagnostic accepted' if nominal_diagnostic($bad, $cause, $caller_file) }
print JSON::PP->new->canonical->encode({results => \@results, rejectedMutations => \@mutations,
    diagnosticControls => scalar(@bad), installedAcceptance => JSON::PP::false}), "\n";
