use strict;
use warnings;
use Config;
use JSON::PP;
use LeanBridge::OwnedProbe;

my $mode = shift // die "expected sanitizer mode\n";
if ($mode eq 'runtime' || $mode eq 'faults' || $mode eq 'process-reentry' || $mode eq 'reentrant-shutdown') {
    my $path = $mode eq 'runtime' ? './runtime.pl' : $mode eq 'faults' ? './faults.pl' : './lifetime.pl';
    @ARGV = $mode eq 'runtime' ? ('combined') : $mode eq 'faults' ? () : ($mode);
    my $result = do $path;
    die $@ if $@;
    die "failed to execute $path: $!\n" unless defined $result;
    exit 0;
}
LeanBridge::OwnedProbe::Runtime::shutdown();
my @snapshot = LeanBridge::OwnedProbe::snapshot();
die "cold sanitizer baseline retained ownership\n" if grep { $_ } @snapshot[0..3,6,7];
if ($mode eq 'native-address') { LeanBridge::OwnedProbe::sanitizer_native_address(8) }
elsif ($mode eq 'xs-address') { LeanBridge::OwnedProbe::sanitizer_xs_address(8) }
elsif ($mode eq 'native-undefined') { LeanBridge::OwnedProbe::sanitizer_native_undefined(40) }
elsif ($mode eq 'xs-undefined') { LeanBridge::OwnedProbe::sanitizer_xs_undefined(40) }
elsif ($mode eq 'native-leak') { LeanBridge::OwnedProbe::sanitizer_native_leak() }
elsif ($mode eq 'xs-leak') { LeanBridge::OwnedProbe::sanitizer_xs_leak() }
elsif ($mode ne 'cold') { die "unknown sanitizer mode\n" }
die "sanitizer missed $mode\n" unless $mode eq 'cold' || $mode =~ /-leak$/;
print JSON::PP->new->canonical->encode({mode => $mode, final => [@snapshot[0..3,6,7]],
    perlVersion => "$^V", threaded => $Config{useithreads} ? 1 : 0}), "\n";
