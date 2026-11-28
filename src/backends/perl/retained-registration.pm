package __LBNS__::RetainedCallback;
use v5.36;
use Scalar::Util ();

# callback() returns a plain CODE reference usable by independently generated
# packages. No target reads another package's wrapper, native token or flags.
sub new ($class, $code) {
    LeanBridge::Runtime::_check_context();
    die "A retained callback requires a CODE reference\n"
        unless (Scalar::Util::reftype($code) // '') eq 'CODE';
    my $callback = sub ($value) {
        LeanBridge::Runtime::_check_context();
        my $active = $code // die "Retained Perl callback is closed\n";
        return $active->($value);  # A self-close cannot revoke this active call.
    };
    my $access = sub ($what) {
        LeanBridge::Runtime::_check_context();
        return $callback if $what eq 'callback';
        return !defined($code) if $what eq 'closed';
        if ($what eq 'close') { my $was_open = defined($code); undef $code; return $was_open }
        die "Unknown retained callback operation\n";
    };
    # This pure host wrapper can be cloned, but its guarded capability cannot
    # be exercised from the clone. Ordinary Perl weak refs remain valid.
    return bless [$access], $class;
}
sub callback ($self) { $self->[0]->('callback') }
sub close ($self) { $self->[0]->('close') }
sub closed ($self) { $self->[0]->('closed') }
sub CLONE_SKIP { 0 }
1;
