# Synthetic controls for the independent Perl caller. This never executes Lean.
use strict;
use warnings;
use JSON::PP;
my ($caller_file, $prefix, $mode) = @ARGV;
die 'select full or result-only' unless defined($mode) && ($mode eq 'full' || $mode eq 'result-only');
die 'select argument labels' unless defined($prefix) && ($prefix eq 'arg' || $prefix eq 'value');
require $caller_file;

sub make_nominal_api {
    my %api;
    for my $name (qw(Some Ok Err)) {
        my $class = "LeanBridge::NominalSubtypes::$name";
        $api{$name} = sub { bless {value => $_[0]}, $class };
    }
    for my $name (qw(Envelope Pair AliasPair Event::Empty Event::Box Event::Choices)) {
        my $class = "LeanBridge::NominalSubtypes::$name";
        $api{$name} = sub { bless {@_}, $class };
    }
    my ($some, $ok, $err) = @api{qw(Some Ok Err)};
    my ($arg, $arg1) = ($prefix . '0', $prefix . '1');
    my $bound = sub { die "$_[1] is not below its Fin 3 bound at $caller_file line 42.\n" if $_[0] >= 3 };
    my $make = sub {
        my ($value, $path, $increment) = @_;
        my ($limit, $constructor) = $increment == 1 ? (100, 'plusOne') : (90, 'plusTwo');
        die "$path was rejected by NominalSubtypes.$constructor at $caller_file line 42.\n" if $value >= $limit;
        return $value->copy->badd($increment);
    };
    my $box = sub { $api{Envelope}->(payload => $_[0], digit => $_[1] // nominal_nat(2)) };
    my $box_guard = sub { $bound->($_[0]{digit}, "$_[1].digit") };
    my $group_guard = sub {
        my ($values, $path) = @_;
        for my $i (0..$#$values) { $box_guard->($values->[$i]{value}, "$path\[$i]?") if defined $values->[$i] }
    };
    my $normalize_box = sub { $box->($make->($_[0]{payload}, "$_[1].payload", $_[2]), $_[0]{digit}->copy) };
    my $group = sub {
        my ($values, $path, $increment) = @_;
        return [map { defined($values->[$_]) ? $some->($normalize_box->($values->[$_]{value}, "$path\[$_]?", $increment)) : undef } 0..$#$values];
    };
    my $sum_group = sub {
        my $total = nominal_nat(0);
        for my $value (@{$_[0]}) { $total->badd($value->{value}{payload}) if defined $value }
        return $total;
    };
    my $event = sub {
        my ($value, $first, $second) = @_;
        return $api{'Event::Empty'}->() if ref($value) =~ /::Empty\z/;
        if (ref($value) =~ /::Box\z/) {
            $box_guard->($value->{value}, "$arg.box.value");
            return $api{'Event::Box'}->(value => $normalize_box->($value->{value}, "$arg.box.value", $first));
        }
        my $items = $value->{values};
        return $api{'Event::Choices'}->(values => [map {
            my $i = $_; my $item = $items->[$i];
            !defined($item) ? undef : ref($item->{value}) =~ /::Ok\z/
                ? $some->($ok->($make->($item->{value}{value}, "$arg.choices.values[$i]?.ok", $first)))
                : $some->($err->($make->($item->{value}{value}, "$arg.choices.values[$i]?.error", $second)))
        } 0..$#$items]);
    };
    my $sum_event = sub {
        my $value = $_[0];
        return nominal_nat(0) if ref($value) =~ /::Empty\z/;
        return $value->{value}{payload}->copy if ref($value) =~ /::Box\z/;
        my $total = nominal_nat(0);
        for my $item (@{$value->{values}}) { $total->badd($item->{value}{value}) if defined $item }
        return $total;
    };
    for my $selection (['first', 1], ['second', 2], ['echo', 1]) {
        my ($name, $increment) = @$selection;
        $api{$name} = sub {
            $box_guard->($_[0], $arg);
            my $result = $normalize_box->($_[0], $arg, $increment);
            return $name eq 'echo' ? $result : $result->{payload};
        };
    }
    $api{combine} = sub {
        $box_guard->($_[0], $arg); $box_guard->($_[1], $arg1);
        return $make->($_[0]{payload}, "$arg.payload", 1)->bmul(100)->badd($make->($_[1]{payload}, "$arg1.payload", 2));
    };
    $api{nested} = sub {
        my $value = $_[0];
        $box_guard->($value->{left}, "$arg.left"); $box_guard->($value->{right}, "$arg.right");
        return $make->($value->{left}{payload}, "$arg.left.payload", 1)->bmul(100)->badd($make->($value->{right}{payload}, "$arg.right.payload", 2));
    };
    $api{event_first} = sub { $sum_event->($event->($_[0], 1, 2)) };
    $api{event_second} = sub { $sum_event->($event->($_[0], 2, 1)) };
    $api{echo_event} = sub { $event->($_[0], 1, 2) };
    $api{aliases} = sub {
        $group_guard->($_[0], $arg); $group_guard->($_[1], $arg1);
        return $sum_group->($group->($_[0], $arg, 1))->badd($sum_group->($group->($_[1], $arg1, 2)));
    };
    $api{echo_groups} = sub { $group_guard->($_[0], $arg); $group->($_[0], $arg, 1) };
    $api{echo_pair} = sub {
        my $value = $_[0];
        $group_guard->($value->{left}, "$arg.left"); $group_guard->($value->{right}, "$arg.right");
        return $api{AliasPair}->(left => $group->($value->{left}, "$arg.left", 1), right => $group->($value->{right}, "$arg.right", 2));
    };
    $api{inspect_alias_pair} = sub {
        my $normalized = $api{echo_pair}->($_[0]);
        return $sum_group->($normalized->{left})->badd($sum_group->($normalized->{right}));
    };
    $api{plain_fin} = sub { $bound->($_[0], $arg); $_[0]->copy };
    my $output_group = sub { [undef, $some->($box->($_[0]->copy->binc))] };
    $api{scalar} = sub { $_[0]->copy->binc };
    $api{produce_envelope} = sub { $box->($_[0]->copy->binc) };
    $api{array_values} = sub { [$_[0]->copy->binc, $_[0]->copy->badd(2)] };
    $api{list_values} = $api{array_values}; $api{product} = $api{array_values};
    $api{optional} = sub { $_[0]->is_zero ? undef : $some->($_[0]->copy->binc) };
    $api{branch} = sub { $_[0]->is_zero ? $err->(nominal_nat(1)) : $ok->($_[0]->copy->binc) };
    $api{group_values} = $output_group;
    $api{pair_values} = sub { $api{AliasPair}->(left => $output_group->($_[0]), right => $output_group->($_[0]->copy->binc)) };
    $api{event_value} = sub { $api{'Event::Box'}->(value => $box->($_[0]->copy->binc)) };
    $api{event_empty} = sub { $api{'Event::Empty'}->() };
    $api{event_choices} = sub { $api{'Event::Choices'}->(values => [undef, $some->($ok->($_[0]->copy->binc)), $some->($err->($_[0]->copy->badd(2)))]) };
    $api{no_items} = sub { [] };
    return \%api;
}

my $result_only = $mode eq 'result-only';
my $expected = check_nominal_subtypes(make_nominal_api(), $result_only);
my @mutations = (
    ['scalar', sub { $_[0]->copy->binc->bmod(nominal_nat(2)->bpow(64)) }],
    ['produce_envelope', sub { bless {value => $_[0]->copy->binc}, 'LeanBridge::NominalSubtypes::Some' }],
    ['optional', sub { undef }], ['branch', sub { bless {value => nominal_nat(1)}, 'LeanBridge::NominalSubtypes::Ok' }],
    ['event_choices', sub { bless {values => []}, 'LeanBridge::NominalSubtypes::Event::Choices' }],
    ['pair_values', sub { bless {left => [], right => []}, 'LeanBridge::NominalSubtypes::AliasPair' }],
    ['scalar', sub { $_[0]->binc }],
);
unless ($result_only) {
    push @mutations,
        ['first', sub { $_[0]{payload}->copy->badd(2) }], ['second', sub { $_[0]{payload}->copy->binc }],
        ['nested', sub { nominal_nat(4141) }], ['event_second', sub { nominal_nat(0) }],
        ['aliases', sub { nominal_nat(46) }], ['echo_pair', sub { $_[0] }],
        ['combine', sub { die "$prefix" . "0.payload was rejected by NominalSubtypes.plusOne at $caller_file line 42.\n" }];
}
my $controls = 0;
for my $mutation (@mutations) {
    my $api = make_nominal_api(); $api->{$mutation->[0]} = $mutation->[1];
    die "undetected mutant $mutation->[0]" if eval { check_nominal_subtypes($api, $result_only); 1 };
    $controls++;
}
unless ($result_only) {
    for my $position (0..1) {
        my $api = make_nominal_api(); my $original = $api->{echo_pair};
        $api->{echo_pair} = sub {
            my $value = $_[0];
            for my $i (0..$#{$value->{right}}) {
                next unless defined($value->{right}[$i]) && $value->{right}[$i]{value}{payload} >= 90;
                my $target = $position ? $value->{right}[$i] : $value->{left}[1];
                $target->{value}{payload}->binc;
                die "$prefix" . "0.right[$i]?.payload was rejected by NominalSubtypes.plusTwo at $caller_file line 42.\n";
            }
            return $original->($value);
        };
        die "undetected rejected-input mutation $position" if eval { check_nominal_subtypes($api, 0); 1 };
        $controls++;
    }
}
my $cause = 'arg0.choices.values[2]?.error was rejected by NominalSubtypes.plusTwo';
my $message = "$cause at $caller_file line 42.\n";
die 'valid diagnostic rejected' unless nominal_diagnostic($message, $cause, $caller_file);
my @bad = ($cause, "$message\n", "$message\0", "prefix $message", "$cause suffix at $caller_file line 42.\n",
    "$cause at other.pl line 42.\n", "$cause at $caller_file line 0.\n", "$cause at $caller_file line -1.\n",
    "$cause at $caller_file line 42\n", "$cause at $caller_file line 42.\r\n", "$message$message", "$cause\0 at $caller_file line 42.\n");
for my $bad (@bad) { die 'invalid diagnostic accepted' if nominal_diagnostic($bad, $cause, $caller_file) }
print JSON::PP->new->canonical->encode({%$expected, callerMutationControls => $controls, diagnosticControls => scalar @bad}), "\n";
