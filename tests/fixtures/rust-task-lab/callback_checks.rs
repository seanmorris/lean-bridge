use super::{lab,peer,pulse_checks::{block,until,wait_for_request},snapshot};
use lab::{BigInt,BigUint,CallbackError,Error,Fault,RetainedCallback};
use std::{cell::{Cell,RefCell},fmt,rc::Rc};

#[derive(Debug)] struct Marker(u32);
#[derive(Debug)] struct Local(Rc<Cell<u32>>);
impl fmt::Display for Local {fn fmt(&self,f:&mut fmt::Formatter<'_>)->fmt::Result{f.write_str("local")}}
impl std::error::Error for Local {}
impl fmt::Display for Marker {fn fmt(&self,f:&mut fmt::Formatter<'_>)->fmt::Result{f.write_str("identical")}}
impl std::error::Error for Marker {}
fn eventfds()->usize{
    std::fs::read_dir("/proc/self/fd").unwrap().flatten().filter_map(|e|std::fs::read_link(e.path()).ok())
        .filter(|p|p.to_str()==Some("anon_inode:[eventfd]")).count()
}
fn queued(f:impl Fn(u32)->Result<u32,CallbackError>+'static)->lab::CallbackTask<u32>{
    lab::cb_reset().unwrap();
    let mut t=lab::cb_queued(f).unwrap();until(||lab::cb_state().unwrap()==3);
    // The inner task cannot complete without a reply. This real executor wake
    // proves the request is queued, not merely about to be enqueued.
    wait_for_request(&mut t,||lab::cb_release().unwrap());t
}
fn scalars(){
    let n=(BigUint::from(1u8)<<4095usize)+BigUint::from(23u8);let want=n.clone();
    block(peer::cb_scalar_tour(
        |()|Ok(true),|b|{assert!(b);Ok('🎼')},|c|{assert_eq!(c,'🎼');Ok("λ\0é".into())},
        |s|{assert_eq!(s,"λ\0é");Ok(vec![0,255])},move|b|{assert_eq!(b,[0,255]);Ok(n.clone())},
        move|v|{assert_eq!(v,want);Ok(-BigInt::from(v))},|i|{assert!(i.bits()==4096 && i<0.into());Ok(u8::MAX)},
        |v|{assert_eq!(v,u8::MAX);Ok(u16::MAX)},|v|{assert_eq!(v,u16::MAX);Ok(u32::MAX)},
        |v|{assert_eq!(v,u32::MAX);Ok(u64::MAX)},|v|{assert_eq!(v,u64::MAX);Ok(usize::MAX)},
        |v|{assert_eq!(v,usize::MAX);Ok(i8::MIN)},|v|{assert_eq!(v,i8::MIN);Ok(i16::MIN)},
        |v|{assert_eq!(v,i16::MIN);Ok(i32::MIN)},|v|{assert_eq!(v,i32::MIN);Ok(i64::MIN)},
        |v|{assert_eq!(v,i64::MIN);Ok(isize::MIN)},|v|{assert_eq!(v,isize::MIN);Ok(-0.0f32)},
        |v|{assert!(v.is_sign_negative()&&v==0.0);Ok(f64::INFINITY)},|v|{assert_eq!(v,f64::INFINITY);Ok(())}
    ).unwrap()).unwrap();
}
fn calls_and_errors(){
    let owner=std::thread::current().id();let seen=Rc::new(Cell::new(0));let count=seen.clone();
    let task=lab::cb_during_start(move|s|{
        assert_eq!(owner,std::thread::current().id());count.set(count.get()+1);
        // Reenter an independently packaged component from ordinary Rust.
        assert_eq!(peer::cb_plain(6).unwrap(),7);Ok(s+"!")
    },|s|Ok(s+"?"),"α\0").unwrap();
    assert_eq!(seen.get(),0);
    assert_eq!(block(task).unwrap(),"α\0!?!");assert_eq!(seen.get(),2);
    let local=Rc::new(Cell::new(10));let captured=local.clone();
    match block(lab::cb_repeat_call("",move|_|Err(CallbackError::new(Local(captured.clone())))).unwrap()){
        Err(Error::Callback{error,..})=>{let value=&error.downcast_ref::<Local>().unwrap().0;assert!(Rc::ptr_eq(value,&local));value.set(11);},
        x=>panic!("lost non-Send callback payload: {x:?}"),
    }
    assert_eq!(local.get(),11);
    let err=CallbackError::new(Marker(17));let expected=err.clone();
    match block(peer::cb_repeat_call("x",move|_|Err(err.clone())).unwrap()){
        Err(Error::Callback{declaration,error})=>{
            assert_eq!(declaration,"Lab.cbRepeatCall");assert!(expected.same_error(&error));
            assert_eq!(error.downcast_ref::<Marker>().unwrap().0,17);
        },x=>panic!("callback origin lost: {x:?}")
    }
    assert!(matches!(block(lab::cb_during_start(|_|Err(CallbackError::new(Marker(1))),|s|Ok(s),"").unwrap()),
        Err(Error::Callback{declaration:"Lab.cbDuringStart",..})));
    assert!(matches!(block(lab::cb_replace_error(|_|Err(CallbackError::new(Marker(2)))).unwrap()),
        Err(Error::Boundary(Fault::TaskIo{declaration:"Lab.cbReplaceError",message})) if message=="identical"));
    assert_eq!(block(lab::cb_recover(|_|Err(CallbackError::new(Marker(3))),&0u8.into()).unwrap()).unwrap(),Err("caught in Lean".into()));
    assert!(matches!(block(lab::cb_typed_start(|b|Ok(b),true,&[]).unwrap()),Err(Error::Start(s)) if s=="factory refused"));
    assert_eq!(block(lab::cb_typed_start(|b|Ok(b),false,&[0,255]).unwrap()).unwrap(),[0,255]);
    let ordinary:lab::Task<u32>=lab::cb_terminal(false).unwrap();
    assert_eq!(block(ordinary).unwrap(),42);
    assert!(matches!(block(lab::cb_terminal(true).unwrap()),Err(Error::Boundary(Fault::TaskIo{message,..})) if message=="late IO"));
    assert!(matches!(lab::local_start(true),Err(Error::Boundary(Fault::Io{declaration:"Lab.localStart",message})) if message=="early IO"));
    let plain:lab::Task<u32>=lab::local_start(false).unwrap();assert_eq!(block(plain).unwrap(),18);
}
fn lifetimes(){
    let cut=Rc::new(RefCell::new(None::<RetainedCallback<String,String>>));let inside=cut.clone();
    let calls=Rc::new(Cell::new(0));let count=calls.clone();
    let handle=RetainedCallback::new(move|s|{count.set(count.get()+1);inside.borrow_mut().take().unwrap().close();Ok(s)});
    cut.replace(Some(handle.clone()));
    assert!(matches!(block(lab::cb_repeat_call("a",handle.function()).unwrap()),
        Err(Error::Callback{error,..}) if error.downcast_ref::<Fault>()==Some(&Fault::Closed)));
    assert_eq!(calls.get(),1);
    let host=Rc::new(7);let weak=Rc::downgrade(&host);
    assert_eq!(block(lab::cb_remember(move|v|Ok(v+*host)).unwrap()).unwrap(),17);
    assert!(weak.upgrade().is_none(),"Lean retained the Rust closure past settlement");
    assert!(matches!(block(lab::cb_use_expired().unwrap()),Err(Error::Boundary(Fault::TaskIo{message,..})) if message.contains("expired")));
    lab::cb_forget().unwrap();
    let hits=Rc::new(Cell::new(0));let q=hits.clone();
    let mut t=queued(move|v|{q.set(q.get()+1);Ok(v)});
    t.cancel().unwrap();t.cancel().unwrap();assert_eq!(block(t),Err(Error::Boundary(Fault::Cancelled)));
    until(||lab::cb_state().unwrap()==4);assert_eq!(hits.get(),0);
    lab::cb_reset().unwrap();let t=lab::cb_cancel_late(|_|panic!("callback after drop")).unwrap();
    until(||lab::cb_state().unwrap()==1);drop(t);lab::cb_release().unwrap();until(||lab::cb_state().unwrap()==2);
}
pub fn isolated(mode:&str){
    let hits=Rc::new(Cell::new(0));let q=hits.clone();
    let t=queued(move|v|{q.set(q.get()+1);if mode_is_panic(){panic!("deliberate callback panic");}Ok(v)});
    match mode {
        "panic"=>{assert!(matches!(block(t),Err(Error::Boundary(Fault::CallbackPanic{declaration:"Lab.cbQueued"}))));assert_eq!(hits.get(),1);}
        "retire"=>{
            unsafe{let v=super::dlsym(std::ptr::null_mut(),c"lean_bridge_native_runtime_retire".as_ptr());
                assert!(!v.is_null());std::mem::transmute::<_,unsafe extern "C" fn()>(v)();}
            assert!(matches!(block(t),Err(Error::Boundary(Fault::Unavailable))));assert_eq!(hits.get(),0);
        }
        _=>panic!("unexpected isolated case")
    }
    assert!(matches!(lab::cb_plain(0),Err(Error::Boundary(Fault::Unavailable))));until(||snapshot().live==0);
}
fn mode_is_panic()->bool{std::env::args().nth(1).as_deref()==Some("panic")}
pub fn run(){
    fn send_sync<T:Send+Sync>(){} send_sync::<lab::Error>(); send_sync::<lab::Error<String>>();
    let baseline=snapshot().live;let fds=eventfds();scalars();calls_and_errors();lifetimes();
    until(||snapshot().live==baseline);assert_eq!(eventfds(),fds);
    for mode in ["retire","panic"]{
        assert!(std::process::Command::new(std::env::current_exe().unwrap()).arg(mode).status().unwrap().success(),"{mode}");
    }
    println!("Rust: retained callback checks passed");
}
