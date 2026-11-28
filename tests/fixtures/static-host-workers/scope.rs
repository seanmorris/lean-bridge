// Private ABI probe. Native symbol declarations are generated from the compiled wire.
#![allow(dead_code)]
mod owner;
use owner::{HostRef,Kind,Session};
use std::{cell::Cell, rc::Rc};
type Dispatch=unsafe extern "C" fn(u64,i32,*const u64,usize,*mut u64,*mut u32)->i32;
type Visit=unsafe extern "C" fn(u64)->i32;
include!("native.rs");
#[repr(C)] struct PollFd { fd:i32, events:i16, revents:i16 }
unsafe extern "C" { fn poll(fds:*mut PollFd,n:usize,timeout:i32)->i32; }
struct Meter(u32);
struct State { registry:Session, meter:Rc<Meter>, outer:Cell<[u64;2]>, task:Cell<[u64;2]> }
unsafe fn state<'a>(id:u64)->&'a State { unsafe { &*(id as *const State) } }
unsafe extern "C" fn dispatch(id:u64,op:i32,a:*const u64,n:usize,out:*mut u64,fault:*mut u32)->i32 {
    if op>=0 || n!=2 || a.is_null() || out.is_null() || fault.is_null(){return 2}
    match unsafe{state(id).registry.refop(op,*a,*a.add(1))} {
        Ok(v)=>{unsafe{*out=v;*fault=0};0},Err(_)=>2
    }
}
fn scope(id:u64,f:Visit)->i32 {unsafe{visit(owner::instance(),id,dispatch,0,f)}}
fn obj(op:i32,source:u64,h:&mut [u64;2])->(i32,u64) {
    let mut out=0;let rc=unsafe{object(owner::instance(),op,0,source,h.as_mut_ptr(),&mut out)};(rc,out)
}
unsafe extern "C" fn reject_nested(id:u64)->i32 {
    let s=unsafe{state(id)};
    assert_eq!(obj(1,0,&mut s.outer.get()),(14,0));0
}
unsafe extern "C" fn start(id:u64)->i32 {
    let s=unsafe{state(id)};
    let t=s.registry.pin(0,&HostRef::from(s.meter.clone())).unwrap();
    let mut h=[0;2];assert_eq!(obj(0,t.id(),&mut h),(0,0));
    s.outer.set(h);assert_eq!(scope(id,reject_nested),0);
    let mut task=[0;2];let mut out=[0;4];let mut tags=[0;65];
    let input=[h[0],h[1],0];
    assert_eq!(unsafe{echo_start(input.as_ptr(),task.as_mut_ptr(),out.as_mut_ptr(),tags.as_mut_ptr())},0);
    assert!(task[0]!=0);s.task.set(task);
    assert_eq!(obj(2,0,&mut h),(0,0));0 // Scope exit releases the transport token.
}
unsafe extern "C" fn take(id:u64)->i32 {
    let s=unsafe{state(id)};
    assert_eq!(obj(1,0,&mut s.outer.get()),(14,0));
    let mut task=s.task.get();let mut out=[0;4];let mut tags=[0;65];
    assert_eq!(unsafe{echo_take(task.as_mut_ptr(),out.as_mut_ptr(),tags.as_mut_ptr())},0);
    assert_eq!(task[0],0);assert_eq!(&out[2..],&[0,3]);
    let mut h=[out[0],out[1]];let (rc,ticket)=obj(1,0,&mut h);assert_eq!(rc,0);
    let same=s.registry.take::<Meter>(0,ticket).unwrap();
    assert!(Rc::ptr_eq(same.as_rc(),&s.meter));assert_eq!(same.0,42);
    assert_eq!(obj(3,0,&mut h),(0,0));assert_eq!(obj(3,0,&mut h),(14,0));s.task.set(task);0
}
unsafe extern "C" fn cancel(id:u64)->i32 {
    let s=unsafe{state(id)};let mut task=s.task.get();
    assert_eq!(unsafe{echo_close(task.as_mut_ptr())},0);assert_eq!(task[0],0);s.task.set(task);0
}
fn bind(id:u64,op:i32)->i32{
    let mut out=[0;4];let mut tags=[0;65];let mut fault=0;
    unsafe{call(owner::instance(),id,dispatch,op,std::ptr::null(),0,out.as_mut_ptr(),tags.as_mut_ptr(),&mut fault)}
}
fn main(){
    let s=State{registry:Session::new(DOMAIN,vec![Kind::of::<Meter>(KIND)]).unwrap(),
        meter:Rc::new(Meter(42)),outer:Cell::new([0;2]),task:Cell::new([0;2])};
    let id=&s as *const State as u64;let wrong=owner::instance()^1;
    let mut h=[0u64;2];let mut result=0;
    assert_eq!(unsafe{object(wrong,3,0,0,h.as_mut_ptr(),&mut result)},15);
    assert_eq!(unsafe{visit(wrong,id,dispatch,1,cancel)},15);
    assert_eq!(bind(id,-2),0);assert_eq!(obj(3,0,&mut h),(14,0));
    assert_eq!(unsafe{visit(wrong,id,dispatch,0,cancel)},15);
    assert_eq!(std::thread::spawn(move||scope(id,cancel)).join().unwrap(),15);
    assert_eq!(scope(id,start),0);
    let mut fd=-1;let mut task=s.task.get();
    let rc=unsafe{echo_poll(task.as_mut_ptr(),&mut fd)};
    if rc==1 {let mut p=PollFd{fd,events:1,revents:0};assert!(fd>=0 && unsafe{poll(&mut p,1,10000)}>0);}
    else {assert_eq!(rc,0);}
    assert_eq!(scope(id,take),0);
    assert_eq!(scope(id,start),0);assert_eq!(scope(id,cancel),0);
    assert_eq!(bind(id,-1),0);assert_eq!(Rc::strong_count(&s.meter),1);
    println!("compiled Lean task returned the original Rust Rc; scopes, cancel and close released all leases");
}
