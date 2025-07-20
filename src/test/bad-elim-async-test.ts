// let func = GrimTag.callableTagMethodTupleToFuncMap.get(List(["Mul", "Nat", "Nat"]));
// if (func) {
//     let ret = func([new GrimNat("12345678987654321"), new GrimNat("98765432123456789")]);
//     console.log('GrimTag callable Mul result:', ret.toString());
// }

// async function multiplyBigIntegers() {
//     await gmp.init(); // Initialize GMP-wasm

//     // Parse two large integers from strings
//     const a: Integer = gmp.Integer.fromString("1234567890123456789012345678901234567890");
//     const b: Integer = gmp.Integer.fromString("9876543210987654321098765432109876543210");

//     // Multiply them
//     const result: Integer = a.mul(b);

//     // Print the result as a string
//     console.log(result.toString());
// }
// multiplyBigIntegers();

// works
// gmp.init().then(({ getContext }) => {
//     const ctx = getContext();
//     let x = ctx.Integer("1234567890123456789012345678901234567890");
//     let y = ctx.Integer("9876543210987654321098765432109876543210");
//     let z = x.mul(y);
//     console.log(z.toString());
//     setTimeout(() => ctx.destroy(), 50);
// });

// works
// gmp.init().then((ob) => {
//     const ctx = ob.getContext();
//     let x = ctx.Integer("1234567890123456789012345678901234567890");
//     let y = ctx.Integer("9876543210987654321098765432109876543210");
//     let z = x.mul(y);
//     console.log(z.toString());
//     setTimeout(() => ctx.destroy(), 50);
// });

// works
// async function multiplyBigIntegers() {
//     let ob = await gmp.init();
//     const ctx = ob.getContext();
//     let x = ctx.Integer("1234567890123456789012345678901234567890");
//     let y = ctx.Integer("9876543210987654321098765432109876543210");
//     let z = x.mul(y);
//     console.log(z.toString());
//     setTimeout(() => ctx.destroy(), 50);
// }
// await multiplyBigIntegers();

async function multiplyBigIntegers(done: () => void) {
    let ob = await gmp.init();
    const ctx = ob.getContext();
    let x = ctx.Integer("1234567890123456789012345678901234567890");
    let y = ctx.Integer("9876543210987654321098765432109876543210");
    let z = x.mul(y);
    console.log(z.toString());
    done();
    setTimeout(() => ctx.destroy(), 50);
}

let completeBox = [false];
function testMultiplyBigIntegers() {
    (async () => await multiplyBigIntegers(() => {
        console.log("Finished multiplying big integers");
        // set some global boolean to indicate completion
        completeBox[0] = true;
    }))();
}

testMultiplyBigIntegers();

// TODO block with a while loop and sleeping until 'complete' is true
let interval = setInterval(() => {
    if (completeBox[0]) {
        console.log("Big integer multiplication completed.");
        clearInterval(interval);
    } else {
        console.log("Waiting for big integer multiplication to complete...");
    }
}, 5); // check every 50 milliseconds

// // this successfully blocks, but then the thing we are waiting for never completes
// // because it is not on another thread
// while (!completeBox[0]) {
//     // Busy-waiting loop, not recommended in production code
//     // This is just for demonstration purposes
//     // In a real application, you would use promises or callbacks to avoid blocking
//     // console.log("Waiting for big integer multiplication to complete...");
//     //sleep(50); // This is a placeholder for actual sleep logic
// }

console.log("After with multiplyBigIntegers()");
