import nodemailer from 'nodemailer';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
  try {
    const info = await transporter.sendMail({
      from: `${process.env.EMAIL_FROM} <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
    });

    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}

interface InviteEmailParams {
  to: string;
  organizationName: string;
  inviterName: string;
  inviteUrl: string;
}

export async function sendOrganizationInvite({
  to,
  organizationName,
  inviterName,
  inviteUrl,
}: InviteEmailParams) {
  const subject = `You've been invited to join ${organizationName}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Organization Invite</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f4f4; padding: 20px;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">
                      Organization Invite
                    </h1>
                  </td>
                </tr>

                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      Hi there,
                    </p>
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                      <strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on Tasty Creative.
                    </p>
                    <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      Click the button below to accept the invitation and get started.
                    </p>

                    <!-- CTA Button -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center">
                          <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                            Accept Invitation
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
                      <strong>Note:</strong> This invitation link is unique and can only be used once. It will expire in 7 days.
                    </p>

                    <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 20px 0 0 0;">
                      If the button doesn't work, copy and paste this link into your browser:
                      <br>
                      <a href="${inviteUrl}" style="color: #667eea; word-break: break-all;">${inviteUrl}</a>
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
                    <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 0;">
                      © ${new Date().getFullYear()} Tasty Creative. All rights reserved.
                    </p>
                    <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 10px 0 0 0;">
                      If you didn't expect this invitation, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const text = `
You've been invited to join ${organizationName}

${inviterName} has invited you to join ${organizationName} on Tasty Creative.

Accept the invitation by visiting this link:
${inviteUrl}

Note: This invitation link is unique and can only be used once. It will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.

© ${new Date().getFullYear()} Tasty Creative. All rights reserved.
  `.trim();

  return sendEmail({ to, subject, html, text });
}
