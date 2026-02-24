import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Create a Nodemailer transport configured for Gmail SMTP
 */
export function createMailTransport(gmailUser: string, gmailAppPassword: string): Transporter {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });
}

/**
 * Send a digest email with alert details
 */
export async function sendDigestEmail(
  transport: Transporter,
  recipientEmail: string,
  senderEmail: string,
  htmlBody: string
): Promise<SendEmailResult> {
  try {
    await transport.sendMail({
      from: senderEmail,
      to: recipientEmail,
      subject: 'Job Tracker Alert Digest',
      html: htmlBody,
    });
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}
