use v5.36;
use Config;
use Math::BigInt ();
use POSIX ();
use Scalar::Util qw(refaddr weaken);
use LeanBridge::Gauge ();

{ package App::Meter;
  sub new ($class,$n) { bless {level=>$n,reads=>0},$class }
  sub read ($m) { ++$m->{reads}; $m->{level} }
  sub level ($m,@set) { $m->{level}=$set[0] if @set; $m->{level} }
  sub identity ($m) { $m }
}
sub failure :prototype(&) ($fn) { local $@; return $@ unless eval {$fn->();1}; die "expected failure"; }
sub check ($ok,$why) { die "$why\n" unless $ok }
my $mb=1024*1024;
my $bind={Box=>'App::Meter'};
LeanBridge::Gauge::with_hosts($bind,sub {
    my $a=App::Meter->new(11); my $n=Math::BigInt->bzero;
    my $wide=LeanBridge::Gauge::Pair->new($a,'x' x (8*$mb),$n,$a);
    check(failure {LeanBridge::Gauge::sum_read($wide,$wide)} =~ /copy budget/,'second argument did not exhaust shared input budget');
    check(!$a->{reads},'invalid second argument invoked the first meter');
    $wide->close;
    my $pair=LeanBridge::Gauge::Pair->new($a,'',$n,$a);
    my $choose=LeanBridge::Gauge::choose($pair);
    my $other=LeanBridge::Gauge::Pair->new($a,'',$n,$a); bless $other,'App::Wrong';
    check(failure {LeanBridge::Gauge::sum_read($pair,$other)} =~ /record/i,'reblessing did not invalidate the input');
    check(!$a->{reads},'invalid class reached the application');
    my $weak;
    {
        my $temp=App::Meter->new(3); $weak=$temp; weaken($weak);
        # 6 MiB argument + first 6 MiB output + meter fit, the final 6 MiB does not.
        check(failure {LeanBridge::Gauge::duplicate_sample($temp,'b' x (6*$mb))} =~ /copy budget/,'partial output was accepted');
    }
    check(!defined($weak),'failed result retained the intermediate meter');
    check(refaddr($choose->(!!1))==refaddr($a),'recoverable failure retired the binding');
    my $pid=fork(); die "fork: $!" unless defined $pid;
    if (!$pid) { my $ok=eval { $pair->lead; 1 }; POSIX::_exit($ok?1:0); }
    waitpid($pid,0); check($?==0,'fork used the parent record');
    if ($Config{useithreads}) {
        require threads;
        my $thread=threads->create(sub { my $ok=eval { $pair->close; 1 }; return !$ok; });
        check($thread->join,'cloned interpreter disposed the parent record');
    }
    check(refaddr($pair->lead)==refaddr($a),'foreign disposal invalidated the original record');
    $pair->close; $choose->close;
});
print "partial result released the meter, invalid input made no call, foreign owner refused and binding remained usable\n";
