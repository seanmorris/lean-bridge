use v5.36;
use Scalar::Util qw(weaken);
use LeanBridge::Workshop ();
use XSLoader ();
XSLoader::load('TestObserver');

{ package App::Meter;
  sub new ($class,$n) {bless {n=>$n},$class}
  sub read ($self) {$self->{on}->() if $self->{on};$self->{n}}
  sub level ($self,@n) {$self->{n}=$n[0] if @n;$self->{n}}
  sub identity ($self) {$self}
}
my $host={Box=>'App::Meter'};my ($left,$right,$sibling);
LeanBridge::Workshop::with_hosts($host,sub {
    my $x=LeanBridge::Workshop::make(24);$left=$x;weaken($left);
    my $y=LeanBridge::Workshop::make(12);$right=$y;weaken($right);
    my $first=LeanBridge::Workshop::remember($x);$sibling=LeanBridge::Workshop::reader($y);
    my $called=0;$x->{on}=sub {++$called};undef $x;undef $y;
    my $supplied=App::Meter->new(3);$supplied->{on}=sub {TestObserver::retire()};
    my $ok=eval {$first->($supplied);1};
    die 'retirement delivered a value or a declared error' if $ok || ref($@) || $@!~/unavailable/;
    die 'dispatched another member after retirement' if $called;
    die 'retired sibling returned a value' if eval {$sibling->(3);1};
    $first->close;$first->close;
    die 'wrong retired capture released' if defined($left) || !defined($right);
});
die 'scope kept retired sibling capture' if defined $right;
$sibling->close;
say 'Retired Perl captures released independently without further member dispatch';
