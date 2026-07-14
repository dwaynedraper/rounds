// Add (or ensure) a CMS admin. Run after migrating, since the S3 allowlist
// means only seeded/invited emails can log in.
//   ADMIN_EMAIL=you@example.com npm run db:admin
import { randomUUID } from "crypto";
import { db } from "../src/db";
import { user } from "../src/db/auth-schema";

const email = (process.env.ADMIN_EMAIL ?? "dean@sharpsightedstudio.com").toLowerCase();

async function main() {
  await db
    .insert(user)
    .values({ id: randomUUID(), email, name: "Admin", emailVerified: true, role: "admin" })
    .onConflictDoNothing();
  console.log(`Admin ensured: ${email}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
