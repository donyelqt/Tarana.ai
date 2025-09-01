import { getEmailTransportConfig, validateEmailConfig } from './emailConfig';

// Email service for password reset functionality
export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<boolean> {
  // Get validated email configuration
  const transportConfig = getEmailTransportConfig();
  const emailConfig = validateEmailConfig();
  
  if (!transportConfig || !emailConfig) {
    console.log('Password reset link (SMTP not configured):', resetUrl);
    return true; // Return true for development
  }

  try {
    // Dynamic import to avoid build issues if nodemailer isn't installed
    const nodemailer = await import('nodemailer');
    
    const transporter = nodemailer.default.createTransport(transportConfig);

    const mailOptions = {
      from: `"${emailConfig.fromName}" <${emailConfig.fromEmail}>`,
      to: email,
      subject: 'Reset Your Tarana.ai Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0066FF, #1E90FF); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Tarana.ai</h1>
            <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Your AI-powered Baguio travel companion</p>
          </div>
          
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333; margin-top: 0;">Reset Your Password</h2>
            <p>We received a request to reset your password for your Tarana.ai account.</p>
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: linear-gradient(135deg, #0066FF, #1E90FF); 
                        color: white; 
                        padding: 12px 30px; 
                        text-decoration: none; 
                        border-radius: 25px; 
                        font-weight: bold; 
                        display: inline-block;
                        box-shadow: 0 4px 15px rgba(0, 102, 255, 0.3);">
                Reset Password
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}" style="color: #0066FF; word-break: break-all;">${resetUrl}</a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            
            <p style="font-size: 14px; color: #666;">
              This link will expire in 1 hour for security reasons.<br>
              If you didn't request this password reset, please ignore this email.
            </p>
            
            <p style="font-size: 14px; color: #666; margin-top: 30px;">
              Best regards,<br>
              The Tarana.ai Team
            </p>
          </div>
        </body>
        </html>
      `,
      text: `Reset Your Tarana.ai Password
        
We received a request to reset your password for your Tarana.ai account.
        
Click this link to reset your password: ${resetUrl}
        
This link will expire in 1 hour for security reasons.
If you didn't request this password reset, please ignore this email.
        
Best regards,
The Tarana.ai Team`,
    };

    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully to:', email);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return true; // Return true to prevent revealing email existence
  }
}
