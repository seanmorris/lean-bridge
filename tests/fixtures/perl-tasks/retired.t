use v5.36;
use Test::More;
use Time::HiRes qw(time);
use XSLoader ();
use IO::Async::Loop::Poll;
use LeanBridge::Pulse;
XSLoader::load('TestObserver');

my $loop = IO::Async::Loop::Poll->new;
sub wait_until ($check) {
    my $end = time() + 25;
    until ($check->()) {
        die 'timed out waiting for native retirement' if time() > $end;
        $loop->delay_future(after => 0.01)->get;
    }
}
my $cursor = LeanBridge::Pulse::series(!!0, !!0, 'held');
is($cursor->next->get->value, 'held', 'idle cursor owns native state');
LeanBridge::Pulse::reset();
my $pending = LeanBridge::Pulse::late(!!1, 7);
wait_until(sub { LeanBridge::Pulse::state() == 1 });
ok(!$pending->is_ready, 'native worker is pending before retirement');
my @before = TestObserver::snapshot();
is_deeply([@before[0..2]], [2,1,1], 'one ready runtime and one component');
ok($before[4] >= 2, 'task and cursor have live identities');
TestObserver::retire();
wait_until(sub { $pending->is_ready });
for my $call (sub { $pending->get }, sub { $cursor->next->get }, sub { LeanBridge::Pulse::bytes('new')->get }) {
    my $ok = eval { $call->(); 1 }; my $e = $@;
    ok(!$ok && !ref($e) && $e =~ /Lean bridge failure .*status 10/,
       'retirement is a bridge failure, not a declared Lean exception');
}
$cursor->close;
wait_until(sub { (TestObserver::snapshot())[4] == 0 });
my @after = TestObserver::snapshot();
is_deeply([@after[0,1,2,4]], [3,1,1,0], 'retired runtime stays retired and native owners drain');
done_testing;
