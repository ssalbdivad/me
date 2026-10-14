//! hover: me
type reverse<s extends string> =
	s extends `${infer head}${infer tail}`
		? `${reverse<tail>}${head}`
		: ""

type me = reverse<"ssalbdivad">
//   ^?
