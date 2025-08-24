# Email Configuration Setup Guide

## Gmail Setup (Recommended for Development)

### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account settings
2. Security → 2-Step Verification → Turn on

### Step 2: Generate App Password
1. Go to Google Account → Security → App passwords
2. Select app: "Mail"
3. Select device: "Other (custom name)" → Enter "Tarana.ai"
4. Copy the 16-character app password

### Step 3: Configure Environment Variables
Copy your `.env.example` to `.env` and update:

```env
# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_gmail@gmail.com
SMTP_PASS=your_16_character_app_password
```

## Alternative SMTP Providers

### SendGrid (Production Recommended)
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
```

### Outlook/Hotmail
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@outlook.com
SMTP_PASS=your_password
```

## Security Best Practices

1. **Never commit .env files** - Already in .gitignore
2. **Use App Passwords** - Never use your actual Gmail password
3. **Environment-specific configs** - Different SMTP for dev/prod
4. **TLS Security** - Configured automatically based on NODE_ENV

## Testing Email Configuration

The system will automatically:
- Log reset URLs to console if SMTP not configured
- Handle email sending failures gracefully
- Prevent email enumeration attacks

## Troubleshooting

### Common Issues:
1. **"Invalid login"** - Use App Password, not regular password
2. **"Connection timeout"** - Check firewall/network settings
3. **"Authentication failed"** - Verify SMTP credentials

### Debug Mode:
Set `NODE_ENV=development` to see detailed email logs without TLS restrictions.
