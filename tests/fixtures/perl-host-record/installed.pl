use v5.36;
use Math::BigInt ();
use Scalar::Util qw(refaddr weaken);
use LeanBridge::Gauge ();
use LeanBridge::Inspector ();

{ package App::Meter;
  sub new ($class,$level) { bless {level=>$level,reads=>0},$class }
  sub read ($self) { ++$self->{reads}; die $self->{error} if exists $self->{error}; $self->{level} }
  sub level ($self,@set) { $self->{level}=$set[0] if @set; $self->{level} }
  sub identity ($self) { $self }
}
{ package App::Fault;
  use overload 'bool'=>sub {0}, '""'=>sub {die "stringified application error"}, fallback=>1;
}
sub check ($ok,$why) { die "$why\n" unless $ok }
sub same ($a,$b) { defined $a && defined $b && refaddr($a)==refaddr($b) }
sub failure :prototype(&) ($op) { local $@; return $@ unless eval {$op->();1}; die "expected failure" }

my $bind={Box=>'App::Meter'};
my ($kept,$weak_left,$weak_right);
my $row=LeanBridge::Gauge::with_hosts($bind,sub {
    my ($x,$y)=(App::Meter->new(23), App::Meter->new(19));
    $weak_left=$x; weaken($weak_left);
    $weak_right=$y; weaken($weak_right);
    my $n=Math::BigInt->new(2)->bpow(130)->badd(5);
    my $original=$n->copy; my $bytes=pack('C*',9,8);
    my $input=LeanBridge::Gauge::Pair->new($x,$bytes,$n,$y);
    $n->binc; substr($bytes,0,1)="a";
    check($input->sequence==$original && $input->sample eq pack('C*',9,8),'constructor did not copy scalars');
    my $sequence=$input->sequence; $sequence->binc;
    check($input->sequence==$original,'mutable Math::BigInt getter aliased the stored value');
    my $generated=LeanBridge::Gauge::create_pair($x);
    check($generated->sequence->is_zero,'getter did not preserve Lean Nat.zero as Math::BigInt');
    check(same($generated->lead,$x) && LeanBridge::Gauge::sum_read($generated,$input)==42,'Lean constructed the wrong record');
    my $closed=LeanBridge::Gauge::Pair->new($x,$bytes,$n,$y); $closed->close;
    my $reads=$x->{reads};
    check(failure {LeanBridge::Gauge::sum_read($input,$closed)} =~ /record/i,'closed record reached Lean');
    my $forged=bless {},'LeanBridge::Gauge::Pair';
    check(failure {LeanBridge::Gauge::sum_read($input,$forged)} =~ /record/i,'blessing alone forged a record');
    check($x->{reads}==$reads,'invalid second argument caused a member call');
    my $fault=bless {},'App::Fault';
    { local $x->{error}=$fault; check(same(failure {LeanBridge::Gauge::flip($input)},$fault),'exception was replaced'); }
    my $result=LeanBridge::Gauge::flip($input);
    check(same($result->lead,$y) && same($result->spare,$x),'result replaced original Perl objects');
    check($result->sequence==$original->copy->binc && $result->sample eq pack('C*',9,8,23),'compiled projections or copies differ');
    my $fn=LeanBridge::Gauge::choose($input);
    $input->close; $input->close; $generated->close;
    check(same($fn->(!!1),$x) && same($fn->(!!0),$y),'coderef lost its capture when its input closed');
    $fn->close;
    return $result;
});
check(defined($weak_left) && defined($weak_right),'binding scope exit prematurely released the result');
$kept=$row->spare; $row->close; $row->close;
check(!defined($weak_right) && same($weak_left,$kept),'closing the result retained the wrong fields');
check(failure {$row->lead} =~ /closed/i,'getter succeeded after close');
LeanBridge::Inspector::with_hosts($bind,sub {
    check(same(LeanBridge::Inspector::increment($kept),$kept) && $kept->{level}==24,'independent package did not update original meter');
});
undef $kept;
check(!defined($weak_left),'object outlived its last Perl owner');
print "record identity, Math::BigInt copy, exception identity and cross-package last owner passed\n";
