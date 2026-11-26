use strict;
use warnings FATAL => 'all';
use Scalar::Util qw(refaddr weaken);
use JSON::PP ();
{
    package Meter;
    our $drops = 0;
    sub new { bless { n => $_[1] }, $_[0] }
    sub level { $_[0]->{n} = $_[1] if @_ == 2; $_[0]->{n} }
    sub read { $_[0]->{n} }
    sub identity { $_[0] }
    sub DESTROY { ++$drops }
}
{ package Key; sub identity { $_[0] } }
die "expected both components" unless @ARGV == 2 && $ARGV[0] ne $ARGV[1];
for (@ARGV) {
    die "bad package name" unless /\A(?:Peer|Workshop)\z/;
    require "LeanBridge/$_.pm";
}
for my $module (qw(Runtime Runtime/Platform Workshop Peer)) {
    die "module outside relocated prefix" unless
        index($INC{"LeanBridge/$module.pm"}, "$ENV{EXPECT_PERL_LIB}/") == 0;
}
my ($peer,$thrower) = map { "LeanBridge::$_" } @ARGV;
my ($error,$weak,$address,$before,$after);
$peer->can('with_hosts')->({ Box=>'Meter', Token=>'Key' }, sub {
    $thrower->can('with_hosts')->({ Box=>'Meter', Token=>'Key' }, sub {
        my $input = $thrower->can('make')->(23);
        $address = refaddr($input); $weak = $input; weaken($weak);
        my $data = $thrower->can('choose_object')->($input,!!0);
        die "expected a returned Err" unless ref($data) eq $thrower.'::Err' && refaddr($data->value) == $address;
        local $@;
        eval { $thrower->can('reject_object')->($input); 1 } and die "expected a declared failure";
        $error = $@;
        die "wrong declared failure" unless ref($error) eq $thrower.'::Error::reject_object';
        die "wrong EIO nesting" unless ref($error->payload) eq $thrower.'::Ok' &&
            ref($error->payload->value) eq $thrower.'::Err' &&
            refaddr($error->payload->value->value) == $address;
    });
    die "lost payload when throwing binding closed" unless defined($weak) && $Meter::drops == 0;
    {
        my $only = $error->payload->value->value;
        die "lost object identity" unless refaddr($only) == $address;
        $before = $peer->can('read')->($only);
        $after = $peer->can('update')->($only,42);
        die "peer did not mutate the original payload" unless $before == 23 && $after == 42 && $weak->read == 42;
    }
    undef $error;
    die "dropping exception did not release the last owner" if defined($weak) || $Meter::drops != 1;
    die "peer unusable after releasing payload" unless $peer->can('plain')->() == 37;
});
die "unexpected destruction after peer shutdown" unless $Meter::drops == 1;
print JSON::PP->new->canonical->encode({peer=>$ARGV[0],thrower=>$ARGV[1],before=>$before,
    after=>$after,weakCleared=>1,destructions=>$Meter::drops,peerAfter=>37}), "\n";
