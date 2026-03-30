import crypto from "crypto";
import type { RequestHandler } from "express";
import type session from "express-session";
import { storage } from "./storage";

const DEFAULT_PASSWORD = "Acldigital#123";
const GUEST_USERNAME = "Guest";
const PASSWORD_PREFIX = "scrypt";
const SCRYPT_KEYLEN = 64;

export type AuthUser = {
  id: string;
  username: string;
  isGuest: boolean;
  canChangePassword: boolean;
  mustChangePassword: boolean;
};

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

function buildPasswordHash(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${PASSWORD_PREFIX}$${salt}$${hash}`;
}

export function hashPassword(password: string) {
  return buildPasswordHash(password);
}

export function verifyPassword(password: string, storedPassword: string) {
  if (!storedPassword.startsWith(`${PASSWORD_PREFIX}$`)) {
    return storedPassword === password;
  }

  const [, salt, expectedHash] = storedPassword.split("$");
  if (!salt || !expectedHash) {
    return false;
  }

  const actualHash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}

export function isGuestUsername(username: string) {
  return username.toLowerCase() === GUEST_USERNAME.toLowerCase();
}

export function isDefaultPasswordHash(storedPassword: string) {
  return verifyPassword(DEFAULT_PASSWORD, storedPassword);
}

export function toAuthUser(user: { id: string; username: string; password: string }): AuthUser {
  const isGuest = isGuestUsername(user.username);
  return {
    id: user.id,
    username: user.username,
    isGuest,
    canChangePassword: !isGuest,
    mustChangePassword: !isGuest && isDefaultPasswordHash(user.password),
  };
}

export async function ensureDefaultUsers() {
  const defaultUsers = ["Mani", "Renoj", GUEST_USERNAME];

  for (const username of defaultUsers) {
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      continue;
    }

    await storage.createUser({
      username,
      password: hashPassword(DEFAULT_PASSWORD),
    });
  }
}

export async function getAuthenticatedUser(sessionData: session.SessionData | null | undefined) {
  const userId = sessionData?.userId;
  if (!userId) {
    return undefined;
  }

  const user = await storage.getUser(userId);
  return user;
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req.session);
    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    res.locals.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

export const defaultPassword = DEFAULT_PASSWORD;
