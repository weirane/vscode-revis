// ==== E499: multiple mutable borrow (done) ====
fn e499() {
    let mut i = 0;
    let mut _x = &mut i;
    let mut _a = &mut i;
    _x;
}

fn e499_loop() {
    let mut v = vec![1, 2, 3];
    for _x in v.iter_mut() {
        v.push(1);
    }
}

// ==== E502: immutable borrow + mutable borrow (started) ====
fn bar(_x: &mut i32) {}

fn e502(a: &mut i32) {
    let y = &a;
    bar(a);
    // newlineabcdefghijk
    // abc
    println!("{}", y);
}

fn e502_point_imm(mut x: [String; 4]) {
    let r = match x {
        ref mut foo @ [.., _] => Some(foo),
        _ => None,
    };
    &x;
    drop(r);
}

// ==== E503: used after mutable borrow (done) ====
fn e503() {
    let mut value = 3;
    let borrow = &mut value;
    let _sum = value + 1;
    println!("{}", borrow);
}

// ==== E505: moved while borrowed (started) ====
struct Value {}
fn borrow(_val: &Value) {}
fn eat(_val: Value) {}

fn e505() {
    let x = Value {};
    let _ref_to_val: &Value = &x;
    eat(x);
    borrow(_ref_to_val);
}

// ==== E506: assign to a borrowed value (done) ====
struct FancyNum {
    num: u8,
}

fn e506() {
    let mut fancy_num = FancyNum { num: 5 };
    let fancy_ref = &fancy_num;
    fancy_num = FancyNum { num: 6 };
    println!("Num: {}, Ref: {}", fancy_num.num, fancy_ref.num);
}
