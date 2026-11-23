package __LBNS__::_Retained;
use v5.36;
use Scalar::Util ();
our %dispatching;

sub poll ($s) {
    # A nested wait must not keep selecting this owner's readable request fd.
    # The shared pump rearms it after the bounded dispatch below.
    __LBNS__::_Async::unwatch($s);
    my $ops=$s->{ops}; my $owner=$s->{owner};
    my $f=$s->{future} or die "Abandoned Perl callback owner\n";
    local $dispatching{Scalar::Util::refaddr($f)}=1;
    for (1..16) {
        last if defined $s->{reason};
        my $slot=$ops->{next}->($owner); last unless defined $slot;
        my $code=$s->{callbacks}{$slot} // die "Unknown Lean callback slot\n";
        my $value=$ops->{arg}->($owner,$slot);
        last if defined $s->{reason};
        my $answer; my $ok=eval { $answer=$code->($value); 1 }; my $e=$@;
        last if defined $s->{reason};
        if (!$ok) {
            # Do not invoke a host object's diagnostic/string overload. Lean
            # gets a message; only its original IO.Error can select this SV.
            my $text=!ref($e) && length($e)<262144 ? $e : 'Perl callback failed';
            my $id=$ops->{fail}->($owner,$text);
            push @{$s->{faults}},$e;
            unless ($id==@{$s->{faults}}) {
                $ops->{trap}->($owner);
                die "Invalid retained Perl callback failure identity\n";
            }
        } else {
            # A BigInt conversion can reenter Perl and cancel this Future.
            # XS rechecks this private stop flag immediately before replying.
            $ops->{reply}->($owner,$slot,$answer,\$s->{reason});
        }
    }
    return undef if defined $s->{reason};
    return $ops->{ready}->($owner);
}

sub start ($ops,$indices,$args) {
    my $loop=__LBNS__::_Async::loop();
    require IO::Async::Future;
    my %callbacks;
    for my $j (@$indices) {
        my $code=$args->[$j];
        die "Expected a Perl CODE reference for a retained callback\n"
            unless (Scalar::Util::reftype($code) // '') eq 'CODE';
        $callbacks{$j}=$code;
    }
    my $owner=$ops->{start}->(@$args);
    my $f=__LBNS__::RetainedFuture->new($loop);
    my $s=bless {pid=>$$,loop=>$loop,ops=>$ops,owner=>$owner,callbacks=>\%callbacks,
                 faults=>[],future=>$f},'__LBNS__::_Watch';
    Scalar::Util::weaken($s->{future});
    my $weak=$s; Scalar::Util::weaken($weak);
    $s->{poll}=sub { poll($weak) };
    $s->{take}=sub {
        # poll() can run application code which cancels or settles its own
        # Future. It cannot consume a native result on behalf of that owner.
        return if defined $weak->{reason};
        $ops->{take}->($owner,$weak->{faults});
    };
    $s->{release}=sub {
        delete @{$weak}{qw(owner callbacks faults ops)} if $weak;
        $ops->{close}->($owner);
    };
    $f->on_ready(sub { __LBNS__::_Async::release($s,'discard') });
    # Even a ready factory callback must not run before we return its Future.
    $loop->later(sub { __LBNS__::_Async::pump($weak) if $weak });
    return $f;
}
package __LBNS__::RetainedFuture;
our @ISA=('__LBNS__::Future');
sub await ($self) {
    die "A retained callback cannot wait for its own pending task\n"
        if !$self->is_ready && $__LBNS__::_Retained::dispatching{Scalar::Util::refaddr($self)};
    return $self->SUPER::await;
}
1;
