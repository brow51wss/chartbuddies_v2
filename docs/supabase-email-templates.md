# Supabase Auth Email Templates

Paste each HTML block below into the corresponding template in:
**Supabase Dashboard → Authentication → Email Templates**

All templates use the same branded wrapper. The only things that change are the heading, body copy, and button.

---

## 1. Confirm Signup

**Subject:** `Confirm your Lasso account`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Confirm your Lasso account</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">Confirm your email address to activate your Lasso account.</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4F6;padding:40px 16px;">
    <tr><td align="center" valign="top">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr>
          <td align="center" valign="middle" style="background-color:#142F61;padding:24px 32px;border-radius:12px 12px 0 0;">
            <img src="https://app.lasso-app.com/images/full-wordmark.webp" alt="Lasso" width="150" height="auto" style="display:block;border:0;" />
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;padding:40px 36px 36px;border-radius:0 0 12px 12px;">
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#142F61;line-height:1.3;">Confirm your account</h1>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">Thanks for signing up for Lasso. Click the button below to verify your email address and activate your account.</p>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">This link expires in 24 hours and can only be used once.</p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
              <tr>
                <td style="border-radius:8px;background-color:#00799E;">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;background-color:#00799E;">
                    Confirm your account
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#9CA3AF;">If you didn't create a Lasso account, you can safely ignore this email.</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:28px 16px 8px;">
            <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">&copy; 2025 Lasso Health. All rights reserved.</p>
            <p style="margin:0;font-size:12px;color:#C4C4C4;">This is an automated message &mdash; please do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

---

## 2. Reset Password

**Subject:** `Reset your Lasso password`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Reset your Lasso password</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">Reset your Lasso password using the link below.</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4F6;padding:40px 16px;">
    <tr><td align="center" valign="top">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr>
          <td align="center" valign="middle" style="background-color:#142F61;padding:24px 32px;border-radius:12px 12px 0 0;">
            <img src="https://app.lasso-app.com/images/full-wordmark.webp" alt="Lasso" width="150" height="auto" style="display:block;border:0;" />
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;padding:40px 36px 36px;border-radius:0 0 12px 12px;">
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#142F61;line-height:1.3;">Reset your password</h1>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">We received a request to reset the password for your Lasso account.</p>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">Click the button below to choose a new password. This link expires in 1 hour.</p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
              <tr>
                <td style="border-radius:8px;background-color:#00799E;">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;background-color:#00799E;">
                    Reset password
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#9CA3AF;">If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:28px 16px 8px;">
            <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">&copy; 2025 Lasso Health. All rights reserved.</p>
            <p style="margin:0;font-size:12px;color:#C4C4C4;">This is an automated message &mdash; please do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

---

## 3. Magic Link (if enabled)

**Subject:** `Your Lasso sign-in link`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>Your Lasso sign-in link</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">Use this link to sign in to your Lasso account.</div>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F3F4F6;padding:40px 16px;">
    <tr><td align="center" valign="top">
      <table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
        <tr>
          <td align="center" valign="middle" style="background-color:#142F61;padding:24px 32px;border-radius:12px 12px 0 0;">
            <img src="https://app.lasso-app.com/images/full-wordmark.webp" alt="Lasso" width="150" height="auto" style="display:block;border:0;" />
          </td>
        </tr>
        <tr>
          <td style="background-color:#FFFFFF;padding:40px 36px 36px;border-radius:0 0 12px 12px;">
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#142F61;line-height:1.3;">Your sign-in link</h1>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">Click the button below to sign in to your Lasso account. This link expires in 1 hour and can only be used once.</p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
              <tr>
                <td style="border-radius:8px;background-color:#00799E;">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;background-color:#00799E;">
                    Sign in to Lasso
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#9CA3AF;">If you didn't request this link, you can safely ignore this email.</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:28px 16px 8px;">
            <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">&copy; 2025 Lasso Health. All rights reserved.</p>
            <p style="margin:0;font-size:12px;color:#C4C4C4;">This is an automated message &mdash; please do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
```

---

## How to apply in Supabase

1. Go to **Supabase Dashboard → Authentication → Email Templates**
2. Select the template type (Confirm signup, Reset password, etc.)
3. Change the **Subject** to the subject shown above
4. Paste the **HTML** into the body editor
5. Click **Save**

No redeploy needed — changes take effect immediately.
