use std::{cell::{Cell,RefCell},rc::Rc};
use workshop::{BigInt,BigUint,Borrowed,Fault,HostCallError,HostError,MemberResult};
struct Dial(Cell<u32>);
impl Dial {fn read(&self)->u32 {self.0.get()}}
struct Meter {
    level:Cell<u32>, dial:Rc<Dial>, kept:RefCell<Option<Rc<Dial>>>,
    err:RefCell<Option<HostError>>, wrong_parent:Cell<bool>, panics:Cell<bool>,
}
impl Meter {
    fn create(v:u32)->Rc<Self> {Rc::new(Self{level:Cell::new(v),dial:Rc::new(Dial(Cell::new(v+1))),kept:Default::default(),err:Default::default(),wrong_parent:Cell::new(false),panics:Cell::new(false)})}
    fn read(&self)->MemberResult<u32>{if self.panics.get(){panic!("from Rust")}if let Some(e)=self.err.borrow().clone(){Err(e)}else{Ok(self.level.get())}}
    fn set_level(&self,v:u32){self.level.set(v)}
    fn get_level(&self)->u32 {self.level.get()}
    fn identity(self:&Rc<Self>)->Rc<Self>{self.clone()}
    fn echo_text(&self,s:String)->String{s+"!"}
    fn echo_bytes(&self,mut b:Vec<u8>)->Vec<u8>{b.push(255);b}
    fn shift(&self,i:BigInt)->BigInt{i-5}
    fn child(self:&Rc<Self>)->Borrowed<Dial> {
        if self.wrong_parent.get(){Borrowed::new(&Self::create(3),self.dial.clone())}else{Borrowed::new(self,self.dial.clone())}
    }
    fn child_from(self:&Rc<Self>,p:&Rc<Self>)->Borrowed<Dial> {Borrowed::new(if self.wrong_parent.get(){self}else{p},p.dial.clone())}
    fn keep_dial(&self,d:Rc<Dial>)->u32{let n=d.read();*self.kept.borrow_mut()=Some(d);n}
    fn take_dial(&self,d:Rc<Dial>)->u32{self.keep_dial(d)}
}
workshop::bind_objects!(A{Box=Meter,Dial=Dial});
peer::bind_objects!(B{Box=Meter,Dial=Dial});
fn main() {
    let mode=std::env::args().nth(1).unwrap();
    let (a,b)=if mode=="reverse" {let b=peer::Binding::<B>::new().unwrap();(workshop::Binding::<A>::new().unwrap(),b)}
        else {let a=workshop::Binding::<A>::new().unwrap();(a,peer::Binding::<B>::new().unwrap())};
    let x=a.make(15).unwrap();let y=Meter::create(100);
    if mode.starts_with("invalid-") {
        x.wrong_parent.set(true);
        if mode=="invalid-receiver" {assert!(matches!(a.child(&x),Err(HostCallError::Boundary(Fault::Unavailable))));}
        else {assert_eq!(mode,"invalid-parameter");assert!(matches!(b.child_from(&x,&y),Err(HostCallError::Boundary(Fault::Unavailable))));}
        assert!(matches!(a.read(&y),Err(HostCallError::Boundary(Fault::Unavailable))));
        let w=Rc::downgrade(x.as_rc());drop(x);a.close().unwrap();b.close().unwrap();assert!(w.upgrade().is_none());
        println!("invalid borrow retired both archives; closed cleanly");return;
    }
    if mode=="panic" {
        x.panics.set(true);assert!(matches!(a.read(&x),Err(HostCallError::Boundary(Fault::CallbackPanic{..}))));
        assert!(matches!(b.read(&y),Err(HostCallError::Boundary(Fault::Unavailable))));
        a.close().unwrap();b.close().unwrap();println!("panic retired both archives; closed cleanly");return;
    }
    assert_eq!(b.update(&x,41).unwrap(),41);let same=b.identity(&x).unwrap();assert!(same.ptr_eq(&x));
    assert!(matches!(a.bytes(&x,&vec![0; (16 << 20) + 1]),Err(HostCallError::Boundary(Fault::Limit))));
    assert_eq!(a.text(&x,"a\0λ").unwrap(),"a\0λ!");assert_eq!(b.bytes(&x,&[0,128]).unwrap(),[0,128,255]);
    let wide=(BigInt::from(1)<<320usize)+BigInt::from(7);
    assert_eq!(a.shift(&x,&(-&wide)).unwrap(),-&wide-5);assert_eq!(b.shift(&x,&wide).unwrap(),&wide-5);
    let nat=BigUint::from(1u8)<<321usize;assert_eq!(a.natural(&nat).unwrap(),nat);assert_eq!(b.natural(&BigUint::from(0u8)).unwrap(),BigUint::from(0u8));
    let original:HostError=Rc::new(std::io::Error::other("meter error"));*x.err.borrow_mut()=Some(original.clone());
    match b.read(&x) {Err(HostCallError::Host(e))=>assert!(Rc::ptr_eq(&e,&original)),_=>panic!("wrong host error")}
    match a.mapped(&x){Err(HostCallError::Declared{payload,..})=>assert_eq!(payload,"host read failed"),_=>panic!("wrong mapped error")}
    match b.fail_with(&x){Err(HostCallError::Declared{payload,..})=>assert!(payload.ptr_eq(&x)),_=>panic!("wrong resource error")}
    assert!(matches!(b.choose(&x,false),Ok(Err(17))));assert!(a.choose(&x,true).unwrap().unwrap().ptr_eq(&x));
    x.err.borrow_mut().take();b.update(&x,0).unwrap();
    match a.read_online(&x){Err(HostCallError::Io{declaration,message})=>{assert_eq!(declaration,"Workshop.readOnline");assert_eq!(message,"meter disconnected")},_=>panic!("wrong Lean IO error")}
    let first=a.child(&x).unwrap();let second=b.child_from(&x,&y).unwrap();
    assert!(Rc::ptr_eq(first.as_rc(),&x.dial));assert!(Rc::ptr_eq(second.as_rc(),&y.dial));
    assert_eq!(a.read_dial(&second).unwrap(),101);assert_eq!(b.keep_dial(&x,&first).unwrap(),16);
    assert_eq!(a.take_dial(&x,&second).unwrap(),101);assert!(Rc::ptr_eq(x.kept.borrow().as_ref().unwrap(),second.as_rc()));x.kept.borrow_mut().take();
    let wx=Rc::downgrade(x.as_rc());let wy=Rc::downgrade(&y);let wd=Rc::downgrade(first.as_rc());
    drop(same);drop(x);drop(y);drop(first);a.close().unwrap();assert!(wx.upgrade().is_some() && wy.upgrade().is_some());
    b.close().unwrap();assert!(wx.upgrade().is_none() && wd.upgrade().is_none() && wy.upgrade().is_some());
    assert_eq!(second.read(),101);drop(second);assert!(wy.upgrade().is_none());
    println!("installed Cargo host: original object, both anchors, integer and error channels, strong cleanup");
}
