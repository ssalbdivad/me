//! hover: validate
import { type } from "arktype"
// ---cut---
const email = type("string.email")

email["~standard"].validate(
	"david@arktype.io"
)
