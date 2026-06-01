import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

export interface SendEmailParams {
  to: string
  from: string
  subject: string
  html: string
}

async function sendViaResend({ to, from, subject, html }: SendEmailParams): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error ${res.status}: ${body}`)
  }
}

async function sendViaSES({ to, from, subject, html }: SendEmailParams): Promise<void> {
  const sesClient = new SESClient({
    region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
  })
  const command = new SendEmailCommand({
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: { Html: { Data: html, Charset: 'UTF-8' } },
    },
    Source: from,
  })
  await sesClient.send(command)
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(params)
  }
  return sendViaSES(params)
}
