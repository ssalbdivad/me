//! hover: regex version groups exec
import { regex } from "arkregex"

const version = regex(
	"^(?<major>\\d+)\\.(?<minor>\\d+)$"
)

const { groups } = version.exec("2.2")!
//      ^?
