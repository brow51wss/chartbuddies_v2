const LOGO_URL = 'https://app.lasso-app.com/images/full-wordmark.webp'
const NAVY = '#142F61'
const TEAL = '#00799E'

export interface EmailTemplateOptions {
  /** Short preview text shown in email client before opening (optional) */
  preheader?: string
  /** Main heading inside the email */
  heading: string
  /** Array of paragraph strings (plain text or simple HTML) */
  paragraphs: string[]
  /** Primary CTA button label */
  buttonText: string
  /** Primary CTA button URL */
  buttonUrl: string
  /** Small note below the button, e.g. "If you didn't request this, ignore this email." */
  footerNote?: string
}

/**
 * Returns a branded HTML email string ready to pass to sendEmail().
 * Uses table-based layout for broad email-client compatibility.
 */
export function buildEmailHtml(opts: EmailTemplateOptions): string {
  const { preheader = '', heading, paragraphs, buttonText, buttonUrl, footerNote } = opts

  const paragraphHtml = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">${p}</p>`
    )
    .join('\n')

  const footerNoteHtml = footerNote
    ? `<p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#9CA3AF;">${footerNote}</p>`
    : ''

  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">

  <!--[if !gte mso 9]><!-->
  <!-- Preheader: hidden preview text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader || heading}</div>
  <!--<![endif]-->

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#F3F4F6;padding:40px 16px;">
    <tr>
      <td align="center" valign="top">

        <!-- Email card — max 560px -->
        <table width="560" cellpadding="0" cellspacing="0" border="0"
               style="max-width:560px;width:100%;">

          <!-- ── Header ── -->
          <tr>
            <td align="center" valign="middle"
                style="background-color:${NAVY};padding:24px 32px;
                       border-radius:12px 12px 0 0;">
              <img src="${LOGO_URL}" alt="Lasso" width="150" height="auto"
                   style="display:block;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="background-color:#FFFFFF;padding:40px 36px 36px;
                       border-radius:0 0 12px 12px;">

              <!-- Heading -->
              <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;
                         color:${NAVY};line-height:1.3;">
                ${heading}
              </h1>

              <!-- Paragraphs -->
              ${paragraphHtml}

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
                <tr>
                  <td style="border-radius:8px;background-color:${TEAL};">
                    <a href="${buttonUrl}"
                       style="display:inline-block;padding:14px 32px;
                              font-size:15px;font-weight:600;color:#FFFFFF;
                              text-decoration:none;border-radius:8px;
                              background-color:${TEAL};">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Footer note -->
              ${footerNoteHtml}

            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td align="center" style="padding:28px 16px 8px;">
              <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">
                &copy; ${year} Lasso Health. All rights reserved.
              </p>
              <p style="margin:0;font-size:12px;color:#C4C4C4;">
                This is an automated message &mdash; please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Email card -->

      </td>
    </tr>
  </table>

</body>
</html>`
}
