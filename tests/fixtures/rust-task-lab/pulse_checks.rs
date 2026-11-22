use super::lab;
use std::{future::Future, pin::Pin, sync::{Arc,atomic::{AtomicU32,Ordering}},
    task::{Context,Poll,Wake,Waker}, thread, time::{Duration,Instant}};

struct Signal { calls:AtomicU32, thread:thread::Thread }
impl Wake for Signal {
    fn wake(self:Arc<Self>){self.wake_by_ref()}
    fn wake_by_ref(self:&Arc<Self>){self.calls.fetch_add(1,Ordering::SeqCst);self.thread.unpark();}
}
fn signal()->(Arc<Signal>, Waker) {
    let s=Arc::new(Signal{calls:AtomicU32::new(0),thread:thread::current()});
    (s.clone(),Waker::from(s))
}
fn wait_for_wake(s:&Signal,old:u32) {
    let end=Instant::now()+Duration::from_secs(20);
    while s.calls.load(Ordering::SeqCst)==old {
        let left=end.saturating_duration_since(Instant::now());assert!(!left.is_zero(),"lost Rust wakeup");
        thread::park_timeout(left);
    }
}
pub(super) fn until(f:impl Fn()->bool) {
    let end=Instant::now()+Duration::from_secs(20);
    while !f(){assert!(Instant::now()<end,"Lean did not reach the expected state");thread::sleep(Duration::from_millis(2));}
}
// A conventional executor that *only* polls again after a real wake.
pub(super) fn block<F:Future>(f:F)->F::Output {
    let (s,w)=signal();let mut future=std::pin::pin!(f);let mut cx=Context::from_waker(&w);
    loop{let old=s.calls.load(Ordering::SeqCst);match future.as_mut().poll(&mut cx){
        Poll::Ready(v)=>return v,Poll::Pending=>wait_for_wake(&s,old)
    }}
}
pub(super) fn run(){
    use lab::{Error,Fault,Stream};
    let s="é\0λ";assert_eq!(block(async{lab::bytes(&[0,255,9]).unwrap().await.unwrap()}),[0,255,9]);
    assert!(matches!(lab::checked(true,false,s),Err(Error::Start(e)) if e==s));
    assert_eq!(block(lab::checked(false,true,s).unwrap()).unwrap(),Err(s.to_owned()));
    assert_eq!(block(lab::checked(false,false,s).unwrap()).unwrap(),Ok(42));
    assert!(matches!(lab::io_task(true),Err(Error::Boundary(Fault::Io{message,..})) if message.contains("IO refusal")));
    block(lab::io_task(false).unwrap()).unwrap();

    lab::reset().unwrap();let mut f=lab::gated(false,i64::MIN).unwrap();
    let (first,w1)=signal();let (latest,w2)=signal();
    assert!(Pin::new(&mut f).poll(&mut Context::from_waker(&w1)).is_pending());
    assert!(Pin::new(&mut f).poll(&mut Context::from_waker(&w2)).is_pending());
    until(||lab::phase().unwrap()==1);
    assert_eq!(first.calls.load(Ordering::SeqCst),0);assert_eq!(latest.calls.load(Ordering::SeqCst),0);
    lab::release().unwrap();wait_for_wake(&latest,0);
    assert_eq!(Pin::new(&mut f).poll(&mut Context::from_waker(&w2)),Poll::Ready(Ok(i64::MIN)));
    assert_eq!(first.calls.load(Ordering::SeqCst),0);
    assert_eq!(Pin::new(&mut f).poll(&mut Context::from_waker(&w2)),Poll::Ready(Err(Error::Boundary(Fault::Closed))));

    lab::reset().unwrap();let mut f=lab::gated(true,9).unwrap();
    assert!(Pin::new(&mut f).poll(&mut Context::from_waker(&w1)).is_pending());
    until(||lab::phase().unwrap()==1);f.cancel().unwrap();
    assert_eq!(block(f),Err(Error::Boundary(Fault::Cancelled)));
    until(||lab::phase().unwrap()==2);
    lab::reset().unwrap();let mut f=lab::gated(false,10).unwrap();
    assert!(Pin::new(&mut f).poll(&mut Context::from_waker(&w1)).is_pending());
    until(||lab::phase().unwrap()==1);drop(f);lab::release().unwrap();until(||lab::phase().unwrap()==3);
    assert_eq!(first.calls.load(Ordering::SeqCst),0);

    let base=lab::closes().unwrap();let n=lab::pulls().unwrap();let mut it=lab::series(true,false,s).unwrap();
    assert_eq!(n,lab::pulls().unwrap());assert_eq!(block(it.next()),Some(Ok(Err(s.to_owned()))));
    assert!(matches!(block(it.next()),Some(Err(Error::Step(413)))));
    assert_eq!(block(it.next()),None);drop(it);assert_eq!(lab::closes().unwrap(),base+1);
    let mut it=lab::series(false,false,s).unwrap();
    assert!(block(it.next()).unwrap().is_ok());assert_eq!(block(it.next()),Some(Ok(Ok(73))));
    assert_eq!(block(it.next()),None);assert_eq!(block(it.next()),None);drop(it);
    assert_eq!(lab::closes().unwrap(),base+2);
    lab::reset().unwrap();let mut it=lab::series(false,true,s).unwrap();let before=lab::pulls().unwrap();
    // Abandon the waiter, not the stream. Its replacement shares the same pull.
    let mut next=Box::pin(it.next());assert!(next.as_mut().poll(&mut Context::from_waker(&w1)).is_pending());drop(next);
    assert!(Pin::new(&mut it).poll_next(&mut Context::from_waker(&w2)).is_pending());
    until(||lab::phase().unwrap()==1);assert_eq!(lab::pulls().unwrap(),before+1);lab::release().unwrap();
    assert!(block(it.next()).unwrap().is_ok());assert_eq!(lab::pulls().unwrap(),before+1);
    it.close().unwrap();assert_eq!(block(it.next()),None);drop(it);assert_eq!(lab::closes().unwrap(),base+3);
    assert!(thread::spawn(||matches!(lab::phase(),Err(Error::Boundary(Fault::WrongContext)))).join().unwrap());
}
