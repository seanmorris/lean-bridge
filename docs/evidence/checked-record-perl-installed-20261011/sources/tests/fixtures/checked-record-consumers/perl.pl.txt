use strict;
use warnings;
use Math::BigInt;
use Scalar::Util qw(refaddr);
use LeanBridge::CheckedRecords;

my $checks = 0;
sub check { die "checked-record assertion failed\n" unless $_[0]; ++$checks; }
sub n { Math::BigInt->new("$_[0]") }
sub values_of { join(',', map { $_->bstr } @{$_[0]}) }

# BEGIN CHECKED INPUT HELPERS
sub interval { LeanBridge::CheckedRecords::Interval->new(lo => n($_[0]), hi => n($_[1])) }
sub triple { LeanBridge::CheckedRecords::Triple->new(data => [map { n($_) } @_]) }
sub percent { LeanBridge::CheckedRecords::Percent->new(value => n($_[0])) }
sub rejected {
    my ($call, $message) = @_;
    my $passed = eval { $call->(); 1 };
    my $error = "$@";
    return !$passed && index($error, $message . ' at ') == 0;
}
# END CHECKED INPUT HELPERS

my $big = Math::BigInt->new(2)->bpow(100);
# BEGIN CHECKED INPUT CASES
my $good = interval(3, 10);
my $bad = interval(9, 3);
my $values = [n(9), n(2), n(4)];
my $triple = LeanBridge::CheckedRecords::Triple->new(data => $values);
check(LeanBridge::CheckedRecords::width($good)->bstr eq '7');
check(LeanBridge::CheckedRecords::width(interval(1, 1))->bstr eq '0');
check(LeanBridge::CheckedRecords::width(interval($big, $big->copy->badd(9)))->bstr eq '9');
check(LeanBridge::CheckedRecords::span($good, interval(5, 20))->bstr eq '17');
check(rejected(sub { LeanBridge::CheckedRecords::width($bad) }, "arg0 was rejected by CheckedRecords.mkInterval"));
check(rejected(sub { LeanBridge::CheckedRecords::span($bad, $good) }, "arg0 was rejected by CheckedRecords.mkInterval"));
check(rejected(sub { LeanBridge::CheckedRecords::span($good, $bad) }, "arg1 was rejected by CheckedRecords.mkInterval"));
check(LeanBridge::CheckedRecords::total($triple)->bstr eq '15');
check(LeanBridge::CheckedRecords::first_of($triple)->bstr eq '9');
check(LeanBridge::CheckedRecords::smallest($triple)->bstr eq '2');
check(values_of($triple->data) eq '9,2,4' && values_of($values) eq '9,2,4');
check(values_of(LeanBridge::CheckedRecords::scale(n(3), $triple)->data) eq '27,6,12');
check(values_of($triple->data) eq '9,2,4' && values_of($values) eq '9,2,4');
check(rejected(sub { LeanBridge::CheckedRecords::total(triple()) }, "arg0 was rejected by CheckedRecords.mkTriple"));
check(rejected(sub { LeanBridge::CheckedRecords::first_of(triple(1, 2)) }, "arg0 was rejected by CheckedRecords.mkTriple"));
check(rejected(sub { LeanBridge::CheckedRecords::smallest(triple(4, 3, 2, 1)) }, "arg0 was rejected by CheckedRecords.sortedTriple"));
check(rejected(sub { LeanBridge::CheckedRecords::scale(n(3), triple(1, 2)) }, "arg1 was rejected by CheckedRecords.mkTriple"));
check(LeanBridge::CheckedRecords::complement(percent(0))->bstr eq '100');
check(LeanBridge::CheckedRecords::complement(percent(100))->bstr eq '0');
check(rejected(sub { LeanBridge::CheckedRecords::complement(percent(101)) }, "arg0 was rejected by CheckedRecords.mkPercent"));
check(rejected(sub { LeanBridge::CheckedRecords::complement(percent($big)) }, "arg0 was rejected by CheckedRecords.mkPercent"));
for my $i (0 .. 999) {
    check(rejected(sub { LeanBridge::CheckedRecords::width(interval($i + 1, $i)) }, "arg0 was rejected by CheckedRecords.mkInterval"));
    check(LeanBridge::CheckedRecords::width(interval($i, $i + 7))->bstr eq '7');
    check(rejected(sub { LeanBridge::CheckedRecords::total(triple(1, 2)) }, "arg0 was rejected by CheckedRecords.mkTriple"));
    check(LeanBridge::CheckedRecords::total($triple)->bstr eq '15');
    check(rejected(sub { LeanBridge::CheckedRecords::smallest(triple(4, 3, 2, 1)) }, "arg0 was rejected by CheckedRecords.sortedTriple"));
    check(LeanBridge::CheckedRecords::smallest($triple)->bstr eq '2');
    check(rejected(sub { LeanBridge::CheckedRecords::complement(percent(101)) }, "arg0 was rejected by CheckedRecords.mkPercent"));
    check(LeanBridge::CheckedRecords::complement(percent(100))->bstr eq '0');
}
check(values_of($triple->data) eq '9,2,4' && values_of($values) eq '9,2,4' && $good->lo->bstr eq '3' && $good->hi->bstr eq '10' && $bad->lo->bstr eq '9' && $bad->hi->bstr eq '3');
# END CHECKED INPUT CASES

check(values_of(LeanBridge::CheckedRecords::repeated($big)->data) eq join(',', ($big->bstr) x 3));
my $first = LeanBridge::CheckedRecords::repeated(n(7));
my $second = LeanBridge::CheckedRecords::repeated(n(7));
check(refaddr($first) != refaddr($second) && refaddr($first->data) != refaddr($second->data) && values_of($second->data) eq '7,7,7');
for my $i (0 .. 999) {
    check(values_of(LeanBridge::CheckedRecords::repeated(n($i))->data) eq "$i,$i,$i");
}
print "checked-record-ok:$checks\n";
