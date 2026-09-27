import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.ETHEREAL_HOST,
  port: Number(process.env.ETHEREAL_PORT || 587),
  secure: false,
  auth: {
    user: process.env.ETHEREAL_USER,
    pass: process.env.ETHEREAL_PASSWORD,
  },
});

export async function sendEmail(
  to: string,
  subject: string,
  body: string
) {
  const info = await transporter.sendMail({
    from: `"ReachInbox Scheduler" <${process.env.ETHEREAL_USER}>`,
    to,
    subject,
    text: body,
  });

  console.log("Email sent:", info.messageId);

  const previewUrl = nodemailer.getTestMessageUrl(info);

  if (previewUrl) {
    console.log("Ethereal preview:", previewUrl);
  }

  return {
    messageId: info.messageId,
    previewUrl,
  };
}