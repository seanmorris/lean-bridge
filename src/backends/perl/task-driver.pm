package __LBNS__::_Async;
use v5.36;
use Scalar::Util ();
sub loop () {
    LeanBridge::Runtime::_check_context();
    require IO::Async::Loop;
    return IO::Async::Loop->new;
}
sub future ($loop) {
    require IO::Async::Future;
    return __LBNS__::Future->new($loop);
}
sub fail_with ($f,$error) {
    # Future requires a truthy failure. Never stringify or discard an original
    # false-valued Perl exception; the delivery Future restores it for consumers.
    if (ref $error && !eval { !!$error }) { $error=bless [$error],'__LBNS__::_Cause' }
    return $f->fail($error);
}
sub unwatch ($s) {
    if (my $fh=delete $s->{watch}) {
        $s->{loop}->unwatch_io(handle=>$fh,on_read_ready=>1);
        CORE::close $fh;
    }
}
sub release ($s,$reason) {
    return if $$!=$s->{pid};
    LeanBridge::Runtime::_check_context();
    $s->{reason}//=$reason;
    unwatch($s);
    return if $s->{busy};
    if (my $release=delete $s->{release}) {
        delete @{$s}{qw(poll take)};
        $release->($s->{reason});
    }
}
sub pump ($s) {
    my $f=$s->{future} or return;
    return if $s->{reason} || $s->{busy};
    $s->{busy}=1;
    my (@result,$fd);
    my $ok=eval {
        $fd=$s->{poll}->();
        if (defined $fd) {
            unless ($s->{watch}) {
                open(my $fh,'<&',$fd) or die "Cannot watch Lean task: $!";
                $s->{watch}=$fh;
                my $weak=$s; Scalar::Util::weaken($weak);
                $s->{loop}->watch_io(handle=>$fh,on_read_ready=>sub { pump($weak) if $weak });
            }
        } else {
            unwatch($s);
            @result=$s->{take}->();
        }
        1;
    };
    my $error=$@; $s->{busy}=0;
    # A nested host conversion may settle/cancel the Future. It owns no late result.
    if ($s->{reason} || $f->is_ready) { release($s,'discard'); return }
    return if $ok && defined $fd;
    release($s, $ok ? (@result ? 'value' : 'end') : 'failure');
    if ($ok) { $f->done(@result) }
    else { fail_with($f,$error) }
}
sub drive ($loop,$poll,$take,$release) {
    my $f=future($loop);
    my $s=bless {loop=>$loop,pid=>$$,poll=>$poll,take=>$take,release=>$release,future=>$f},'__LBNS__::_Watch';
    Scalar::Util::weaken($s->{future});
    $f->on_ready(sub { release($s,'discard') });
    pump($s);
    return $f;
}
sub task ($start,$poll,$take,$close,$args) {
    my $loop=loop(); my $owner;
    my $ok=eval { $owner=$start->(@$args); 1 }; my $error=$@;
    unless ($ok) {
        die $error unless Scalar::Util::blessed($error) && $error->isa('__LBNS__::Failure');
        return fail_with(future($loop),$error);
    }
    return drive($loop,sub { $poll->($owner) },sub { $take->($owner) },sub { $close->($owner) });
}
sub cursor ($start,$pull,$poll,$take,$close,$args) {
    my $loop=loop(); my @inputs=@$args;
    my $s={loop=>$loop,pid=>$$,start=>sub { $start->(@inputs) }};
    my $stop=sub {
        return if $s->{closed}++;
        delete $s->{start};
        if (my $f=$s->{pending}) { $f->cancel unless $f->is_ready }
        if (my $h=delete $s->{owner}) { $close->($h) unless $s->{busy} }
    };
    my $operate=sub ($action) {
        LeanBridge::Runtime::_check_context();
        if ($action eq 'close') { $stop->(); return }
        die "Unknown cursor operation" unless $action eq 'next';
        return future($loop)->done if $s->{closed};
        return future($loop)->fail("A Lean stream pull is already pending\n") if $s->{busy};
        $s->{busy}=1; my $h;
        my $ok=eval {
            if (my $open=delete $s->{start}) { $s->{owner}=$open->() }
            $h=$s->{owner}; $pull->($h); 1;
        };
        my $error=$@;
        unless ($ok) { $s->{busy}=0; $stop->(); return fail_with(future($loop),$error) }
        my $f=drive($loop,sub { $poll->($h) },sub { $take->($h) },sub ($why) {
            $s->{busy}=0; delete $s->{pending};
            if ($why ne 'value' || $s->{closed}) {
                $s->{closed}=1; delete $s->{owner}; $close->($h);
            }
        });
        if (!$f->is_ready) { $s->{pending}=$f; Scalar::Util::weaken($s->{pending}); $f->cancel if $s->{closed} }
        return $f;
    };
    # Keep native state inside the closure. Public Perl wrappers may have
    # multiple weak observers; skipping their clone corrupts weak backrefs.
    # Only the private native owner and watch are skipped.
    return bless [$operate],'__LBNS__::Cursor';
}
package __LBNS__::Cursor;
sub next ($self) { $self->[0]->('next') }
sub close ($self) { $self->[0]->('close') }
sub CLONE_SKIP { 0 }
sub DESTROY ($self) { local $@; eval { $self->[0]->('close') } }
package __LBNS__::_Watch;
sub DESTROY ($self) { local $@; eval { __LBNS__::_Async::release($self,'discard') } }
sub CLONE_SKIP { 1 }
package __LBNS__::_Owner;
sub CLONE_SKIP { 1 }
package __LBNS__::Future;
our @ISA=('IO::Async::Future');
sub CLONE_SKIP { 0 }
sub loop ($self) { LeanBridge::Runtime::_check_context(); return $self->SUPER::loop }
sub done ($self,@args) { LeanBridge::Runtime::_check_context(); return $self->SUPER::done(@args) }
sub fail ($self,@args) { LeanBridge::Runtime::_check_context(); return $self->SUPER::fail(@args) }
sub on_ready ($self,@args) { LeanBridge::Runtime::_check_context(); return $self->SUPER::on_ready(@args) }
sub on_done ($self,@args) { LeanBridge::Runtime::_check_context(); return $self->SUPER::on_done(@args) }
sub on_cancel ($self,@args) { LeanBridge::Runtime::_check_context(); return $self->SUPER::on_cancel(@args) }
sub await ($self) { LeanBridge::Runtime::_check_context(); return $self->SUPER::await }
sub cancel ($self) { LeanBridge::Runtime::_check_context(); return $self->SUPER::cancel }
sub result ($self) {
    LeanBridge::Runtime::_check_context();
    if ($self->is_failed) {
        my $e=$self->SUPER::failure;
        die $e->[0] if ref($e) eq '__LBNS__::_Cause';
    }
    return $self->SUPER::result;
}
sub failure ($self) {
    LeanBridge::Runtime::_check_context();
    my @f=$self->SUPER::failure; return unless @f;
    $f[0]=$f[0]->[0] if ref($f[0]) eq '__LBNS__::_Cause';
    return wantarray ? @f : $f[0];
}
sub on_fail ($self,$cb) {
    LeanBridge::Runtime::_check_context();
    return $self->SUPER::on_fail($cb) unless ref($cb) eq 'CODE';
    return $self->SUPER::on_fail(sub ($e,@details) { $cb->(ref($e) eq '__LBNS__::_Cause' ? $e->[0] : $e,@details) });
}
