//! hover: a c1 c2 c3 c4
type merge<base, props> =
	Omit<base, keyof props & keyof base>
	& props

type Type<t> = {
	merge: <r>(r: r) => Type<merge<t, r>>
}

declare const a: Type<{ a: 1 }>

const c1 = a.merge({ b: 2 })
const c2 = c1.merge({ c: 3 })
const c3 = c2.merge({ d: 4 })
const c4 = c3.merge({ e: 5 })
const c5 = c4.merge({ f: 6 })
const c6 = c5.merge({ g: 7 })
const c7 = c6.merge({ h: 8 })
const c8 = c7.merge({ i: 9 })
const c9 = c8.merge({ j: 10 })
const c10 = c9.merge({ k: 11 })
const c11 = c10.merge({ l: 12 })
const c12 = c11.merge({ m: 13 })
const c13 = c12.merge({ n: 14 })
const c14 = c13.merge({ o: 15 })
const c15 = c14.merge({ p: 16 })
