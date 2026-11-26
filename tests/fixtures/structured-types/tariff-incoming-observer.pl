use strict;
use warnings;
use JSON::PP ();
use FindBin;
require "$FindBin::Bin/tariff-incoming.pl";
my @samples;
exercise_incoming_quote(sub {
    my ($name)=@_; my $n=LeanBridge::Runtime::_snapshot()->{live_identities};
    die "$name: observed $n" if ($name eq 'held' ? $n<=1 : $n!=1);
    push @samples,[$name,$n];
});
LeanBridge::TariffQuotes::Runtime::shutdown();
my $after=LeanBridge::Runtime::_snapshot()->{live_identities};
die "native identities survived shutdown: $after" if $after;
push @samples,['afterShutdown',$after];
print JSON::PP->new->encode(\@samples),"\n";
