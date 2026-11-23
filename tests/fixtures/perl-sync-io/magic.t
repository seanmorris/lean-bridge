use v5.36;
use strict;
use warnings;
use Test::More;
use Math::BigInt;
use Scalar::Util qw(refaddr);
use LeanBridge::Journal;
{
    package Local::ReadOnce;
    sub TIESCALAR { bless { count=>0, value=>$_[1] }, $_[0] }
    sub FETCH { die "argument was fetched twice\n" if ++$_[0]{count} != 1; $_[0]{value} }
}
for my $case ([string=>"a\0b"],[bytes=>"\xff"],[uint32=>42],[int64=>-8],[float64=>1.25],
              [bool=>!!1],[nat=>Math::BigInt->new(42)],[unit=>undef],[char=>'x']) {
    my ($type,$expected)=@$case;
    my $t = tie my $input,'Local::ReadOnce',$expected;
    my $fn = LeanBridge::Journal->can("rt_$type");
    my $out=eval { $fn->($input) }; my $err=$@;
    is($err,'',"fetch $type before conversion");
    is($t->{count},1,"$type read once"); is($out,$expected,"actual fetched $type value");
}
{
    package Local::Deferred;
    sub TIESCALAR { bless { run=>$_[1] }, $_[0] }
    sub FETCH { $_[0]{run}->() }
}
my $path='original-path';
my $nested;
tie my $value,'Local::Deferred',sub {
    $path='changed-by-later-argument';
    $nested=LeanBridge::Journal::bump(1);
    return 'stored';
};
LeanBridge::Journal::store($path,$value);
is($nested,1,'later argument reenters the same installed component');
is(LeanBridge::Journal::read('original-path'),'stored','earlier path survived argument mutation');
ok(!-e $path,'outer IO used the already converted argument');
my $offered=bless {},'Local::ConversionFailure';
tie my $bad,'Local::Deferred',sub { die $offered };
my $ok=eval { LeanBridge::Journal::store('original-path',$bad); 1 };
my $caught=$@;
ok(!$ok,'exception during argument fetch interrupts the outer call');
is(refaddr($caught),refaddr($offered),'host exception preserves its original object');
is(LeanBridge::Journal::read('original-path'),'stored','failed conversion never performed the IO');
is(LeanBridge::Journal::count(),1,'successful reentry and failed conversion leave the runtime usable');
done_testing;
