/**
 * Onboarding Invitation Email Service
 * Handles sending and tracking onboarding invitation emails
 */

import { Resend } from 'resend';
import { prisma } from './database';

// Lazy initialization to avoid build-time errors
let resend: Resend | null = null;

function getResendClient() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

interface OnboardingInvitationData {
  invitationId: string;
  email: string;
  modelName?: string;
  invitationUrl: string;
  expiresAt?: Date | null;
  notes?: string;
  inviterName?: string;
}

/**
 * Send onboarding invitation email to model/client
 */
export async function sendOnboardingInvitationEmail(
  data: OnboardingInvitationData
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'Email service not configured' };
  }

  // Log API key status (first/last 4 chars for security)
  const apiKey = process.env.RESEND_API_KEY;
  console.log(`🔑 Using Resend API Key: ${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}`);

  if (!data.email) {
    console.warn('⚠️ No email address provided for invitation');
    return { success: false, error: 'No email address provided' };
  }

  try {
    const resendClient = getResendClient();
    if (!resendClient) {
      console.warn('⚠️ Resend client could not be initialized');
      return { success: false, error: 'Email service not initialized' };
    }

    const emailHtml = generateOnboardingInvitationEmail(data);
    const emailText = generateOnboardingInvitationText(data);

    console.log('📧 Attempting to send email via Resend...');
    
    // Use custom domain for production, test domain for development
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Tastyy AI <onboarding@resend.dev>';
    console.log(`📮 From: ${fromEmail}`);
    console.log(`📬 To: ${data.email}`);
    
    // In test mode, Resend only allows sending to your verified email
    // For production, verify a domain and update the 'from' address
    const result = await resendClient.emails.send({
      from: fromEmail,
      to: data.email,
      subject: `✨ You're Invited to Start Your Creative Journey`,
      html: emailHtml,
      text: emailText,
      // Add reply-to for better deliverability
      replyTo: 'support@tastycreative.com',
    });

    // Log the full response for debugging
    console.log('📬 Resend API Response:', JSON.stringify(result, null, 2));

    // Check if there's an error in the response
    if (result.error) {
      console.error('❌ Resend API Error:', result.error);
      
      // Check for test domain limitation error
      if (result.error.message?.includes('testing emails') || result.error.message?.includes('verify a domain')) {
        const errorMsg = '⚠️ RESEND TEST MODE LIMITATION: You can only send to your verified email (tasty4459@gmail.com). To send to other recipients, verify a custom domain at resend.com/domains';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      
      throw new Error(result.error.message || 'Resend API returned an error');
    }

    const emailId = result.data?.id;
    if (!emailId) {
      console.warn('⚠️ No email ID returned from Resend. Response:', result);
    }

    // Update database with email sent status
    await prisma.onboardingInvitation.update({
      where: { id: data.invitationId },
      data: {
        emailSent: true,
        emailSentAt: new Date(),
        lastEmailSentAt: new Date(),
        emailError: null,
        resendEmailId: emailId || undefined,
      },
    });

    console.log(`✅ Onboarding invitation email sent to ${data.email} (ID: ${emailId || 'N/A'})`);
    return { success: true, emailId: emailId || undefined };
  } catch (error) {
    console.error('❌ Failed to send onboarding invitation email:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to send email';
    
    // Update database with error
    await prisma.onboardingInvitation.update({
      where: { id: data.invitationId },
      data: {
        emailError: errorMessage,
      },
    });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Generate HTML email template for onboarding invitation
 */
function generateOnboardingInvitationEmail(data: OnboardingInvitationData): string {
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const expiresText = data.expiresAt
    ? new Date(data.expiresAt).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : 'N/A';

  const greeting = data.modelName ? `Hi ${data.modelName}` : 'Hi there';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Onboarding Invitation - Tasty Creative</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8f8f8;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #F8F8F8 0%, #FFE6F3 50%, #E6F5FF 100%); padding: 40px 20px;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.08);">
                
                <!-- Brand Header with Gradient -->
                <tr>
                  <td style="background: linear-gradient(135deg, #F774B9 0%, #EC67A1 50%, #5DC3F8 100%); padding: 48px 32px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700; text-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                      ✨ Welcome to Tastyy AI
                    </h1>
                    <p style="color: rgba(255,255,255,0.95); margin: 12px 0 0 0; font-size: 16px; font-weight: 500;">
                      Your creative journey starts here
                    </p>
                  </td>
                </tr>

                <!-- Content Section -->
                <tr>
                  <td style="padding: 48px 40px;">
                    <!-- Greeting -->
                    <p style="color: #1a1a1a; font-size: 18px; line-height: 1.6; margin: 0 0 24px 0; font-weight: 600;">
                      ${greeting},
                    </p>
                    
                    <!-- Main Message -->
                    <p style="color: #333333; font-size: 16px; line-height: 1.7; margin: 0 0 24px 0;">
                      You've been invited to join <strong style="color: #F774B9;">Tastyy AI</strong>, the premier AI-powered platform for content creators and models to manage their creative workflow.
                    </p>

                    ${data.notes ? `
                    <!-- Personal Note -->
                    <div style="background: linear-gradient(135deg, #FFF5FB 0%, #F0F9FF 100%); padding: 24px; border-radius: 12px; margin: 0 0 28px 0; border-left: 4px solid #F774B9;">
                      <p style="color: #555; font-size: 14px; margin: 0 0 8px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                        📝 Personal Note:
                      </p>
                      <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap;">
                        ${data.notes}
                      </p>
                    </div>
                    ` : ''}

                    <!-- What's Next -->
                    <div style="background: #F8F8F8; padding: 24px; border-radius: 12px; margin: 0 0 32px 0;">
                      <h3 style="color: #1a1a1a; font-size: 16px; margin: 0 0 16px 0; font-weight: 700;">
                        🎯 What's Next?
                      </h3>
                      <ol style="margin: 0; padding-left: 24px; color: #555; font-size: 15px; line-height: 1.8;">
                        <li>Click the button below to access your onboarding portal</li>
                        <li>Complete your profile setup</li>
                        <li>Upload your reference materials</li>
                        <li>Start creating amazing content!</li>
                      </ol>
                    </div>

                    <!-- CTA Button with Brand Gradient -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding: 0 0 28px 0;">
                          <a href="${data.invitationUrl}" style="display: inline-block; background: linear-gradient(135deg, #F774B9 0%, #EC67A1 50%, #5DC3F8 100%); color: #ffffff; text-decoration: none; padding: 18px 48px; border-radius: 12px; font-size: 17px; font-weight: 700; box-shadow: 0 6px 20px rgba(247, 116, 185, 0.35); transition: all 0.3s ease;">
                            🚀 Start Your Onboarding
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Expiration Notice -->
                    ${data.expiresAt ? `
                    <div style="background: #FFF8E1; padding: 16px 20px; border-radius: 8px; border-left: 4px solid #FFC107; margin: 0 0 24px 0;">
                      <p style="color: #856404; font-size: 14px; line-height: 1.6; margin: 0;">
                        <strong>⏰ This invitation expires on ${expiresText}</strong><br>
                        Make sure to complete your onboarding before then!
                      </p>
                    </div>
                    ` : ''}

                    <!-- Alternative Link -->
                    <details style="margin: 24px 0 0 0;">
                      <summary style="color: #999999; font-size: 13px; cursor: pointer; margin-bottom: 8px;">
                        Button not working? Click here for the direct link
                      </summary>
                      <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 8px 0 0 0;">
                        Copy and paste this link into your browser:
                        <br>
                        <a href="${data.invitationUrl}" style="color: #F774B9; word-break: break-all; text-decoration: underline;">${data.invitationUrl}</a>
                      </p>
                    </details>
                  </td>
                </tr>

                <!-- Footer with Brand Colors -->
                <tr>
                  <td style="background: linear-gradient(135deg, #F8F8F8 0%, #FFF5FB 100%); padding: 32px 40px; border-top: 1px solid #f0f0f0;">
                    <!-- Brand Icons/Features -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                      <tr>
                        <td align="center" style="padding: 0 12px;">
                          <div style="font-size: 24px; margin-bottom: 8px;">🎨</div>
                          <p style="color: #666; font-size: 12px; margin: 0; font-weight: 600;">Create</p>
                        </td>
                        <td align="center" style="padding: 0 12px;">
                          <div style="font-size: 24px; margin-bottom: 8px;">📸</div>
                          <p style="color: #666; font-size: 12px; margin: 0; font-weight: 600;">Manage</p>
                        </td>
                        <td align="center" style="padding: 0 12px;">
                          <div style="font-size: 24px; margin-bottom: 8px;">🚀</div>
                          <p style="color: #666; font-size: 12px; margin: 0; font-weight: 600;">Grow</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Copyright & Links -->
                    <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 0 0 12px 0; text-align: center;">
                      © ${new Date().getFullYear()} <strong style="color: #F774B9;">Tastyy AI</strong>. All rights reserved.
                    </p>
                    <p style="color: #bbbbbb; font-size: 11px; line-height: 1.6; margin: 0; text-align: center;">
                      This is an automated invitation. If you didn't expect this email, please ignore it.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Trust Footer -->
              <table border="0" cellpadding="0" cellspacing="0" width="600" style="margin-top: 24px;">
                <tr>
                  <td align="center">
                    <p style="color: rgba(0,0,0,0.4); font-size: 11px; line-height: 1.6; margin: 0;">
                      Secure invitation powered by Tastyy AI
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
}

/**
 * Generate plain text version of onboarding invitation email
 */
function generateOnboardingInvitationText(data: OnboardingInvitationData): string {
  const greeting = data.modelName ? `Hi ${data.modelName}` : 'Hi there';
  const expiresText = data.expiresAt
    ? `This invitation expires on ${new Date(data.expiresAt).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })}`
    : '';

  return `
${greeting},

You've been invited to join Tastyy AI, the premier AI-powered platform for content creators and models to manage their creative workflow.

${data.notes ? `Personal Note:\n${data.notes}\n\n` : ''}

What's Next?
1. Click the link below to access your onboarding portal
2. Complete your profile setup
3. Upload your reference materials
4. Start creating amazing content!

Start Your Onboarding:
${data.invitationUrl}

${expiresText ? `⏰ ${expiresText}. Make sure to complete your onboarding before then!\n\n` : ''}

© ${new Date().getFullYear()} Tastyy AI. All rights reserved.

If you didn't expect this invitation, please ignore this email.
  `.trim();
}

/**
 * Resend an existing onboarding invitation email
 */
export async function resendOnboardingInvitationEmail(
  invitationId: string
): Promise<{ success: boolean; error?: string; emailId?: string }> {
  try {
    // Fetch invitation
    const invitation = await prisma.onboardingInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    if (!invitation.email) {
      return { success: false, error: 'No email address associated with this invitation' };
    }

    // Generate URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const invitationUrl = `${baseUrl}/onboarding/public?token=${invitation.token}`;

    // Increment resend count
    await prisma.onboardingInvitation.update({
      where: { id: invitationId },
      data: {
        emailResendCount: {
          increment: 1,
        },
      },
    });

    // Send email
    return await sendOnboardingInvitationEmail({
      invitationId: invitation.id,
      email: invitation.email,
      modelName: invitation.modelName || undefined,
      invitationUrl,
      expiresAt: invitation.expiresAt,
      notes: invitation.notes || undefined,
    });
  } catch (error) {
    console.error('❌ Failed to resend onboarding invitation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resend email',
    };
  }
}
