use v5.36;
use Test::More;
use Config;
use Scalar::Util qw(weaken);
use IO::Async::Loop::Poll;
use LeanBridge::Pulse;
my $loop=IO::Async::Loop::Poll->new;
my $cursor=LeanBridge::Pulse::series(!!0,!!0,'primary');
is($cursor->next->get->value,'primary','owner cursor is live before clone');
my $future=LeanBridge::Pulse::bytes('done');
my ($w1,$w2,$w3,$w4)=($cursor,$cursor,$future,$future);
weaken($_) for ($w1,$w2,$w3,$w4);
SKIP: {
    skip 'unthreaded Perl',2 unless $Config{useithreads}; require threads;
    my @errors=threads->create({context=>'list'},sub {
        return map { local $@; eval { $_->(); 1 } ? '' : "$@" }
            sub { $cursor->next->get }, sub { $future->get };
    })->join;
    like($errors[0],qr/initiating process|unblessed|undefined/i,'foreign interpreter refuses an inherited open cursor');
    like($errors[1],qr/initiating process|unblessed|undefined/i,'foreign interpreter refuses a completed future');
}
is($cursor->next->get->value,73,'thread destruction did not invalidate original cursor');
$cursor->close;
is(LeanBridge::Runtime::_snapshot()->{live_identities},0,'owner released after clone');
LeanBridge::Pulse::reset();
my $paused=LeanBridge::Pulse::series(!!0,!!1,'pending');
my $pull=$paused->next;
my ($pw1,$pw2)=($pull,$pull); weaken($_) for ($pw1,$pw2);
ok(!$pull->is_ready,'second cursor has a pending native pull during clone');
SKIP: {
    skip 'unthreaded Perl',4 unless $Config{useithreads};
    my @refused=threads->create({context=>'list'},sub {
        return map { !eval { $_->(); 1 } }
            sub { $paused->close }, sub { $pull->done('wrong') },
            sub { $pull->fail('wrong') }, sub { $pull->cancel };
    })->join;
    ok($refused[0],'foreign interpreter cannot close a cursor with an active watch');
    ok($refused[1],'foreign interpreter cannot complete the pending pull');
    ok($refused[2],'foreign interpreter cannot fail the pending pull');
    ok($refused[3],'foreign interpreter cannot cancel the pending pull');
}
LeanBridge::Pulse::release();
is($pull->get->value,'pending','native notification and owner remain usable after clone');
$paused->close;
is(LeanBridge::Runtime::_snapshot()->{live_identities},0,'pending cursor released');
done_testing;
