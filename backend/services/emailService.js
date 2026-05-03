const nodemailer = require('nodemailer');

// Configure Nodemailer transporter using Gmail (or any other SMTP provider)
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can change this to 'outlook', 'yahoo', etc.
  auth: {
    user: process.env.EMAIL_USER, // Your full Gmail address
    pass: process.env.EMAIL_PASS  // Your Gmail App Password
  }
});

const FROM_EMAIL = process.env.EMAIL_USER;

const sendWelcomeEmail = async (email, firstName) => {
  try {
    const mailOptions = {
      from: `"CryptoAI Trading" <${FROM_EMAIL}>`,
      to: email,
      subject: 'Welcome to CryptoAI Trading!',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333;">
          <h2>Welcome, ${firstName}! 👋</h2>
          <p>We're thrilled to have you on board. CryptoAI Trading is designed to give you an edge with our autonomous trading agents and real-time market analysis.</p>
          <p>To get started, we recommend exploring the dashboard and checking out our Pro Plans to unleash the full power of our AI.</p>
          <br/>
          <p>Happy Trading,</p>
          <p><strong>The CryptoAI Team</strong></p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${email}`, info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    // Don't throw the error so it doesn't crash the server if email fails
  }
};

const sendVerificationEmail = async (email, firstName, token) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const verifyLink = `${frontendUrl}/verify-email?token=${token}`;

    const mailOptions = {
      from: `"CryptoAI Trading" <${FROM_EMAIL}>`,
      to: email,
      subject: 'Verify your email address - CryptoAI Trading',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333;">
          <h2>Verify Your Email</h2>
          <p>Hi ${firstName},</p>
          <p>Thanks for registering with CryptoAI Trading! Please confirm your email address by clicking the link below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Verify Email Address</a>
          </div>
          <p>If you did not create an account, no further action is required.</p>
          <br/>
          <p>Best regards,</p>
          <p><strong>The CryptoAI Team</strong></p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${email}`, info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending verification email:', error);
  }
};

const sendPasswordResetEmail = async (email, firstName, token) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    const mailOptions = {
      from: `"CryptoAI Trading" <${FROM_EMAIL}>`,
      to: email,
      subject: 'Reset your password - CryptoAI Trading',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #333;">
          <h2>Password Reset Request</h2>
          <p>Hi ${firstName},</p>
          <p>We received a request to reset your password for your CryptoAI Trading account. Click the button below to choose a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #EF4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p>This link will expire in 1 hour.</p>
          <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
          <br/>
          <p>Best regards,</p>
          <p><strong>The CryptoAI Team</strong></p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${email}`, info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending password reset email:', error);
  }
};

module.exports = {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPasswordResetEmail
};