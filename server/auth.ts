import crypto from "crypto";
import nodeCrypto from "node:crypto";
import type { RequestHandler } from "express";
import type { Request, Response } from "express";
import { storage } from "./storage";

const DEFAULT_PASSWORD = "Acldigital#123";
const GUEST_USERNAME = "Guest";
const PASSWORD_PREFIX = "scrypt";
const SCRYPT_KEYLEN = 64;
const AUTH_COOKIE_NAME = "opuslearn.auth";

export type AuthUser = {
  id: string;
  username: string;
  isGuest: boolean;
  canChangePassword: boolean;
  mustChangePassword: boolean;
};

function buildPasswordHash(password: string, salt = nodeCrypto.randomBytes(16).toString("hex")) {
  const hash = nodeCrypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
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
  if (!/^[a-f0-9]{32}$/i.test(salt) || !/^[a-f0-9]{128}$/i.test(expectedHash)) {
    return false;
  }

  try {
    const actualHash = nodeCrypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
    const actualBuffer = Buffer.from(actualHash, "hex");
    const expectedBuffer = Buffer.from(expectedHash, "hex");

    if (actualBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return nodeCrypto.timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    return false;
  }
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

function getAuthCookieSecret() {
  return process.env.AUTH_COOKIE_SECRET || process.env.SESSION_SECRET || "opuslearn-development-cookie-secret";
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signCookiePayload(payload: string) {
  return nodeCrypto.createHmac("sha256", getAuthCookieSecret()).update(payload).digest("base64url");
}

function parseCookies(headerValue: string | undefined) {
  const cookieMap = new Map<string, string>();
  if (!headerValue) {
    return cookieMap;
  }

  for (const part of headerValue.split(";")) {
    const trimmedPart = part.trim();
    if (!trimmedPart) {
      continue;
    }

    const separatorIndex = trimmedPart.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedPart.slice(0, separatorIndex).trim();
    const value = trimmedPart.slice(separatorIndex + 1).trim();
    cookieMap.set(key, decodeURIComponent(value));
  }

  return cookieMap;
}

function buildAuthToken(userId: string) {
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;
  const payload = `${userId}.${expiresAt}`;
  const encodedPayload = toBase64Url(payload);
  const signature = signCookiePayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function readUserIdFromRequest(req: Request) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.get(AUTH_COOKIE_NAME);
  if (!token) {
    return undefined;
  }

  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0) {
    return undefined;
  }

  const encodedPayload = token.slice(0, separatorIndex);
  const providedSignature = token.slice(separatorIndex + 1);
  const expectedSignature = signCookiePayload(encodedPayload);

  const providedSignatureBuffer = Buffer.from(providedSignature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (providedSignatureBuffer.length !== expectedSignatureBuffer.length) {
    return undefined;
  }

  if (!nodeCrypto.timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)) {
    return undefined;
  }

  const decodedPayload = fromBase64Url(encodedPayload);
  const payloadSeparatorIndex = decodedPayload.lastIndexOf(".");
  if (payloadSeparatorIndex <= 0) {
    return undefined;
  }

  const userId = decodedPayload.slice(0, payloadSeparatorIndex);
  const expiresAt = Number(decodedPayload.slice(payloadSeparatorIndex + 1));

  if (!userId || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return undefined;
  }

  return userId;
}

function buildCookieString(token: string, secure: boolean) {
  const segments = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (secure) {
    segments.push("Secure");
  }

  return segments.join("; ");
}

export function setAuthCookie(res: Response, userId: string, secure: boolean) {
  res.setHeader("Set-Cookie", buildCookieString(buildAuthToken(userId), secure));
}

export function clearAuthCookie(res: Response, secure: boolean) {
  const segments = [
    `${AUTH_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];

  if (secure) {
    segments.push("Secure");
  }

  res.setHeader("Set-Cookie", segments.join("; "));
}

export async function getAuthenticatedUser(req: Request) {
  const userId = readUserIdFromRequest(req);
  if (!userId) {
    return undefined;
  }

  const user = await storage.getUser(userId);
  return user;
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req);
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
