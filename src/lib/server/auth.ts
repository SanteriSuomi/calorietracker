import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { betterAuth } from 'better-auth/minimal';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { databaseProvider } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { sendEmail } from '$lib/server/email';

export const auth = betterAuth({
	baseURL: env.ORIGIN,
	secret: env.BETTER_AUTH_SECRET,
	database: drizzleAdapter(db, { provider: databaseProvider === 'pg' ? 'pg' : 'sqlite' }),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) => {
			void sendEmail({
				to: user.email,
				subject: 'Reset your password',
				html: `<p>Click <a href="${url}">here</a> to reset your password.</p><p>If you didn't request this, ignore this email.</p>`,
				text: `Reset your password: ${url}`
			});
		},
		resetPasswordTokenExpiresIn: 3600
	},
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			void sendEmail({
				to: user.email,
				subject: 'Verify your email',
				html: `<p>Click <a href="${url}">here</a> to verify your email address.</p>`,
				text: `Verify your email: ${url}`
			});
		},
		sendOnSignUp: true,
		sendOnSignIn: true,
		autoSignInAfterVerification: true
	},
	plugins: [sveltekitCookies(getRequestEvent)]
});

const DEFAULT_USER_EMAIL = 'default@local';
const DEFAULT_USER_ID = 'default-user-local';

export async function ensureDefaultUser() {
	const existing = await db.select().from(user).where(eq(user.id, DEFAULT_USER_ID)).limit(1);
	if (existing.length > 0) return existing[0];

	const now = new Date();
	await db.insert(user).values({
		id: DEFAULT_USER_ID,
		name: 'Default User',
		email: DEFAULT_USER_EMAIL,
		emailVerified: true,
		image: null,
		createdAt: now,
		updatedAt: now
	});

	const created = await db.select().from(user).where(eq(user.id, DEFAULT_USER_ID)).limit(1);
	return created[0];
}
