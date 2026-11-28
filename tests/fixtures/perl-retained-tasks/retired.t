use v5.36;
use Test::More;
use Time::HiRes qw(time);
use IO::Select;
use IO::Async::Loop::Poll;
use XSLoader ();
use LeanBridge::Retained;
XSLoader::load('TestObserver');

my $loop=IO::Async::Loop::Poll->new;
LeanBridge::Retained::reset();
my ($pending,$notification,$calls);
{
    # Borrow the descriptor from the real application loop. Waiting on it
    # without pumping Perl proves the worker queued a request before retire().
    my $watch=IO::Async::Loop::Poll->can('watch_io');
    no warnings qw(redefine once);
    local *IO::Async::Loop::Poll::watch_io=sub ($self,%args) {
        $notification=$args{handle} if $args{on_read_ready};
        $watch->($self,%args);
    };
    $pending=LeanBridge::Retained::queued(sub { ++$calls; 9 });
    my $end=time()+25;
    until ($notification && LeanBridge::Retained::state()==3) {
        die 'worker did not arm its real callback port' if time()>$end;
        $loop->delay_future(after=>0.01)->get;
    }
}
ok(!$pending->is_ready,'retained task is pending before retirement');
LeanBridge::Retained::release();
ok(scalar(IO::Select->new($notification)->can_read(25)),'native request is waiting before retirement');
TestObserver::retire();
my $ok=eval { $pending->get; 1 }; my $error=$@;
ok(!$ok && !ref($error) && $error=~/Lean bridge failure .*status 10/,'queued callback fails as runtime retirement, not an application exception');
is($calls//0,0,'retired native port did not invoke Perl');
my $fresh=eval { LeanBridge::Retained::once(7,sub { ++$calls; 9 })->get; 1 };
ok(!$fresh,'cannot start new callback work on a retired runtime');
my $end=time()+25;
while ((TestObserver::snapshot())[4]) {
    die 'retired native owners did not drain' if time()>$end;
    $loop->delay_future(after=>0.01)->get;
}
is_deeply([(TestObserver::snapshot())[0,1,2,4]],[3,1,1,0],'runtime stayed retired and all native identities drained');
done_testing;
