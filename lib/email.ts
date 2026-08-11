import nodemailer from "nodemailer";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

/**
 * No SMTP credentials exist yet (that's whichever provider you pick,
 * configured via the commented-out block in .env.example) — so in
 * development this just logs the email to the console, which is enough to
 * click a verification/reset link by hand while building. The moment
 * SMTP_HOST etc. are set, it sends for real; nothing else about the call
 * site changes.
 */
export async function sendEmail({ to, subject, text }: SendEmailInput) {
  if (!process.env.SMTP_HOST) {
    console.log(`\n[email:dev] To: ${to}\n[email:dev] Subject: ${subject}\n[email:dev] ${text}\n`);
    return;
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transport.sendMail({
    from: process.env.EMAIL_FROM ?? "HYS Services <no-reply@example.com>",
    to,
    subject,
    text,
  });
}
