use strict;
use warnings;
use Math::BigInt;
use Scalar::Util qw(refaddr);
use LeanBridge::CheckedRecords;

my $checks = 0;
sub check { die "checked-record assertion failed\n" unless $_[0]; ++$checks; }
sub n { Math::BigInt->new("$_[0]") }
sub values_of { join(',', map { $_->bstr } @{$_[0]}) }


my $big = Math::BigInt->new(2)->bpow(100);

check(values_of(LeanBridge::CheckedRecords::repeated($big)->data) eq join(',', ($big->bstr) x 3));
my $first = LeanBridge::CheckedRecords::repeated(n(7));
my $second = LeanBridge::CheckedRecords::repeated(n(7));
check(refaddr($first) != refaddr($second) && refaddr($first->data) != refaddr($second->data) && values_of($second->data) eq '7,7,7');
for my $i (0 .. 999) {
    check(values_of(LeanBridge::CheckedRecords::repeated(n($i))->data) eq "$i,$i,$i");
}
print "checked-record-ok:$checks\n";
