use strict;
use warnings FATAL => 'all';
use LeanBridge::Workshop;
use Scalar::Util qw(refaddr weaken);
{ package Fault; use overload 'bool'=>sub {0}, '""'=>sub {die "unexpected stringify"}, fallback=>1 }
{ package Meter;
  our ($failure,$inside,$calls);
  sub new { bless {level=>$_[1]},$_[0] }
  sub read { ++$calls; die $failure if defined($failure); $inside->() if $inside; $_[0]->{level} }
  sub level { $_[0]->{level}=$_[1] if @_==2; $_[0]->{level} }
  sub identity { $_[0] }
}
{ package Once;
  sub TIEHASH { bless {fetch=>0},$_[0] }
  sub SCALAR {1} sub FIRSTKEY {'Box'} sub NEXTKEY {undef} sub EXISTS {$_[1] eq 'Box'}
  sub FETCH { die 'second binding fetch' if $_[0]->{fetch}++; 'Meter' }
}
{ package OnceValue;
  sub TIESCALAR { bless [0,$_[1]],$_[0] }
  sub FETCH { die "read input twice" if $_[0][0]++; $_[0][1] }
}
sub fault (&) { my ($f)=@_; local $@; return $@ unless eval { $f->(); 1 }; die "expected an exception" }
sub scope (&) { LeanBridge::Workshop::with_hosts({Box=>'Meter'},$_[0]) }
my $original=bless {},'Fault';
die unless fault { LeanBridge::Workshop::plain() } =~ /no active/;
die unless fault { LeanBridge::Workshop::with_hosts({Box=>'NotBound'},sub {die 'called'}) } =~ /missing host method/;
my ($box,$ctx);
{ local $@=$original;
  my @got=scope {
    die unless wantarray;
    $box=LeanBridge::Workshop::make(39);
    die unless ref($box) eq 'Meter' && LeanBridge::Workshop::read($box)==39;
    die unless LeanBridge::Workshop::update($box,42)==42;
    tie my $value,'OnceValue',42;
    die unless LeanBridge::Workshop::update($box,$value)==42 && tied($value)->[0]==1;
    tie my $alias,'OnceValue',$box;
    die unless refaddr(LeanBridge::Workshop::identity($alias))==refaddr($box) && tied($alias)->[0]==1;
    die unless refaddr(LeanBridge::Workshop::identity($box))==refaddr($box);
    die unless fault { LeanBridge::Workshop::update($box,-1) } =~ /unsigned/;
    die unless fault { LeanBridge::Workshop::read(bless {},'Other') } =~ /wrong nominal/;
    die unless fault { scope {die 'nested'} } =~ /already bound/;
    local $Meter::inside=sub {die unless LeanBridge::Workshop::plain()==37};
    die unless LeanBridge::Workshop::mapped($box)==42;
    local $Meter::failure=$original;
    die unless refaddr(fault {LeanBridge::Workshop::read($box)})==refaddr($original);
    my $e=fault { LeanBridge::Workshop::mapped($box) };
    die unless ref($e) eq 'LeanBridge::Workshop::Error::mapped' && $e->declaration eq 'Workshop.mapped' && $e->payload eq 'host read failed';
    my $io=fault { LeanBridge::Workshop::replaced($box) };
    die unless ref($io) eq 'LeanBridge::Workshop::IOError' && $io->message =~ /Perl host member failed/;
    local $Meter::calls=0;
    die unless fault { LeanBridge::Workshop::exhaust($box) } =~ /host frame unavailable/ && $Meter::calls==64;
    my $val=LeanBridge::Workshop::reply(!!1);
    die unless ref($val) eq 'LeanBridge::Workshop::Ok' && ref($val->value) eq 'LeanBridge::Workshop::Err' && $val->value->value==23;
    die unless LeanBridge::Workshop::reply(!!0)->value eq 'no';
    ($box,undef,42)
  };
  die unless refaddr($@)==refaddr($original) && @got==3 && refaddr($got[0])==refaddr($box) && !defined($got[1]) && $got[2]==42;
}
scope { $ctx=defined(wantarray)?'bad':'void' }; die unless $ctx eq 'void';
die unless (scalar scope { defined(wantarray) && !wantarray ? 99 : 0 })==99;
die unless refaddr(fault {scope {die $original}})==refaddr($original);
die unless fault { LeanBridge::Workshop::read($box) } =~ /no active/;
for my $variant (0,1,2) {
  my ($held,$weak);
  scope {
    my $object=LeanBridge::Workshop::make(67);
    $weak=$object; weaken($weak);
    if ($variant==2) {
      $held=fault {LeanBridge::Workshop::reject_object($object)};
      die unless ref($held) eq 'LeanBridge::Workshop::Error::reject_object';
    } else { $held=LeanBridge::Workshop::choose_object($object,$variant ? !!1 : !!0) }
  };
  my $payload=$variant==2 ? $held->payload->value->value : $variant ? $held->value->value : $held->value;
  die unless defined($weak) && refaddr($payload)==refaddr($weak);
  undef $payload; undef $held; die if defined $weak;
}
tie my %single,'Once';
die unless LeanBridge::Workshop::with_hosts(\%single,sub {LeanBridge::Workshop::read($box)})==42 && tied(%single)->{fetch}==1;
print "public host checks passed: identity, mutation, reentry, IO/EIO/Except, unwind, tied classes and context\n";
