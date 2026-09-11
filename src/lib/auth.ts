import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      activeOrganizationId?: string | null;
      deviceSessionId?: string | null;
    } & DefaultSession["user"];
  }
  interface User {
    activeOrganizationId?: string | null;
    deviceSessionId?: string | null;
    tokenVersion?: number;
  }
}

function clientInfo(req?: Request) {
  const ua = req?.headers.get("user-agent") ?? null;
  const forwarded = req?.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req?.headers.get("x-real-ip") || null;
  return { ua, ip };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            isActive: true,
            tokenVersion: true,
          },
        });

        const { ua, ip } = clientInfo(req);

        if (!user || !user.passwordHash || !user.isActive) {
          if (user) {
            await db.loginEvent.create({
              data: { userId: user.id, userAgent: ua, ip, success: false },
            }).catch(() => {});
          }
          return null;
        }

        const passwordValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!passwordValid) {
          await db.loginEvent.create({
            data: { userId: user.id, userAgent: ua, ip, success: false },
          }).catch(() => {});
          return null;
        }

        const deviceSession = await db.deviceSession.create({
          data: {
            userId: user.id,
            token: randomUUID(),
            userAgent: ua,
            ip,
            lastSeenAt: new Date(),
          },
        }).catch(() => null);

        await db.loginEvent.create({
          data: { userId: user.id, userAgent: ua, ip, success: true },
        }).catch(() => {});

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          deviceSessionId: deviceSession?.id ?? null,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.sid = user.deviceSessionId ?? null;
        token.tv = user.tokenVersion ?? 0;
        return token;
      }

      if (!token.id) return null;

      const userRow = await db.user.findUnique({
        where: { id: token.id as string },
        select: { id: true, isActive: true, tokenVersion: true },
      });
      const version = (token.tv as number) ?? 0;
      if (!userRow || !userRow.isActive || userRow.tokenVersion !== version) {
        return null;
      }

      const sid = token.sid as string | null;
      if (sid) {
        const sessionRow = await db.deviceSession.findUnique({
          where: { id: sid },
          select: { active: true, lastSeenAt: true },
        });
        if (!sessionRow || !sessionRow.active) return null;
        if (
          !sessionRow.lastSeenAt ||
          Date.now() - sessionRow.lastSeenAt.getTime() > 10 * 60 * 1000
        ) {
          await db.deviceSession
            .update({ where: { id: sid }, data: { lastSeenAt: new Date() } })
            .catch(() => {});
        }
        token.sid = sid;
      }

      return token;
    },
    async session({ session, token }) {
      if (token && token.id) {
        session.user.id = token.id as string;
        session.user.deviceSessionId = (token.sid as string) ?? null;
      }
      return session;
    },
  },
});