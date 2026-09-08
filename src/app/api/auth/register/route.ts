import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { seedDefaultRoles, seedChartOfAccounts, seedDefaultCountryConfigsIfMissing } from "@/lib/onboarding";

const registerSchema = z.object({
  companyName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  currency: z.string().default("NGN"),
  countryCode: z.string().default("NG"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { companyName, email, password, firstName, lastName, currency, countryCode } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json(
        { message: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const slug = await generateUniqueSlug(slugify(companyName));
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: `${firstName} ${lastName}`,
          passwordHash,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: companyName,
          slug,
          currency,
          countryCode,
          createdById: user.id,
        },
      });

      await tx.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          isOwner: true,
          status: "active",
        },
      });

      return { user, organization };
    });

    // Post-transaction seeding (idempotent)
    await Promise.all([
      seedDefaultRoles(result.organization.id),
      seedChartOfAccounts(result.organization.id),
      seedDefaultCountryConfigsIfMissing(result.organization.id),
    ]);

    // Attach the owner to the seeded Admin role so the role carries full
    // permissions for any user assigned to it.
    const adminRole = await db.organizationRole.findFirst({
      where: { organizationId: result.organization.id, name: "Admin" },
    });
    if (adminRole) {
      await db.userOrganization.update({
        where: {
          userId_organizationId: {
            userId: result.user.id,
            organizationId: result.organization.id,
          },
        },
        data: { roleId: adminRole.id },
      });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Registration failed", error);
    return NextResponse.json({ message: "Something went wrong" }, { status: 500 });
  }
}

async function generateUniqueSlug(base: string): Promise<string> {
  const candidate = base || "workspace";
  const existing = await db.organization.findUnique({ where: { slug: candidate } });
  if (!existing) return candidate;
  let i = 1;
  while (true) {
    const next = `${candidate}-${i}`;
    const found = await db.organization.findUnique({ where: { slug: next } });
    if (!found) return next;
    i += 1;
  }
}