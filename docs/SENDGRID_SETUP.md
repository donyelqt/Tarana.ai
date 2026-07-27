# SendGrid Setup Guide for Tarana.ai

This guide will help you set up SendGrid for sending password reset emails in your Tarana.ai application.

## Prerequisites

- A SendGrid account (free tier available)
- Access to your domain's DNS settings (for production)
- Your Tarana.ai application environment

## Step-by-Step Implementation

### Step 1: Create SendGrid Account

1. **Go to SendGrid**: Open [sendgrid.com](https://sendgrid.com)
2. **Sign Up**: Click "Start for Free"
3. **Choose Plan**: Select "Free" (100 emails/day)
4. **Fill Details**:
   - Email: Your email address
   - Password: Strong password
   - Company: Tarana.ai
   - Role: Developer
5. **Verify Email**: Check inbox and click verification link

### Step 2: Create API Key

1. **Login to SendGrid Dashboard**
2. **Navigate**: Settings → API Keys
3. **Create Key**: Click "Create API Key"
4. **Configuration**:
   - **Name**: `Tarana.ai-Password-Reset`
   - **Type**: Select "Restricted Access"
   - **Permissions**: 
     - Mail Send: **Full Access** 
     - All others: No Access
5. **Generate**: Click "Create & View"
6. **CRITICAL**: Copy the API key immediately (starts with `SG.`)
   - You'll never see it again!
   - Store it safely

### Step 3: Set Up Sender Authentication

1. **Navigate**: Settings → Sender Authentication → Single Sender Verification
2. **Create Sender**: Click "Create New Sender"
3. **Fill Form**:
   ```
   From Name: Tarana.ai
   From Email: noreply@yourdomain.com (or your email)
   Reply To: support@yourdomain.com (or your email)
   Company: Tarana.ai
   Address: Your address
   City/State/Zip: Your location
   Country: Your country
   ```
4. **Create**: Click "Create"
5. **Verify**: Check your email and click verification link

### Step 4: Configure Your .env File

1. **Copy from template**: Copy your `env.example` to `.env`
2. **Update with your SendGrid credentials**:

```env
# SendGrid Configuration (Production Ready)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.your_actual_api_key_from_step_2

# SendGrid Sender Configuration
SMTP_FROM_NAME=Tarana.ai
SMTP_FROM_EMAIL=your_verified_email_from_step_3
```

**Replace**:
- `SG.your_actual_api_key_from_step_2` → Your actual SendGrid API key
- `your_verified_email_from_step_3` → The email you verified in sender authentication

### Step 5: Test Email Delivery

1. **Start your application**:
   ```bash
   npm run dev
   ```

2. **Test the forgot password flow**:
   - Go to `http://localhost:3000/auth/forgot-password`
   - Enter your email address (use the same email you verified in SendGrid)
   - Click "Send Reset Link"

3. **Check email delivery**:
   - Check your inbox for the password reset email
   - Look for email from "Tarana.ai"
   - Click the reset password button/link

4. **Monitor SendGrid Activity**:
   - Go to SendGrid Dashboard → Activity Feed
   - You should see the email delivery status
   - Green = Delivered, Red = Failed

### Step 6: Security Verification & Production Readiness

#### Security Checklist 
- **API Key Security**: Restricted permissions (Mail Send only)
- **Environment Variables**: Credentials stored in `.env` (not committed)
- **Sender Verification**: Email address verified in SendGrid
- **Token Security**: 1-hour expiry, crypto.randomBytes generation
- **Anti-enumeration**: Always returns success message
- **Password Validation**: Strong requirements enforced

#### Troubleshooting

**If emails don't arrive**:
1. **Check SendGrid Activity Feed** - Shows delivery status
2. **Verify sender email** - Must match verified address in SendGrid
3. **Check spam folder** - New senders often go to spam initially
4. **API key permissions** - Ensure "Mail Send: Full Access"

**Common Issues**:
- **"Forbidden"** → Wrong API key or insufficient permissions
- **"The from address does not match a verified Sender Identity"** → Complete sender verification
- **"Rate limit exceeded"** → Free tier limit reached (100/day)

#### Production Considerations

**For Production Deployment**:
1. **Domain Authentication** - Set up custom domain in SendGrid
2. **Separate API Keys** - Different keys for dev/staging/production
3. **Monitoring** - Set up SendGrid alerts for delivery issues
4. **Suppression Lists** - Handle bounces and unsubscribes

## 🎉 Implementation Complete

Your Tarana.ai authentication system now has:
- ✅ **Secure password reset** with email delivery
- ✅ **Remember me** functionality 
- ✅ **Production-ready** SendGrid integration
- ✅ **Enterprise security** standards
- ✅ **Professional email templates**

Once you complete the SendGrid setup steps above, users will receive secure password reset emails with proper branding and security measures.

## SendGrid Best Practices

### Security
- **Never commit API keys** to version control
- **Use Restricted Access** API keys with minimal permissions
- **Rotate API keys** regularly in production
- **Use different keys** for development and production

### Deliverability
- **Verify your domain** for better deliverability
- **Use consistent sender identity**
- **Monitor bounce rates** in SendGrid dashboard
- **Set up suppression lists** for unsubscribes

### Monitoring
- **Activity Feed**: Monitor email delivery status
- **Statistics**: Track open rates, click rates, bounces
- **Alerts**: Set up notifications for delivery issues

## Additional Configuration Options

### Option B: Domain Authentication (Production)
1. Go to Settings → Sender Authentication → Domain Authentication
2. Add your domain
3. Follow DNS setup instructions
4. Wait for verification (can take up to 48 hours)

## Production Checklist
- [ ] Domain authentication completed
- [ ] Production API key created with restricted permissions
- [ ] Sender identity verified
- [ ] Email templates tested
- [ ] Monitoring and alerts configured
- [ ] Suppression lists configured
- [ ] DKIM and SPF records added to DNS
