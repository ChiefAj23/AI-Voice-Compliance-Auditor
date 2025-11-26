# 📧 Email Setup Guide

## Gmail SMTP Configuration

Gmail requires **App Passwords** for third-party applications. Regular passwords will not work.

### Step 1: Enable 2-Step Verification

1. Go to your [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** if not already enabled
3. Follow the setup process

### Step 2: Create an App Password

1. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
   - Or: Google Account → Security → 2-Step Verification → App passwords
2. Select **Mail** as the app
3. Select **Other (Custom name)** as the device
4. Enter a name like "Voice Audit App"
5. Click **Generate**
6. **Copy the 16-character password** (shown only once)

### Step 3: Set Environment Variables

```bash
export SMTP_HOST="smtp.gmail.com"
export SMTP_PORT="587"
export SMTP_USER="your-email@gmail.com"
export SMTP_PASSWORD="your-16-char-app-password"  # Use the App Password, not your regular password
```

Or create a `.env` file in your project root:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
```

### Step 4: Test Email Configuration

Test your email configuration using the notification test feature in the UI.

---

## Other Email Providers

### Outlook/Hotmail

```bash
export SMTP_HOST="smtp-mail.outlook.com"
export SMTP_PORT="587"
export SMTP_USER="your-email@outlook.com"
export SMTP_PASSWORD="your-password"
```

### SendGrid

```bash
export SMTP_HOST="smtp.sendgrid.net"
export SMTP_PORT="587"
export SMTP_USER="apikey"
export SMTP_PASSWORD="your-sendgrid-api-key"
```

### Custom SMTP Server

```bash
export SMTP_HOST="smtp.yourdomain.com"
export SMTP_PORT="587"  # or 465 for SSL
export SMTP_USER="your-username"
export SMTP_PASSWORD="your-password"
```

---

## Troubleshooting

### Error: "Username and Password not accepted"

**Gmail**: You must use an App Password, not your regular password.
- Enable 2-Step Verification
- Create an App Password
- Use the App Password in `SMTP_PASSWORD`

### Error: "Connection timeout"

- Check your firewall settings
- Verify SMTP host and port are correct
- Try port 465 with SSL if 587 doesn't work

### Error: "SMTP credentials not configured"

- Make sure environment variables are set
- Restart the FastAPI server after setting variables
- Verify variable names are correct (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD)

---

## Security Best Practices

1. **Never commit passwords to git**
   - Use `.env` file (add to `.gitignore`)
   - Use environment variables
   - Use secrets management (AWS Secrets Manager, etc.)

2. **Use App Passwords for Gmail**
   - More secure than regular passwords
   - Can be revoked individually
   - Don't expose your main account password

3. **Rotate passwords regularly**
   - Update App Passwords periodically
   - Revoke unused App Passwords

---

## Quick Test

After setting up, you can test the email configuration:

1. Go to **Notifications** page
2. Create a notification configuration
3. Click **Test** button
4. Check if email is received

Or use the Python test script:

```python
import os
import smtplib
from email.mime.text import MIMEText

smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
smtp_port = int(os.getenv("SMTP_PORT", "587"))
smtp_user = os.getenv("SMTP_USER", "")
smtp_password = os.getenv("SMTP_PASSWORD", "")

try:
    server = smtplib.SMTP(smtp_host, smtp_port)
    server.starttls()
    server.login(smtp_user, smtp_password)
    print("✅ SMTP connection successful!")
    server.quit()
except Exception as e:
    print(f"❌ SMTP connection failed: {e}")
```

