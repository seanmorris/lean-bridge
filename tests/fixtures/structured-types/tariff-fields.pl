use strict;
use warnings;
use Config;
use Cwd qw(abs_path);
use Digest::SHA qw(sha256_hex);
use JSON::PP;
use Scalar::Util qw(refaddr);
use LeanBridge::TariffQuotes;

sub check { die "check failed at line " . (caller)[2] . "\n" unless $_[0] }
sub quote_record { LeanBridge::TariffQuotes::Tariff->new(quote => $_[0]) }
sub snap { LeanBridge::Runtime::_snapshot()->{live_identities} }
sub refused {
    my ($code, $expected) = @_;
    local $@;
    my $ok = eval { $code->(); 1 };
    my $error = $@;
    die "expected refusal $expected at line " . (caller)[2] . "; got " .
        ($ok ? "a successful return" : "$error") . "\n" unless !$ok && $error =~ $expected;
}
my $package = abs_path($INC{'LeanBridge/TariffQuotes.pm'});
check(index($package, abs_path($ENV{TARIFF_INSTALL}) . '/') == 0);
check(index(abs_path($INC{'LeanBridge/Runtime.pm'}), abs_path($ENV{TARIFF_INSTALL}) . '/') == 0);
(my $dir = $package) =~ s/\.pm\z//;
open my $receipt, '<:raw', "$dir/install-receipt.json" or die "$!";
my $installed = do { local $/; <$receipt> };
close $receipt or die "$!";
LeanBridge::TariffQuotes::make_tariff(0)->quote->close;
my $baseline = snap();
my $source = LeanBridge::TariffQuotes::make_tariff(40);
my $echo = LeanBridge::TariffQuotes::echo_tariff(quote_record($source->quote));
my $unpacked = LeanBridge::TariffQuotes::unpack_quote($echo);
my $retained = $unpacked->retain;
my $repacked = LeanBridge::TariffQuotes::pack_quote($retained);
my $keep = $repacked->quote->retain;
my $held = snap();
check($held > $baseline);
$_->close for ($source->quote, $echo->quote, $unpacked, $retained, $repacked->quote);
check($keep->call(3) == 43);
check(LeanBridge::TariffQuotes::apply_tariff(quote_record($keep), 2) == 42);

my $visits = 0;
my $expired = LeanBridge::TariffQuotes::pack_quote(sub { ++$visits; $_[0] });
my $expired_callback = qr/\ALean ownership failed \(status=10\): host callback failed\b/;
refused(sub { $expired->quote->call(1) }, $expired_callback);
refused(sub { LeanBridge::TariffQuotes::apply_tariff($expired, 1) }, $expired_callback);
check($visits == 0);
$expired->quote->close;

my $fallback = LeanBridge::TariffQuotes::make_tariff(100)->quote;
my $calls = 0;
my $stage = LeanBridge::TariffQuotes::Runtime::Callback->new(
    code => sub { check($_[0] == 40); ++$calls; return $keep }, recovery => $fallback);
my $staged = LeanBridge::TariffQuotes::staged_quote($stage, 40, 4);
check($staged == 44 && $calls == 1);
my $error = bless {}, 'ApplicationFailure';
my $bad = LeanBridge::TariffQuotes::Runtime::Callback->new(
    code => sub {
        my $temporary = LeanBridge::TariffQuotes::make_tariff(5)->quote;
        check($temporary->call(1) == 6);
        $temporary->close;
        die $error;
    }, recovery => $fallback);
my $ok = eval { LeanBridge::TariffQuotes::staged_quote($bad, 9, 3); 1 };
my $caught = $@;
check(!$ok && ref($caught) && refaddr($caught) == refaddr($error));
check($fallback->call(2) == 102 && $keep->call(5) == 45);
$fallback->close; $keep->close;
# A closed Perl wrapper is refused by XS before the underlying call can return a numeric status.
refused(sub { LeanBridge::TariffQuotes::echo_tariff(quote_record($keep)) },
    qr/\ALean identity is closed or its callback borrow has expired\b/);
my $fresh = LeanBridge::TariffQuotes::make_tariff(6)->quote;
my $recovered = $fresh->call(36);
check($recovered == 42);
$fresh->close;
my $after = snap();
check($after == $baseline);
LeanBridge::TariffQuotes::Runtime::shutdown();
my $closed = snap();
check($closed == 0);
print JSON::PP->new->canonical->encode({version => $Config{version}, arch => $Config{archname},
    threads => ($Config{useithreads} // '') eq 'define' ? 'threaded' : 'unthreaded',
    installReceiptSha256 => sha256_hex($installed), baseline => $baseline, held => $held,
    after => $after, shutdown => $closed, stageCalls => $calls, staged => $staged,
    staleVisits => $visits, recovered => $recovered});
