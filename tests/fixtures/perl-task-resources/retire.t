use v5.36;
use Test::More;
use Time::HiRes qw(time);
use IO::Async::Loop::Poll;
use XSLoader ();
use LeanBridge::Depot;
XSLoader::load('TestObserver');
my $loop=IO::Async::Loop::Poll->new;
sub until_ready ($check) {
    my $end=time()+25;
    until ($check->()) { die 'timed out draining native resources' if time()>$end; $loop->delay_future(after=>0.01)->get }
}
sub descriptors () {
    opendir(my $d,'/proc/self/fd') or die $!;
    my $n=grep { (readlink("/proc/self/fd/$_")//'') eq '/dev/null' } readdir($d);
    closedir($d); return $n;
}
my $base=descriptors(); my $owner=LeanBridge::Depot::make(5,'retire-probe');
my $cur=LeanBridge::Depot::tickets($owner,!!0);
my $item=$cur->next->get;
ok($item->same_resource($owner),'cold stream is open and a real item has been published');
LeanBridge::Depot::reset();
my $f=LeanBridge::Depot::pending($owner,!!1);
until_ready(sub { LeanBridge::Depot::state()==1 });
$owner->close; $item->close;
is(descriptors(),$base+1,'pending native owners keep exactly the original descriptor open');
my @before=TestObserver::snapshot();
is_deeply([@before[0,1,2]],[2,1,1],'one live runtime and one initialized component');
TestObserver::retire();
until_ready(sub { $f->is_ready });
for my $fn (sub { $f->get },sub { $cur->next->get },sub { LeanBridge::Depot::make(1,'cannot-reopen') }) {
    my $ok=eval { $fn->(); 1 }; my $error=$@;
    ok(!$ok && !ref($error) && $error=~/Lean bridge failure .*status 10/,'retirement is not a declared Lean or Perl application exception');
}
$cur->close;
until_ready(sub { (TestObserver::snapshot())[4]==0 && descriptors()==$base });
is_deeply([(TestObserver::snapshot())[0,1,2,4]],[3,1,1,0],'retired runtime released all identities without reinitializing');
ok(!-e 'retired-close-ran.txt','native cleanup did not enter the user close function after retirement');
is(descriptors(),$base,'no leaked descriptor after terminal cancellation and stream disposal');
done_testing;
