// Included in the installed, owner-bound Cargo consumer.
fn other_effects(a: &Rc<workshop::Binding<A>>, b: &Rc<peer::Binding<B>>, x: &workshop::HostRef<Meter>) {
    assert_eq!(block_on(a.signed_echo(i16::MIN).unwrap()).unwrap(), i16::MIN);
    let wide = -(BigInt::from(1) << 385usize) + 13;
    assert_eq!(block_on(b.large_result(&wide).unwrap()).unwrap().unwrap(), wide);
    assert_eq!(block_on(a.echo_bytes(&[0,128,255]).unwrap()).unwrap(), [0,128,255]);
    let provisional=Rc::new(Dial(Cell::new(7)));let weak=Rc::downgrade(&provisional);
    assert!(matches!(a.with_buffer(&provisional,&vec![0;(16<<20)+1]),Err(Error::Boundary(Fault::Limit))));
    drop(provisional);assert!(weak.upgrade().is_none(),"failed start pinned a provisional strong object");
    let object=x.clone();
    let result=block_on(a.handoff(x, move|v| {
        assert!(v.ptr_eq(&object)); Ok(v.dial.clone())
    }, |d| Ok(d.read())).unwrap()).unwrap();
    assert_eq!(result,43);
    assert!(block_on(a.later_failure(x,false).unwrap()).unwrap().ptr_eq(x));
    assert!(matches!(block_on(a.later_failure(x,true).unwrap()),Err(Error::Boundary(Fault::TaskIo{declaration:"Jobs.laterFailure",message})) if message=="late IO"));
    assert!(matches!(a.prepare_io(x,true),Err(Error::Boundary(Fault::Io{declaration:"Jobs.prepareIO",message})) if message=="factory IO"));
    assert!(block_on(a.prepare_io(x,false).unwrap()).unwrap().ptr_eq(x));
    match block_on(a.checked_relay(x,true,|_|->Result<Rc<Meter>,CallbackError>{panic!("rejected factory invoked callback")}).unwrap()) {
        Err(Error::Start(v))=>assert!(v.ptr_eq(x)),_=>panic!("wrong deferred factory error"),
    }
    assert!(block_on(a.checked_relay(x,false,Ok).unwrap()).unwrap().ptr_eq(x));
    let mut good=b.finite(x).unwrap();assert!(block_on(good.next()).unwrap().unwrap().ptr_eq(x));
    assert!(block_on(good.next()).is_none());assert!(block_on(good.next()).is_none());
    let mut bad=a.broken(x).unwrap();
    assert!(matches!(block_on(bad.next()),Some(Err(Error::Boundary(Fault::TaskIo{declaration:"Jobs.nextBroken",message}))) if message=="pull IO"));
    assert!(block_on(bad.next()).is_none());
    // Drop (unlike explicit close) cannot return Busy to its caller. If it
    // occurs inside a retained callback the binding must revoke its other
    // outstanding work immediately after that callback leaves.
    let temp=workshop::Binding::<A>::new().unwrap();
    let other=temp.dormant().unwrap();
    let holder=Rc::new(RefCell::new(None));let inner=holder.clone();
    let self_drop=temp.relay(x,move|v|{drop(inner.borrow_mut().take());Ok(v)}).unwrap();
    holder.replace(Some(temp));
    assert!(matches!(block_on(self_drop),Err(Error::Boundary(Fault::Closed))));
    assert!(matches!(block_on(other),Err(Error::Boundary(Fault::Closed))));
    assert!(holder.borrow().is_none());assert_eq!(a.read(x).unwrap(),42);
}

fn retirement(a:&workshop::Binding<A>,b:&peer::Binding<B>,x:&workshop::HostRef<Meter>) {
    use std::{sync::mpsc,sync::Mutex,time::{Duration,Instant},task::Poll};
    struct Notify(Mutex<mpsc::Sender<()>>);
    impl Wake for Notify{fn wake(self:Arc<Self>){let _=self.0.lock().unwrap().send(());}}
    let (send,recv)=mpsc::channel();let wake=Waker::from(Arc::new(Notify(Mutex::new(send))));
    let mut waiting=Box::pin(b.dormant().unwrap());
    assert!(waiting.as_mut().poll(&mut Context::from_waker(&wake)).is_pending());
    let t=a.relay(x,|_|->Result<Rc<Meter>,CallbackError>{panic!("worker callback")}).unwrap();
    assert!(matches!(block_on(t),Err(Error::Boundary(Fault::CallbackPanic{declaration:"Jobs.relay"}))));
    // A runtime retirement must wake the parked executor. No timer or
    // periodic re-poll drives the task; the timeout only fails the test.
    let deadline=Instant::now()+Duration::from_secs(5);
    loop{
        recv.recv_timeout(deadline.saturating_duration_since(Instant::now())).expect("missing retirement wake");
        match waiting.as_mut().poll(&mut Context::from_waker(&wake)){
            Poll::Pending=>continue,Poll::Ready(Err(Error::Boundary(Fault::Unavailable)))=>break,
            _=>panic!("pending task did not observe component retirement"),
        }
    }
}
