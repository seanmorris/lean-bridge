# Synthetic caller controls only. No Lean execution or installed-package claim.
use strict;
use warnings;
use JSON::PP;
my ($caller_file, $prefix) = @ARGV;
require $caller_file;

sub make_structural_api {
    my %api;
    for my $name (qw(Some Ok Err)) {
        my $class = "LeanBridge::StructuralSubtypes::$name";
        $api{$name} = sub { bless {value => $_[0]}, $class };
    }
    my ($some, $ok, $err) = @api{qw(Some Ok Err)};
    my $arg = $prefix . '0';
    my $refusal = sub { die "$_[0] was rejected by StructuralSubtypes.$_[1] at $caller_file line 42.\n" };
    my $positive = sub {
        my ($value, $path, $normalize) = @_;
        $refusal->($path, $normalize ? 'normalizePositive' : 'checkedPositive') if $value->is_zero;
        return $normalize ? $value->copy->binc : $value->copy;
    };
    my $word = sub { $refusal->($_[1], 'checkedWord') unless length($_[0]); return $_[0] };
    my $bound = sub { die "$_[1] is not below its Fin $_[2] bound at $caller_file line 42.\n" if $_[0] >= $_[2] };
    my $group = sub {
        my ($values, $path, $normalize) = @_;
        return [map { defined($values->[$_]) ? $some->($positive->($values->[$_]{value}, $path . "[$_]?", $normalize)) : undef } 0..$#$values];
    };
    $api{scalar} = sub { $positive->($_[0], $arg) };
    for my $name (qw(arrays lists specialized)) {
        $api{$name} = sub { my $values = $_[0]; [map { $positive->($values->[$_], $arg . "[$_]") } 0..$#$values] };
    }
    $api{options} = sub { defined($_[0]) ? $some->($positive->($_[0]{value}, "$arg?")) : undef };
    $api{product} = sub { [$positive->($_[0][0], "$arg.0"), $word->($_[0][1], "$arg.1")] };
    $api{branch} = sub { ref($_[0]) =~ /::Ok\z/ ? $ok->($positive->($_[0]{value}, "$arg.ok")) : $err->($word->($_[0]{value}, "$arg.error")) };
    $api{byte_branches} = sub {
        my $values = $_[0]; my @result;
        for my $i (0..$#$values) {
            unless (defined $values->[$i]) { push @result, undef; next }
            my ($byte, $nat) = @{$values->[$i]{value}};
            $refusal->($arg . "[$i]?.0", 'checkedByte') unless $byte;
            push @result, $some->([$byte, $positive->($nat, $arg . "[$i]?.1")]);
        }
        return \@result;
    };
    $api{nested} = sub {
        my $rows = $_[0];
        for my $i (0..$#$rows) { for my $j (0..$#{$rows->[$i]}) {
            $bound->($rows->[$i][$j]{value}[1], $arg . "[$i][$j]?.1", structural_nat('184467440737095516170')) if defined $rows->[$i][$j];
        } }
        for my $i (0..$#$rows) { for my $j (0..$#{$rows->[$i]}) {
            $positive->($rows->[$i][$j]{value}[0], $arg . "[$i][$j]?.0") if defined $rows->[$i][$j];
        } }
        return structural_nat(scalar @$rows);
    };
    $api{plain_fin} = sub {
        my $values = $_[0];
        for my $i (0..$#$values) { $bound->($values->[$i]{value}, $arg . "[$i]?", structural_nat(10)) if defined $values->[$i] }
        return structural_nat(scalar @$values);
    };
    $api{alias_pair} = sub { [$group->($_[0][0], "$arg.0"), $group->($_[0][1], "$arg.1", 1)] };
    $api{alias_arguments} = sub { [@{$group->($_[0], $arg)}, @{$group->($_[1], $prefix . '1', 1)}] };
    return \%api;
}

my $json = JSON::PP->new->canonical;
my $expected = {checks => 4119, rejections => 1042, snapshotControls => 6};
die 'wrong baseline' unless $json->encode(check_structural_subtypes(make_structural_api())) eq $json->encode($expected);
my @mutations = (
    ['scalar', sub { $_[0] }], ['arrays', sub { $_[0] }],
    ['product', sub { [$_[0][0], (split /\0/, $_[0][1])[0]] }],
    ['alias_pair', sub { $_[0] }], ['nested', sub { structural_nat(scalar @{$_[0]}) }],
    ['branch', sub { $_[0] }],
);
my $controls = 0;
for my $mutation (@mutations) {
    my $api = make_structural_api(); $api->{$mutation->[0]} = $mutation->[1];
    die "undetected mutant $mutation->[0]" if eval { check_structural_subtypes($api); 1 };
    $controls++;
}
for my $position (0..1) {
    my $api = make_structural_api(); my $original = $api->{alias_arguments};
    $api->{alias_arguments} = sub {
        my ($left, $right) = @_;
        for my $i (0..$#$right) {
            next unless defined($right->[$i]) && $right->[$i]{value}->is_zero;
            # Mutate the existing BigInt, not just the wrapper or array reference.
            ($position ? $right : $left)->[0]{value}->binc;
            die $prefix . "1[$i]? was rejected by StructuralSubtypes.normalizePositive at $caller_file line 42.\n";
        }
        return $original->($left, $right);
    };
    die "undetected input mutation $position" if eval { check_structural_subtypes($api); 1 };
    $controls++;
}
my $cause = 'arg0[2]?.0 was rejected by StructuralSubtypes.checkedPositive';
my $message = "$cause at $caller_file line 42.\n";
die 'valid diagnostic rejected' unless structural_diagnostic($message, $cause, $caller_file);
my @bad = ($cause, "$message\n", "$message\0", "prefix $message", "$cause suffix at $caller_file line 42.\n",
    "$cause at other.pl line 42.\n", "$cause at $caller_file line 0.\n", "$cause at $caller_file line -1.\n",
    "$cause at $caller_file line 42\n", "$cause at $caller_file line 42.\r\n", "$message$message", "$cause\0 at $caller_file line 42.\n");
for my $bad (@bad) { die 'invalid diagnostic accepted' if structural_diagnostic($bad, $cause, $caller_file) }
print $json->encode({%$expected, callerMutationControls => $controls, diagnosticControls => scalar @bad}), "\n";
