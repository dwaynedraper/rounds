import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

// Better Auth's magic-link + session endpoints. Public survey never uses
// these — CMS login only.
export const { GET, POST } = toNextJsHandler(auth);
