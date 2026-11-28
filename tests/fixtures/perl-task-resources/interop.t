use v5.36;
use Test::More;
use Scalar::Util qw(refaddr weaken);
use IO::Async::Loop::Poll;
use Time::HiRes qw(time);
use POSIX ();
use Config;
use LeanBridge::Runtime;

my $loop=IO::Async::Loop::Poll->new;
if ($ARGV[0] eq 'ordinary-first') { require LeanBridge::ResourcePeer; require LeanBridge::Counter; require LeanBridge::Depot }
else { require LeanBridge::Depot; require LeanBridge::Counter; require LeanBridge::ResourcePeer }
sub error_from ($fn) { my $ok=eval { $fn->(); 1 }; my $e=$@; die 'expected failure' if $ok; return $e }
sub null_descriptors () {
    opendir(my $dir,'/proc/self/fd') or die $!;
    my $count=grep { (readlink("/proc/self/fd/$_")//'') eq '/dev/null' } readdir($dir);
    closedir($dir); return $count;
}
sub wait_until ($check) {
    my $end=time()+25;
    until ($check->()) { die 'native resource timeout' if time()>$end; $loop->delay_future(after=>0.01)->get }
}
my $fds=null_descriptors();
my $from_sync=LeanBridge::Counter::issue(16);
is(LeanBridge::ResourcePeer::label($from_sync),'counter','ordinary Perl export accepts synchronous IO owner');
my $from_task_pkg=LeanBridge::Depot::alias($from_sync);
my $bumped=LeanBridge::Counter::bump($from_task_pkg);
ok($bumped->same_resource($from_sync),'three standalone components agree on the Lean identity');
$from_sync->close; $from_task_pkg->close;
is(LeanBridge::Depot::count($bumped),17,'closing either input left the new synchronous owner usable');
$bumped->close;
my $owner=LeanBridge::Depot::make(8,'interop');
is(LeanBridge::ResourcePeer::label($owner),'interop','ordinary standalone export borrows an effect-package owner');
my $canonical=LeanBridge::ResourcePeer::alias_ticket($owner);
is(refaddr(LeanBridge::ResourcePeer::alias_ticket($owner)),refaddr($canonical),'ordinary return still interns the canonical Perl wrapper');
SKIP: {
    skip 'unthreaded Perl',1 unless $Config{useithreads}; require threads;
    my ($a,$b)=($canonical,$canonical); weaken($_) for ($a,$b);
    my $refused=threads->create(sub { !eval { LeanBridge::Depot::count($canonical); 1 } })->join;
    ok($refused && defined($a) && defined($b),'foreign interpreter cannot borrow the ordinary canonical wrapper with multiple weak observers');
}
my $second=LeanBridge::Depot::alias($canonical);
ok($second->same_resource($owner),'both effect projections own the same Lean value');
ok($canonical->same_resource($second),'ordinary wrapper recognizes independently closeable lease');
isnt(refaddr($second),refaddr($canonical),'independent lease is a different closeable Perl object');
$second->close;
is(refaddr(LeanBridge::ResourcePeer::alias_ticket($owner)),refaddr($canonical),'closing an independent lease did not remove the canonical weak-table entry');
ok(!$canonical->closed && !$owner->closed,'neither other owner was closed');
like(error_from(sub { LeanBridge::Depot::count($second) }),qr/closed/i,'cannot borrow a closed lease');
my $badge=LeanBridge::Depot::badge(3);
is(LeanBridge::Counter::read_badge(LeanBridge::ResourcePeer::alias_badge($badge)),3,'second nominal kind interoperates across all three packages');
like(error_from(sub { LeanBridge::Depot::count($badge) }),qr/type|kind/i,'nominally wrong resource rejected before entry');
like(error_from(sub { LeanBridge::ResourcePeer::label(bless {},ref($owner)) }),qr/invalid|foreign/i,'blessing a hash cannot forge a resource');
$badge->close;
LeanBridge::Depot::add($canonical,2);
is(LeanBridge::Depot::count($owner),10,'mutations visible through ordinary and independent wrappers');
my $e=error_from(sub { LeanBridge::Depot::checked(!!1,$canonical)->get });
isa_ok($e,'LeanBridge::Depot::Error::checked');
my $error_owner=$e->payload;
ok($error_owner->same_resource($owner),'typed factory failure owns its resource independently');
my $cursor=LeanBridge::Depot::tickets($owner,!!1);
my $first=$cursor->next->get;
ok($first->same_resource($error_owner),'first native stream item owns the same value');
my $step=error_from(sub { $cursor->next->get });
isa_ok($step,'LeanBridge::Depot::StepError::tickets');
ok($step->payload->same_resource($owner),'typed step failure owns the value');
$first->close; $step->payload->close; $cursor->close;
my $before=LeanBridge::Depot::closes();
my $early=LeanBridge::Depot::tickets($canonical,!!0);
my $last=$early->next->get; $early->close; $early->close;
is(LeanBridge::Depot::closes(),$before+1,'closing an active stream twice enters Lean close once');
ok($last->same_resource($canonical),'a published item remains usable after the cursor is closed'); $last->close;
my $empty=LeanBridge::Depot::tickets($canonical,!!0);
$empty->next->get->close;
is_deeply([$empty->next->get],[],'natural exhaustion returns no value rather than a null resource');
is(LeanBridge::Depot::closes(),$before+2,'natural exhaustion closed the cursor once');
my $temporary=LeanBridge::Depot::alias($owner);
my $cold=LeanBridge::Depot::tickets($temporary,!!0);
$temporary->close;
like(error_from(sub { $cold->next->get }),qr/closed/i,'a cold cursor checks that its input is still live at first demand');
$cold->close;
like(error_from(sub { LeanBridge::Depot::add($canonical,[]) }),qr/scalar|integer/i,'late invalid argument rolls back an earlier resource borrow');
is(LeanBridge::Depot::count($canonical),10,'failed conversion did not enter Lean or consume the input');
LeanBridge::Depot::reset();
my $pending=LeanBridge::Depot::pending($canonical,!!0);
wait_until(sub { LeanBridge::Depot::state()==1 });
$canonical->close; $error_owner->close; $owner->close;
LeanBridge::Depot::release();
my $survivor=$pending->get;
is(LeanBridge::Depot::count($survivor),11,'worker retained the Lean value after all caller leases closed');
my ($w1,$w2)=($survivor,$survivor); weaken($_) for ($w1,$w2);
SKIP: {
    skip 'unthreaded Perl',1 unless $Config{useithreads}; require threads;
    my $refused=threads->create(sub { !eval { $survivor->close; 1 } })->join;
    ok($refused,'foreign interpreter cannot dispose the active owner');
}
my $pid=fork(); die $! unless defined $pid;
if (!$pid) { my $ok=eval { LeanBridge::Depot::count($survivor); 1 }; POSIX::_exit($ok?1:0) }
waitpid($pid,0); is($?,0,'foreign process cannot borrow the active owner');
is(LeanBridge::ResourcePeer::label($survivor),'interop','parent can still use the survivor');
$survivor->close; undef $survivor;
wait_until(sub { LeanBridge::Runtime::_snapshot()->{live_identities}==0 && null_descriptors()==$fds });
is(null_descriptors(),$fds,'underlying file was closed exactly once after final owner released it');
my $snap=LeanBridge::Runtime::_snapshot();
is_deeply([@{$snap}{qw(live_wrappers live_identities live_callbacks live_scopes)}],[0,0,0,0],'broker and Perl ownership counters returned to baseline');
for my $cooperate (!!0,!!1) {
    LeanBridge::Depot::reset();
    my $ticket=LeanBridge::Depot::make(3,'cancel');
    my $task=LeanBridge::Depot::pending($ticket,$cooperate); my $ready=0;
    $task->on_ready(sub { ++$ready });
    wait_until(sub { LeanBridge::Depot::state()==1 });
    $ticket->close; $task->cancel;
    LeanBridge::Depot::release() unless $cooperate;
    wait_until(sub { LeanBridge::Depot::state()==($cooperate?2:3) });
    ok($task->is_cancelled && $ready==1,'no cancelled lease was published or settled twice');
    wait_until(sub { null_descriptors()==$fds });
    is(LeanBridge::Runtime::_snapshot()->{live_identities},0,'cancelled resource worker released every native owner');
}
my $callback_owner=LeanBridge::Depot::make(4,'callback');
my $original=bless {},'Local::ResourceTaskFault';
my $seen=error_from(sub { LeanBridge::Depot::revisit($callback_owner,sub { die $original })->get });
is(refaddr($seen),refaddr($original),'callback exception keeps its original Perl identity across the resource worker');
my $bad=error_from(sub { LeanBridge::Depot::revisit($callback_owner,sub { [] })->get });
ok(!ref($bad),'invalid callback reply remains a boundary failure in a resource-valued task');
is(LeanBridge::Depot::count($callback_owner),4,'invalid callback reply did not transfer or mutate the caller lease');
my $result=LeanBridge::Depot::revisit($callback_owner,sub ($n) { $callback_owner->close; $n+6 })->get;
is(LeanBridge::ResourcePeer::label($result),'callback','ordinary package accepts a result retained through callback self-disposal');
is(LeanBridge::Depot::count($result),10,'worker used its own Lean reference after the callback closed the input');
$result->close;
wait_until(sub { null_descriptors()==$fds && LeanBridge::Runtime::_snapshot()->{live_identities}==0 });
is(null_descriptors(),$fds,'retained workers and failed reply released the descriptor');
done_testing;
