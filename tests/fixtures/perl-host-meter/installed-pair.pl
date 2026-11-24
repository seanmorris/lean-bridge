use strict;
use warnings FATAL => 'all';
use Scalar::Util qw(refaddr weaken);
{ package Meter; our ($thrown,$reenter); sub new {bless {v=>$_[1]},$_[0]} sub identity {$_[0]}
  sub level {$_[0]->{v}=$_[1] if @_==2; $_[0]->{v}}
  sub read {die $thrown if defined $thrown; $reenter->() if $reenter; $_[0]->{v}} }
{ package Key; sub identity {$_[0]} }
{ package OtherMeter; our @ISA=('Meter') }
{ package FalseFault; use overload 'bool'=>sub {0}, '""'=>sub {die "stringified host exception"}, fallback=>1 }
sub fault (&) {my ($f)=@_; local $@; return $@ unless eval {$f->();1}; die "expected failure"}
sub bind_hosts {my ($p,$f)=@_; $p->can('with_hosts')->({Box=>'Meter',Token=>'Key'},$f)}
my @pkg;
for (@ARGV) {
  die unless /\A(?:Peer|Workshop)\z/;
  require "LeanBridge/$_.pm"; push @pkg,"LeanBridge::$_";
}
if (defined(my $lib=$ENV{EXPECT_PERL_LIB})) {
  for my $file (qw(LeanBridge/Runtime.pm LeanBridge/Runtime/Platform.pm LeanBridge/Workshop.pm LeanBridge/Peer.pm)) {
    die "Loaded $file outside the relocated consumer prefix" unless index($INC{$file}, "$lib/") == 0;
  }
}
my ($outer,$inner)=@pkg;
my $meter=LeanBridge::Workshop::with_hosts({Box=>'Meter',Token=>'Key'},sub {
  my $m=LeanBridge::Workshop::make(18);
  LeanBridge::Workshop::update($m,42);
  return LeanBridge::Workshop::identity($m);
});
die unless ref($meter) eq 'Meter' && $meter->read==42;
my ($weak,$strong,$error);
bind_hosts($outer,sub {
  bind_hosts($inner,sub {
    my $m=$outer->can('make')->(18); die unless $inner->can('update')->($m,42)==42;
    local $Meter::reenter=sub {die unless $outer->can('plain')->()==37};
    die unless $inner->can('read')->($m)==42 && refaddr($outer->can('identity')->($m))==refaddr($m);
    local $Meter::thrown=bless {},'FalseFault';
    die unless refaddr(fault {$inner->can('read')->($m)})==refaddr($Meter::thrown);
    my $mapped=fault {$inner->can('mapped')->($m)};
    die unless ref($mapped) eq $inner.'::Error::mapped' && $mapped->payload eq 'host read failed';
    my $replaced=fault {$inner->can('replaced')->($m)};
    die unless ref($replaced) eq $inner.'::IOError' && $replaced->message =~ /Perl host member failed/;
    my $result=$outer->can('choose_object')->($m,!!1);
    die unless refaddr($result->value->value)==refaddr($m);
    $weak=$m; weaken($weak);
    $error=fault {$inner->can('reject_object')->($m)};
    die unless refaddr($error->payload->value->value)==refaddr($m);
    my $bad=bless {},'Key'; my $unadmitted=$bad; weaken($unadmitted);
    die unless fault {$inner->can('check_inputs')->($bad,$m,999)} =~ /unsigned/;
    undef $bad; die if defined $unadmitted;
    my $key=bless {},'Key'; $strong=$key; weaken($strong);
    my $e=fault {$outer->can('mixed_fault')->($m,$key,!!1)};
    die unless refaddr($e->payload->value)==refaddr($key);
    $inner->can('keep_token')->($key);
  });
  die unless defined $strong && defined $weak;
  undef $error; die if defined $weak;
  die unless fault {$inner->can('with_hosts')->({Box=>'OtherMeter',Token=>'Key'},sub {die 'called'})} =~ /incompatible/;
  bind_hosts($inner,sub { die unless refaddr($inner->can('read_token')->())==refaddr($strong) });
});
die if defined $strong;
bind_hosts($inner,sub {
  die unless fault {$inner->can('read_token')->()} =~ /stale/;
  $inner->can('forget_token')->();
});
die unless fault {$inner->can('plain')->()} =~ /no active/;
print "installed CPAN host pair @ARGV: lifetime, identity, errors and reentry passed\n";
