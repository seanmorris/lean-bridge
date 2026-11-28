package __LBNS__::_HostWorkers;
use v5.36;
use Hash::Util::FieldHash qw(fieldhash);
use Scalar::Util ();

# One lexical binding per compiled component and interpreter. The XS owns
# the native scope. Weak registrations do not prolong abandoned operations.
my $current;
sub managed ($kind,$make) {
    LeanBridge::Runtime::_check_context();
    my $scope=$current // die "No active Perl worker binding\n";
    my $work=$make->();
    return $work if !$kind && $work->is_ready;
    $scope->{$work}=[$kind,$work]; Scalar::Util::weaken($scope->{$work}[1]);
    unless ($kind) {
        my $weak=$scope; Scalar::Util::weaken($weak);
        $work->on_ready(sub ($future) { delete $weak->{$future} if defined $weak });
    }
    return $work;
}
sub run ($body) {
    my $context=wantarray;
    fieldhash my %children;
    die "Already bound Perl worker scope\n" if defined $current;
    $current=\%children;
    my (@list,$one);
    my $ok=eval {
        if (!defined $context) { $body->() }
        elsif ($context) { @list=$body->() }
        else { $one=$body->() }
        1;
    };
    my $original=$@;
    undef $current;
    # Stop every native producer before calling any application observer.
    # The XS save-stack destructor also performs this step on an unwind.
    __LBNS__::_retire_scoped_workers();
    my @pending=values %children; %children=();
    my ($failed,$first);
    for my $row (@pending) {
        my ($kind,$item)=@$row; next unless defined $item;
        my $done=eval {
            if ($kind) { $item->close }
            elsif (!$item->is_ready) { $item->cancel }
            1;
        };
        if (!$done && !$failed) { $failed=1; $first=$@ }
    }
    die $original unless $ok;
    die $first if $failed;
    return $context ? @list : $one;
}
package __LBNS__;
sub with_hosts ($classes,$body) {
    die "with_hosts requires a code reference\n" unless (Scalar::Util::reftype($body)//'') eq 'CODE';
    return _with_hosts($classes,sub { __LBNS__::_HostWorkers::run($body) });
}
