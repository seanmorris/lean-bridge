use v5.36;
use strict;
use warnings;
use Test::More;
use LeanBridge::Journal;
use LeanBridge::Companion;
use XSLoader ();
XSLoader::load('TestObserver');
is(LeanBridge::Journal::bump(2),2,'primary entered');
is(LeanBridge::Companion::bump(3),3,'peer entered');
is_deeply([TestObserver::snapshot()],[2,1,2,2,0],'one ready runtime and two separately initialized components');
TestObserver::retire();
for my $f (\&LeanBridge::Journal::count,\&LeanBridge::Companion::count) {
    my $ok=eval { $f->(); 1 }; my $err=$@;
    ok(!$ok && !ref($err) && $err =~ /Lean bridge failure .*status 10/, 'retired runtime refuses a call; not a declared EIO/IO exception');
}
my @final=TestObserver::snapshot();
is_deeply([@final[0,1,2,4]],[3,1,2,0],'no reinitialization or leaked identities after retirement');
done_testing;
