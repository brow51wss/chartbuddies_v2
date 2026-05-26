import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

// On AWS Amplify the IAM role provides credentials automatically.
// For local development, set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY in .env.local
// or configure the AWS CLI profile.
const sesClient = new SESClient({
  region: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'us-east-1',
})

export interface SendEmailParams {
  to: string
  from: string
  subject: string
  html: string
}

export async function sendEmail({ to, from, subject, html }: SendEmailParams): Promise<void> {
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
