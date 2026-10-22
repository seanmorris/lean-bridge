# Independent Perl caller for a proof-erased dependent checked record.
use strict;
use warnings;
use JSON::PP ();
use Math::BigInt;

sub check_dependent_records {
    my ($api, $result_only, $parameter_prefix) = @_;
    die "invalid dependent-record caller options\n"
        unless defined($api) && ($result_only == 0 || $result_only == 1)
            && ($parameter_prefix eq 'arg' || $parameter_prefix eq 'value');
    my ($checks, $calls, $rejections, $recoveries, $snapshots)
        = (0, 0, 0, 0, 0);
    my $check = sub {
        die "dependent-record assertion failed: $_[1]\n" unless $_[0];
        ++$checks;
    };
    my $nat = sub { Math::BigInt->new("$_[0]") };
    my $class = "${api}::Dependent";
    my $record = sub { $class->new(bound => $_[0], below => $_[1]) };
    my $same_record = sub {
        my ($left, $right) = @_;
        return ref($left) eq $class && ref($right) eq $class
            && $left->bound->bcmp($right->bound) == 0
            && $left->below->bcmp($right->below) == 0;
    };
    my $snapshot = sub {
        my ($value) = @_;
        return [ref($value), $value->bound->bstr, $value->below->bstr];
    };
    my $same_snapshot = sub {
        JSON::PP->new->canonical->encode($_[0])
            eq JSON::PP->new->canonical->encode($_[1]);
    };
    my $function = sub {
        my ($name) = @_;
        my $code = $api->can($name);
        die "missing public function: $name\n" unless $code;
        return $code;
    };
    $check->(!!$api->can('dependent_total') != !!$result_only
        , 'dependent_total export selection');
    $check->(!!$api->can('dependent_roundtrip') != !!$result_only
        , 'dependent_roundtrip export selection');
    $check->(!!$api->can('dependent_result'), 'dependent_result export selection');

    my $result = sub {
        my ($seed, $label) = @_;
        ++$calls; ++$snapshots;
        my $value = $function->('dependent_result')->($seed);
        $check->($same_record->($value
            , $record->($seed->copy->badd(1), $seed->copy))
            , "$label exact result");
        return $value;
    };
    for my $index (0 .. 511) {
        $result->($nat->($index), "result $index");
    }
    my $huge = $nat->(1)->blsft(130);
    $result->($huge, 'huge result');

    unless ($result_only) {
        my $invoke = sub {
            my ($name, $arguments, $expected, $label) = @_;
            my $before = $snapshot->($arguments->[0]);
            ++$calls; ++$snapshots;
            my $value = $function->($name)->(@$arguments);
            $check->(ref($expected) eq $class
                ? $same_record->($value, $expected)
                : $value->bcmp($expected) == 0, "$label exact result");
            $check->($same_snapshot->($snapshot->($arguments->[0]), $before)
                , "$label preserves caller input");
            return $value;
        };
        my $refused = sub {
            my ($value, $label) = @_;
            my $before = $snapshot->($value);
            ++$calls; ++$snapshots;
            my $passed = eval { $function->('dependent_total')->($value); 1 };
            my $error = "$@"; $error =~ s/\n\z//;
            $check->(!$passed, "$label refuses invalid input");
            my $message = "${parameter_prefix}0 was rejected by DependentRecords.mkDependent";
            $check->(index($error, "$message at ") == 0
                , "$label exact checked-record refusal: $error");
            $check->($same_snapshot->($snapshot->($value), $before)
                , "$label preserves rejected input");
            ++$rejections;
        };
        my $recover = sub {
            $invoke->('dependent_total', [$record->($nat->(2), $nat->(1))]
                , $nat->(3), 'recovery');
            ++$recoveries;
        };
        $invoke->('dependent_total', [$record->($nat->(3), $nat->(2))]
            , $nat->(5), 'valid total');
        $refused->($record->($nat->(2), $nat->(2)), 'equal fields');
        $recover->();
        $refused->($record->($nat->(0), $nat->(0)), 'zero bound');
        $recover->();
        my $valid = $record->($nat->(3), $nat->(2));
        $invoke->('dependent_roundtrip', [$valid], $valid, 'roundtrip');
        my $below = $huge->copy->bsub(1);
        $invoke->('dependent_total', [$record->($huge, $below)]
            , $huge->copy->badd($below), 'huge total');
        my $huge_record = $record->($huge, $below);
        $invoke->('dependent_roundtrip', [$huge_record]
            , $huge_record, 'huge roundtrip');
        for my $index (0 .. 255) {
            my $bound = $nat->($index + 1);
            my $below = $nat->($index);
            $invoke->('dependent_total', [$record->($bound, $below)]
                , $nat->(2 * $index + 1), "loop total $index");
            $refused->($record->($bound, $bound), "loop refusal $index");
            $recover->();
        }
    }
    return { checks => $checks, calls => $calls, rejections => $rejections
        , recoveries => $recoveries, snapshots => $snapshots };
}

my $result_only = grep { $_ eq '--result-only' } @ARGV;
my $reviewed = grep { $_ eq '--reviewed' } @ARGV;
require LeanBridge::DependentRecords;
my $result = check_dependent_records('LeanBridge::DependentRecords'
    , $result_only ? 1 : 0, $reviewed ? 'value' : 'arg');
print JSON::PP->new->canonical->encode($result), "\n";
