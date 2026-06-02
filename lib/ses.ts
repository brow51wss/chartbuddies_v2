import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import getConfig from 'next/config'

export interface SendEmailParams {
  to: string
  from: string
  subject: string
  html: string
}

function getRuntimeConfig() {
  try {
    const { serverRuntimeConfig } = getConfig() || {}
    return {
      resendApiKey: serverRuntimeConfig?.RESEND_API_KEY || process.env.RESEND_API_KEY || '',
      resendFromEmail: serverRuntimeConfig?.RESEND_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || '',
      sesFromEmail: serverRuntimeConfig?.SES_FROM_EMAIL || process.env.SES_FROM_EMAIL || '',
    }
  } catch {
    return {
      resendApiKey: process.env.RESEND_API_KEY || '',
      resendFromEmail: process.env.RESEND_FROM_EMAIL || '',
      sesFromEmail: process.env.SES_FROM_EMAIL || '',
    }
  }
}

export function getFromEmail(): string {
  const { resendFromEmail, sesFromEmail } = getRuntimeConfig()
  return resendFromEmail || sesFromEmail || 'noreply@example.com'
}

async function sendViaResend(apiKey: string, { to, from, subject, html }: SendEmailParams): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
  const { resendApiKey } = getRuntimeConfig()
  console.log('[ses.ts] resendApiKey present:', !!resendApiKey)
  if (resendApiKey) {
    return sendViaResend(resendApiKey, params)
  }
  return sendViaSES(params)
}
