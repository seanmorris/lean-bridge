use strict;
use warnings FATAL => 'all';
use DynaLoader;
use Scalar::Util qw(refaddr weaken);
use Config;
use WireMethods;
my $rt=DynaLoader::dl_load_file('./Runtime.so',1) or die DynaLoader::dl_error();
my $boot=DynaLoader::dl_find_symbol($rt,'boot_LeanBridge__Runtime') or die DynaLoader::dl_error();
DynaLoader::dl_install_xsub('LeanBridge::Runtime::bootstrap',$boot)->('LeanBridge::Runtime');
sub load_component {
  my ($name)=@_;
  my $dll=DynaLoader::dl_load_file("./$name.so",0) or die DynaLoader::dl_error();
  my $entry=DynaLoader::dl_find_symbol($dll,'domain_probe') or die DynaLoader::dl_error();
  my $go=DynaLoader::dl_install_xsub("Probe::${name}::run",$entry);
  require "LeanBridge/$name/_HostMembers.pm";
  my $bind="LeanBridge::${name}::_HostMembers"->can('_bind') or die "member table missing";
  return sub {
    return $go->(@_,$bind->({Box=>$_[1],Token=>$_[2]})) if $_[0] eq 'bind';
    return $go->(@_);
  };
}
{ package Box; use overload '==' => sub {1}, 'bool'=>sub {0}, '""'=>sub {die 'stringified'}, fallback=>1; }
{ package Child; our @ISA=('Box'); }
{ package Token; our @ISA=('Box'); }
{ package Stranger; sub isa {1} }
{ package Destruct; our @ISA=('Box'); our ($after,$error);
  sub DESTROY { if ($after) { my $f=$after; $after=undef; eval { $f->() }; $error=$@ } }
}
sub fault (&) { my ($f)=@_; local $@; return $@ unless eval { $f->(); 1 }; die "expected failure"; }
my ($a,$b)=map {load_component($_)} @ARGV;
die unless $a->('component') eq $ARGV[0] && $b->('component') eq $ARGV[1];
$a->('bind','Box','Token');
die unless fault { $b->('bind','Box','Child') } =~ /incompatible/;
$b->('bind','Box','Token');
my ($one,$two)=map {bless {},'Child'} 1..2;
for my $api ($a,$b) {
  %Box::seen=();
  die unless refaddr($api->('wire',0,$one))==refaddr($one);
  die unless keys(%Box::seen)==19 && !grep { $_!=1 } values %Box::seen;
  local $Box::bad=2;
  die unless fault { $api->('wire',0,$one) } =~ /native boolean/;
}
print "19 generated scalar members, constructor, mutable property and nominal return\n";
for my $op ('child','child_of') {
  my ($owner_mark,$child_mark,$actor_mark);
  {
    my $child=bless {},'Box'; my $owner=bless {child=>$child},'Child'; my $actor=bless {},'Box';
    $owner_mark=$owner; $child_mark=$child; $actor_mark=$actor;
    weaken($owner_mark); weaken($child_mark); weaken($actor_mark);
    my $got=$op eq 'child' ? $a->($op,0,$owner) : $a->($op,0,$actor,$owner);
    die unless refaddr($got)==refaddr($child);
  }
  die unless defined($owner_mark) && defined($child_mark) && !defined($actor_mark);
  die unless refaddr($b->('get',0))==refaddr($child_mark);
  $b->('clear',0);
  die if defined($owner_mark) || defined($child_mark);
}
die unless $one==$two && refaddr($one)!=refaddr($two);
$a->('save',0,$one);
die unless $b->('same',0,$one) && !$b->('same',0,$two);
die unless refaddr($b->('get',0))==refaddr($one) && refaddr($a->('echo',0,$one))==refaddr($one);
die unless fault { $b->('get',1) } =~ /wrong-kind/;
die unless fault { $b->('foreign',0) } =~ /foreign/;
die unless fault { $b->('echo',0,bless {},'Stranger') } =~ /wrong nominal/;
die unless fault { $a->('close_active',0) } =~ /active/;
bless $one,'Stranger';
die unless fault { $b->('get',0) } =~ /bound class/;
bless $one,'Child';
$b->('clear',0);
die unless $a->('live')==0;
my $observed;
{
  my $provisional=bless {},'Token'; $observed=$provisional; weaken($observed);
  die unless fault { $b->('fail',1,$provisional) } =~ /later input rejected/;
}
die if defined $observed;
my ($anchor_ref,$child_ref);
{
  my $child=bless {},'Box'; my $anchor=bless {},'Box';
  $child_ref=$child; $anchor_ref=$anchor; weaken($child_ref); weaken($anchor_ref);
  $a->('save',0,$child,$anchor); $b->('save',0,$child,$anchor);
}
die unless defined $anchor_ref && defined $child_ref;
$b->('clear',0);
die if defined $anchor_ref || defined $child_ref;
{
  my $destruct=bless {},'Destruct'; $a->('save',0,$destruct);
  $Destruct::after=sub { $b->('get',0) };
}
$b->('clear',0);
die unless $Destruct::error =~ /cleanup in progress/ && $a->('live')==0;
my $token=bless {},'Token'; $observed=$token; weaken($observed);
$a->('save',1,$token);
die unless $b->('same',1,$token) && !$b->('same',0,$token);
undef $token;
$a->('close');
die unless defined $observed && refaddr($b->('get',1))==refaddr($observed);
$b->('close');
die if defined $observed;
die unless $a->('live')==0;
$b->('bind','Child','Token'); # failed partial bind left no hidden user of Box's old class
die unless fault { $b->('get',1) } =~ /stale/;
$b->('clear',1); $b->('close');
die unless $b->('live')==0;
my $profile=$Config{useithreads}?'threaded':'unthreaded';
print "Perl $] ($profile), @ARGV: shared Lean identity, distinct referents and kinds, anchors, rollback, last close and stale rejection\n";
