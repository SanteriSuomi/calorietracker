import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

export function createResendTransport() {
	return nodemailer.createTransport({
		host: 'smtp.resend.com',
		port: 465,
		secure: true,
		auth: {
			user: 'resend',
			pass: env.RESEND_API_KEY
		}
	});
}
