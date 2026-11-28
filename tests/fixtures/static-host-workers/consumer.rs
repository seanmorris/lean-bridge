// Installed consumer: only ordinary crate methods and the executor. In
// particular, no native handle, callback queue or polling fd is available.
#[allow(dead_code)]
mod client {
    include!("synchronous.rs");
    use async_io::block_on;
    use workshop::{Error,CallbackError,RetainedCallback};
    use std::{future::Future,sync::{Arc,atomic::{AtomicUsize,Ordering}},task::{Context,Wake,Waker}};
    include!("effects.rs");
    struct Signal(AtomicUsize);
    impl Wake for Signal {fn wake(self:Arc<Self>){self.0.fetch_add(1,Ordering::Relaxed);}}
    pub fn run(){
        let a=Rc::new(workshop::Binding::<A>::new().unwrap());let b=Rc::new(peer::Binding::<B>::new().unwrap());
        let x=a.make(42).unwrap();let weak=Rc::downgrade(x.as_rc());
        let owner=std::thread::current().id();
        if std::env::args().nth(1).as_deref()==Some("panic-worker"){
            retirement(&a,&b,&x);
            assert!(matches!(b.read(&x),Err(HostCallError::Boundary(Fault::Unavailable))));
            a.close().unwrap();b.close().unwrap();drop(x);assert!(weak.upgrade().is_none());
            println!("worker checks passed: panic retirement and cleanup");return;
        }
        other_effects(&a,&b,&x);
        let one=block_on(a.echo(&x).unwrap()).unwrap();assert!(x.ptr_eq(&one));
        assert!(block_on(b.echo(&one).unwrap()).unwrap().ptr_eq(&x));drop(one);
        match a.reject(&x) {Err(Error::Start(payload))=>assert!(payload.ptr_eq(&x)),_=>panic!("factory error lost")}
        assert!(block_on(b.outcome(&x).unwrap()).unwrap().unwrap_err().ptr_eq(&x));
        let mut items=a.series(&x).unwrap();
        assert!(block_on(items.next()).unwrap().unwrap().ptr_eq(&x));
        match block_on(items.next()){Some(Err(Error::Step(v)))=>assert!(v.ptr_eq(&x)),_=>panic!("lost terminal object")}
        assert!(block_on(items.next()).is_none());items.close().unwrap();drop(items);
        let mut early=b.series(&x).unwrap();assert!(block_on(early.next()).unwrap().unwrap().ptr_eq(&x));
        early.close().unwrap();early.close().unwrap();assert!(block_on(early.next()).is_none());drop(early);
        let calls=Rc::new(Cell::new(0));let n=calls.clone();let p=a.clone();let peer=b.clone();
        let t=a.relay(&x,move|arg|{
            assert_eq!(std::thread::current().id(),owner);assert_eq!(peer.read(&arg).unwrap(),42);
            assert!(matches!(p.close(),Err(Fault::Busy)));n.set(n.get()+1);Ok(arg)
        }).unwrap();
        assert!(block_on(t).unwrap().ptr_eq(&x));assert_eq!(calls.get(),1);
        let failure=CallbackError::new(std::io::Error::other("owner callback failed"));
        let saved=failure.clone();
        let t=b.relay(&x,move|_|->Result<Rc<Meter>,_>{Err(saved.clone())}).unwrap();
        match block_on(t){Err(Error::Callback{declaration:"Jobs.relay",error})=>assert!(error.same_error(&failure)),_=>panic!("lost callback error identity")}
        let holder=Rc::new(RefCell::new(None::<RetainedCallback<workshop::HostRef<Meter>,Rc<Meter>>>));
        let handle=holder.clone();let cb=RetainedCallback::new(move|v:workshop::HostRef<Meter>|{
            handle.borrow_mut().take().unwrap().close();Ok(v.as_rc().clone())
        });holder.replace(Some(cb.clone()));
        assert!(block_on(a.relay(&x,cb.function()).unwrap()).unwrap().ptr_eq(&x));
        assert!(matches!(block_on(a.relay(&x,cb.function()).unwrap()),Err(Error::Callback{..})));
        let mut cancelled=b.echo(&x).unwrap();cancelled.cancel().unwrap();cancelled.cancel().unwrap();
        assert!(matches!(block_on(cancelled),Err(Error::Boundary(Fault::Cancelled))));
        let held=Rc::new(());let wh=Rc::downgrade(&held);
        let abandoned=a.relay(&x,move|v|{let _=&held;Ok(v)}).unwrap();
        let mut pending=Box::pin(a.dormant().unwrap());
        let mut never=a.series(&x).unwrap();
        let wake=Arc::new(Signal(AtomicUsize::new(0)));let waker=Waker::from(wake.clone());
        assert!(pending.as_mut().poll(&mut Context::from_waker(&waker)).is_pending());
        a.close().unwrap();assert!(wake.0.load(Ordering::Relaxed)>0 && wh.upgrade().is_none());
        assert!(matches!(block_on(pending),Err(Error::Boundary(Fault::Closed))));
        assert!(matches!(block_on(abandoned),Err(Error::Boundary(Fault::Closed))));
        assert!(matches!(block_on(never.next()),Some(Err(Error::Boundary(Fault::Closed)))));
        assert!(block_on(never.next()).is_none());a.close().unwrap();
        assert_eq!(b.read(&x).unwrap(),42);
        let orphan=b.echo(&x).unwrap();drop(b);
        assert!(matches!(block_on(orphan),Err(Error::Boundary(Fault::Closed))));
        drop(x);assert!(weak.upgrade().is_none());
        println!("worker checks passed: exact identity, errors, reentry, cancellation, wake and cleanup");
    }
}
fn main(){client::run()}
