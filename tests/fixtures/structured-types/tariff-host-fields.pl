use strict;
use warnings;
use JSON::PP ();
use Scalar::Util qw(refaddr);
use LeanBridge::TariffQuotes;

sub check { die "unexpected input-field result at line ".(caller)[2]."\n" unless $_[0] }
sub fails { my ($f)=@_; local $@; return $@ unless eval { $f->(); 1 }; die "unexpected success\n" }
sub input { LeanBridge::TariffQuotes::TariffInput->new(quote => $_[0]) }
sub apply { LeanBridge::TariffQuotes::apply_tariff_with_host_fields(@_) }
sub live { LeanBridge::Runtime::_snapshot()->{live_identities} }
LeanBridge::TariffQuotes::make_tariff(0)->quote->close;
my $baseline=live(); my @settled;
sub settled { push @settled,live(); check($settled[-1] == $baseline) }

my $calls=0;
my $local=input(sub { $_[0] + 39 + ++$calls });
check(apply($local,2)==42 && apply($local,2)==43 && $calls==2);
settled();

my $inner=0;
my $nested=input(sub { apply(input(sub { ++$inner; $_[0]+40 }),$_[0]) });
check(apply($nested,2)==42 && $inner==1);
settled();

my $expired=qr/status=10/;
my $echo=LeanBridge::TariffQuotes::echo_tariff_with_host_fields($local);
check(fails(sub { $echo->quote->call(5) }) =~ $expired);
$echo->quote->close;
my $out=LeanBridge::TariffQuotes::unpack_quote_with_host_fields($local);
check(fails(sub { $out->call(5) }) =~ $expired && $calls==2);
$out->close;
settled();

my $error=bless {},'TariffFailure';
my $caught=fails(sub { apply(input(sub { die $error }),2) });
check(ref($caught) && refaddr($caught)==refaddr($error));
check(apply($local,2)==44);
settled();

my $source=LeanBridge::TariffQuotes::make_tariff(40);
my $saved=LeanBridge::TariffQuotes::echo_tariff_with_host_fields(input($source->quote));
check(apply($source,2)==42);
my $held=live(); check($held>$baseline);
$source->quote->close;
check($saved->quote->call(2)==42);
check(fails(sub { apply($source,2) }) =~ /closed|expired/);
$saved->quote->close;
settled();

my $false_record=bless {quote=>sub { ++$calls }},'NotTariff';
check(fails(sub { apply($false_record,1) }) =~ /Expected exact/);
my $wrong=LeanBridge::TariffQuotes::Tariff->new(quote=>sub { ++$calls });
check(fails(sub { apply($wrong,1) }) =~ /identity|resource|wrapper/i);
check($calls==3 && $inner==1);
settled();

LeanBridge::TariffQuotes::Runtime::shutdown();
check(live()==0);
print JSON::PP->new->canonical->encode({baseline=>$baseline,held=>$held,settled=>\@settled,
    afterShutdown=>live(),hostCalls=>$calls,reentries=>$inner});
