use v5.36;
use Test::More;
use IO::Async::Loop::Poll;
use Scalar::Util qw(refaddr);
my $loop=IO::Async::Loop::Poll->new;
if ($ARGV[0] eq 'relay-first') {
    require LeanBridge::Relay;
    is(LeanBridge::Relay::direct(12)->get,13,'relay initialized first');
    require LeanBridge::Retained;
} else {
    require LeanBridge::Retained;
    is(LeanBridge::Retained::plain(12),13,'primary initialized first');
    require LeanBridge::Relay;
}
my $subscriber=LeanBridge::Retained::RetainedCallback->new(sub ($text) { return $text.'!' });
my $sub=$subscriber->callback;
my $a=LeanBridge::Retained::repeat_call('a',$sub);
my $b=LeanBridge::Relay::run('b',$sub);
is(refaddr($a->loop),refaddr($b->loop),'two compiled callback ports share the application loop');
is($b->get,'b!!','peer worker dispatches the primary registration');
is($a->get,'a!!','primary worker dispatches the same registration');
$subscriber->close;
my $bad=eval { LeanBridge::Relay::run('x',$sub)->get; 1 }; my $err=$@;
ok(!$bad && $err=~/closed/,'peer sees explicit revocation without importing a private primary class');
my $nested=LeanBridge::Relay::run('z',sub ($v) {
    return LeanBridge::Retained::repeat_call($v,sub ($s) { $s.'?' })->get;
});
is($nested->get,'z????','worker callback can await a different component while its own reply remains pending');
my $snap=LeanBridge::Runtime::_snapshot();
is($snap->{runtime_init_runs},1,'one Lean runtime');
is_deeply([@{$snap}{qw(live_wrappers live_identities live_callbacks live_scopes)}],[0,0,0,0],'both ports drained');
done_testing;
