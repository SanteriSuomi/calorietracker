import { env } from '$env/dynamic/private';
import { logger } from '$lib/server/logger';
import { createResendTransport } from './resend';

type EmailProvider = 'resend' | 'azure';

interface SendEmailOptions {
	to: string;
	subject: string;
	html: string;
	text?: string;
}

const provider: EmailProvider = (env.EMAIL_PROVIDER as EmailProvider) || 'resend';

let azureTransport: Awaited<ReturnType<typeof import('./azure').createAzureTransport>> | null =
	null;

async function getTransport() {
	if (provider === 'azure') {
		if (!azureTransport) {
			const { createAzureTransport } = await import('./azure');
			azureTransport = createAzureTransport();
		}
		return azureTransport;
	}
	return createResendTransport();
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
	const apiKey = provider === 'resend' ? env.RESEND_API_KEY : env.ACS_SMTP_PASSWORD;
	if (!apiKey) {
		logger.info({
			detail: `Email not sent: ${provider} API key not configured`,
			emailTo: options.to,
			emailSubject: options.subject
		});
		return;
	}

	const from = env.EMAIL_FROM || 'onboarding@resend.dev';

	try {
		const transport = await getTransport();
		await transport.sendMail({
			from,
			to: options.to,
			subject: options.subject,
			html: options.html,
			text: options.text
		});
		logger.info({
			detail: 'Email sent',
			emailTo: options.to,
			emailSubject: options.subject,
			emailProvider: provider
		});
	} catch (error) {
		logger.error({
			detail: 'Email send failed',
			emailTo: options.to,
			emailSubject: options.subject,
			emailProvider: provider,
			error: error instanceof Error ? error.message : String(error)
		});
	}
}
