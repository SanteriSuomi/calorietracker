import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

export function createAzureTransport() {
	return nodemailer.createTransport({
		host: 'smtp.azurecomm.net',
		port: 587,
		secure: false,
		auth: {
			user: env.ACS_SMTP_USERNAME,
			pass: env.ACS_SMTP_PASSWORD
		}
	});
}
