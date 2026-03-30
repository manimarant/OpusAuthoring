import { config } from "dotenv";
import { storage } from "../server/storage";
import { hashPassword } from "../server/auth";

config();

async function main() {
  const [, , usernameArg, passwordArg] = process.argv;
  const username = usernameArg?.trim();
  const password = passwordArg ?? "";

  if (!username || !password) {
    throw new Error("Usage: tsx scripts/reset-user-password.ts <username> <newPassword>");
  }

  const user = await storage.getUserByUsername(username);
  if (!user) {
    throw new Error(`User not found: ${username}`);
  }

  const updatedUser = await storage.updateUserPassword(user.id, hashPassword(password));
  if (!updatedUser) {
    throw new Error(`Failed to update password for: ${username}`);
  }

  console.log(`Password updated for ${updatedUser.username}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
