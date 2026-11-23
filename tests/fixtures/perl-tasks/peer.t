use v5.36;
use Test::More;
use Math::BigInt;
use Scalar::Util qw(refaddr);
use IO::Async::Loop::Poll;

my $loop = IO::Async::Loop::Poll->new;
my $nine = Math::BigInt->new(9);
my ($peer, $pulse);
if ($ARGV[0] eq 'peer-first') {
    require LeanBridge::Signals;
    $peer = LeanBridge::Signals::constant($nine);
    is($peer->next->get, $nine, 'first component initialized directly');
    require LeanBridge::Pulse;
    $pulse = LeanBridge::Pulse::bytes("p\0");
} else {
    require LeanBridge::Pulse;
    $pulse = LeanBridge::Pulse::bytes("p\0");
    is($pulse->get, "p\0", 'first component initialized directly');
    require LeanBridge::Signals;
    $peer = LeanBridge::Signals::constant($nine);
}
my $next = $peer->next;
is(refaddr($next->loop), refaddr($loop), 'independent stream uses the application loop');
is(refaddr($pulse->loop), refaddr($loop), 'ordinary task uses the same loop');
is($pulse->get, "p\0", 'primary component output');
is($next->get, $nine, 'peer component output');
$peer->close;

my $bad = LeanBridge::Signals::checked($nine, !!1);
my $ok = eval { $bad->next->get; 1 };
my $err = $@;
ok(!$ok, 'stream factory fails on first demand');
isa_ok($err, 'LeanBridge::Signals::IOError');
is($err->declaration, 'Signals.checked', 'peer error retains its own declaration');
my $units = LeanBridge::Signals::units(Math::BigInt->bone);
my @one = $units->next->get;
is(scalar @one, 1, 'Unit cursor emits a single value');
is($one[0], undef, 'Unit is an undefined Perl value');
my @none = $units->next->get;
is(scalar @none, 0, 'end is observably different from an emitted Unit');
is(LeanBridge::Runtime::_snapshot()->{runtime_init_runs}, 1, 'one native runtime for both packages');
is(LeanBridge::Runtime::_snapshot()->{live_identities}, 0, 'both components released their native owners');
done_testing;
