import nodemailer from "nodemailer";

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const from = process.env.SMTP_FROM ?? "Bãi xe <noreply@localhost>";
  const transport = getTransport();
  if (!transport) {
    console.info("[email:dev]", options.to, options.subject, options.text);
    return { delivered: false as const };
  }
  await transport.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html ?? `<p>${options.text}</p>`,
  });
  return { delivered: true as const };
}
