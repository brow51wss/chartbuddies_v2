import Head from 'next/head'
import Link from 'next/link'

const LAST_UPDATED = 'June 5, 2026'
const COMPANY = 'JC Ventures LLC'
const DBA = 'Lasso'
const ADDRESS = '2949 Kalawao Street, Honolulu, Hawaii 96822'
const EMAIL = 'privacy@lasso-app.com'

export default function PrivacyPage() {
  return (
    <>
      <Head>
        <title>Privacy Policy — Lasso</title>
        <meta name="description" content="Lasso privacy policy — how we collect, use, and protect your information." />
      </Head>

      <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
          <Link href="/">
            <img src="/images/icon-wordmark.webp" alt="Lasso" className="h-9 w-auto cursor-pointer" />
          </Link>
          <Link href="/" className="text-sm text-lasso-teal hover:underline font-medium">← Back to Home</Link>
        </header>

        <main className="max-w-3xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-extrabold text-lasso-navy mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-400 mb-10">Last updated: {LAST_UPDATED}</p>

          <div className="space-y-10 text-gray-700 text-sm leading-relaxed">

            <section>
              <p>
                {COMPANY}, doing business as <strong>{DBA}</strong> ("Lasso," "we," "our," or "us"), operates the electronic
                health record platform available at <strong>lasso-app.com</strong>. This Privacy Policy explains how we
                collect, use, store, and protect information when you use our platform.
              </p>
              <p className="mt-3">
                By using Lasso, you agree to the collection and use of information in accordance with this policy. If you
                do not agree, please discontinue use of the platform.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">1. Information We Collect</h2>

              <h3 className="font-semibold text-gray-800 mb-1">Account and Staff Information</h3>
              <p className="mb-3">
                When you create an account or join a facility on Lasso, we collect: your full name, email address,
                password (hashed), role (superadmin, head nurse, or nurse), facility association, staff designation
                (e.g., RN, LPN, CNA), and digital signature and initials (stored as images in AWS S3).
              </p>

              <h3 className="font-semibold text-gray-800 mb-1">Protected Health Information (PHI)</h3>
              <p className="mb-3">
                Lasso is a HIPAA-covered platform. Facility administrators and authorized staff enter patient information
                including: patient name, date of birth, sex, medical record number, diagnosis, allergies, diet
                restrictions, physician name and phone number, facility name, medication administration records (MAR),
                PRN medication records, vital signs, and clinical progress notes.
              </p>
              <p className="mb-3">
                PHI is stored exclusively in encrypted AWS RDS PostgreSQL infrastructure and is never used for
                advertising, analytics, or any purpose beyond providing the care documentation service.
              </p>

              <h3 className="font-semibold text-gray-800 mb-1">Facility Information</h3>
              <p className="mb-3">
                When a facility is created on Lasso, we collect the facility name, type, and contact information
                provided by the facility administrator.
              </p>

              <h3 className="font-semibold text-gray-800 mb-1">Early Access Leads</h3>
              <p>
                If you register for early access through our event or marketing pages, we collect your full name,
                email address, phone number, and optional facility name. This information is used solely to contact
                you about accessing the platform.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">2. How We Use Information</h2>
              <ul className="list-disc list-inside space-y-2">
                <li>To provide, operate, and maintain the Lasso EHR platform</li>
                <li>To authenticate users and enforce role-based access control</li>
                <li>To enable care teams to document and retrieve patient health records</li>
                <li>To send transactional emails (account verification, password resets, invitations)</li>
                <li>To maintain audit logs for compliance and legal purposes</li>
                <li>To contact early access registrants about platform onboarding</li>
                <li>To improve and develop platform features based on usage patterns (non-PHI, aggregated only)</li>
              </ul>
              <p className="mt-3">We do not sell, rent, or share your personal information or PHI with third parties for marketing purposes.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">3. HIPAA Compliance</h2>
              <p className="mb-3">
                Lasso is designed to be HIPAA-compliant. We operate as a Business Associate under HIPAA and will enter
                into a Business Associate Agreement (BAA) with covered entities using our platform. All PHI is:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li>Stored in encrypted AWS RDS PostgreSQL (encryption at rest)</li>
                <li>Transmitted exclusively over HTTPS/TLS (encryption in transit)</li>
                <li>Accessible only by authenticated, role-authorized users within your facility</li>
                <li>Subject to audit logging for access and modification events</li>
                <li>Never transferred outside of the AWS infrastructure without authorization</li>
              </ul>
              <p className="mt-3">
                To request a BAA, contact us at <a href={`mailto:${EMAIL}`} className="text-lasso-teal hover:underline">{EMAIL}</a>.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">4. Data Storage and Security</h2>
              <p className="mb-3">We use the following infrastructure to store and secure data:</p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>AWS RDS PostgreSQL</strong> — all PHI (patient records, MAR, progress notes, vitals)</li>
                <li><strong>Supabase</strong> — user accounts, staff profiles, facility data, authentication tokens</li>
                <li><strong>AWS S3</strong> — digital signatures and patient photos, stored as encrypted objects</li>
                <li><strong>AWS Amplify</strong> — EHR application hosting</li>
                <li><strong>Vercel</strong> — marketing website hosting</li>
              </ul>
              <p className="mt-3">
                We implement role-based access control (RBAC) so that each user can only access data within their
                authorized facility and role. All API routes require authentication and are validated server-side.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">5. Third-Party Services</h2>
              <p className="mb-3">We use the following third-party services to operate the platform:</p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Supabase</strong> — user authentication and non-PHI database</li>
                <li><strong>Amazon Web Services (AWS)</strong> — RDS, S3, SES, Amplify</li>
                <li><strong>Resend</strong> — transactional email delivery</li>
                <li><strong>Vercel</strong> — marketing website infrastructure</li>
              </ul>
              <p className="mt-3">
                Each third-party service is evaluated for HIPAA compatibility where applicable. PHI is not transmitted
                to any service that has not been assessed for compliance.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">6. Cookies and Local Storage</h2>
              <p className="mb-3">
                Lasso uses browser <strong>localStorage</strong> (not tracking cookies) to maintain your authenticated
                session and save UI preferences. Specifically:
              </p>
              <ul className="list-disc list-inside space-y-2">
                <li><strong>Authentication session</strong> — managed by Supabase SDK (<code>sb-*-auth-token</code>); required for platform access</li>
                <li><strong>UI preferences</strong> — patient list view mode (<code>lasso-patients-view</code>), read-only mode state</li>
                <li><strong>Cookie consent</strong> — records your acknowledgment of this policy (<code>lasso-cookie-consent</code>)</li>
              </ul>
              <p className="mt-3">
                We do not use advertising, analytics, or tracking cookies. Essential storage items cannot be disabled
                without breaking core platform functionality.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">7. Data Retention</h2>
              <p className="mb-3">
                PHI and clinical records are retained for as long as required by applicable law and your facility's
                retention obligations. Under HIPAA, medical records are generally required to be retained for a minimum
                of 6 years from the date of creation or last effective date.
              </p>
              <p>
                User accounts (staff profiles) are deactivated rather than deleted to preserve audit trails and
                historical record integrity. If you require account deletion, contact us and we will assess the request
                in light of legal retention requirements.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">8. Your Rights</h2>
              <p className="mb-3">Depending on your jurisdiction, you may have the right to:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate personal information</li>
                <li>Request deactivation of your staff account</li>
                <li>Receive a copy of your data in a portable format</li>
              </ul>
              <p className="mt-3">
                For PHI requests relating to patient records, please follow your facility's HIPAA-compliant access
                request procedures. Patients should contact the facility administrator directly.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">9. Children's Privacy</h2>
              <p>
                Lasso is a professional healthcare platform intended for use by licensed healthcare providers and
                authorized care home staff. It is not directed at individuals under the age of 18. We do not knowingly
                collect personal information from minors for platform accounts.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">10. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify users of material changes by
                updating the "Last updated" date at the top of this page. Continued use of the platform after changes
                constitutes acceptance of the revised policy.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">11. Contact Us</h2>
              <p>If you have questions about this Privacy Policy or our data practices, contact us at:</p>
              <div className="mt-3 p-4 bg-white rounded-xl border border-gray-200 text-sm">
                <p className="font-semibold text-lasso-navy">{COMPANY} (dba {DBA})</p>
                <p className="text-gray-600 mt-1">{ADDRESS}</p>
                <p className="mt-1">
                  <a href={`mailto:${EMAIL}`} className="text-lasso-teal hover:underline">{EMAIL}</a>
                </p>
              </div>
            </section>

          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 bg-white py-6 mt-10">
          <div className="max-w-3xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-400">
            <span>© {new Date().getFullYear()} {COMPANY}. All rights reserved.</span>
            <div className="flex gap-4">
              <Link href="/privacy" className="hover:text-lasso-teal">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-lasso-teal">Terms of Service</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
