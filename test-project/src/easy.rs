// ==== E384: assign to immutable variable (easy?) ====
fn e384() {
    let x = 3;
    x = 5;
}

// ==== E594: assign to immutable value ====
fn e594() {
    struct SolarSystem {
        earth: i32,
    }
    let ss = SolarSystem { earth: 3 };
    ss.earth = 2;
}

// ==== E596: mutably borrow a non-mutable variable (single case) ====
fn e596() {
    let x = 1;
    let y = &mut x;
}

// ==== E515: return reference to local ====
fn e515() -> &'static i32 {
    let x = 0;
    &x
}
