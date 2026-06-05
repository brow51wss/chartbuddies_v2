import Head from 'next/head'
import Link from 'next/link'

const LAST_UPDATED = 'June 5, 2026'
const COMPANY = 'JC Ventures LLC'
const DBA = 'Lasso'
const ADDRESS = '2949 Kalawao Street, Honolulu, Hawaii 96822'
const EMAIL = 'legal@lasso-app.com'

export default function TermsPage() {
  return (
    <>
      <Head>
        <title>Terms of Service — Lasso</title>
        <meta name="description" content="Lasso terms of service — your agreement for using the Lasso EHR platform." />
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
          <h1 className="text-3xl font-extrabold text-lasso-navy mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-400 mb-10">Last updated: {LAST_UPDATED}</p>

          <div className="space-y-10 text-gray-700 text-sm leading-relaxed">

            <section>
              <p>
                These Terms of Service ("Terms") govern your access to and use of the Lasso electronic health record
                platform operated by <strong>{COMPANY}</strong>, doing business as <strong>{DBA}</strong> ("Lasso,"
                "we," "our," or "us"). By accessing or using the platform, you agree to be bound by these Terms.
              </p>
              <p className="mt-3">
                If you are using Lasso on behalf of a facility or organization, you represent that you have authority
                to bind that organization to these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">1. Description of Service</h2>
              <p>
                Lasso is a HIPAA-compliant electronic health record (EHR) platform designed for residential care homes
                and care teams. The platform provides tools for medication administration records (MAR), progress notes,
                PRN tracking, vital signs documentation, and patient profile management. Lasso is a documentation and
                workflow tool — it is not a substitute for professional medical judgment, diagnosis, or treatment.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">2. Eligibility</h2>
              <p>
                Lasso is intended for use by licensed healthcare providers, care home administrators, and authorized
                care staff. By creating an account, you represent that:
              </p>
              <ul className="list-disc list-inside space-y-2 mt-2">
                <li>You are at least 18 years of age</li>
                <li>You are authorized by your facility to access and document patient health records</li>
                <li>Your use complies with all applicable federal and state healthcare regulations, including HIPAA</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">3. User Accounts and Roles</h2>
              <p className="mb-3">
                Lasso uses role-based access control. Each user is assigned one of the following roles by their
                facility administrator:
              </p>
              <ul className="list-disc list-inside space-y-2 mb-3">
                <li><strong>Superadmin</strong> — facility administrator with full access to manage patients, staff, and records</li>
                <li><strong>Primary Caregiver</strong> — clinical lead with access to patient records and care documentation</li>
                <li><strong>Substitute Caregiver</strong> — care staff with access to documentation workflows within their facility</li>
              </ul>
              <p>
                You are responsible for maintaining the confidentiality of your login credentials. You must not share
                your account or allow unauthorized individuals to access the platform using your credentials.
                Notify us immediately at <a href={`mailto:${EMAIL}`} className="text-lasso-teal hover:underline">{EMAIL}</a> if
                you suspect unauthorized access to your account.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">4. Protected Health Information and HIPAA</h2>
              <p className="mb-3">
                Lasso is designed to operate as a HIPAA Business Associate. We provide HIPAA-ready infrastructure and
                will enter into a Business Associate Agreement (BAA) with covered entities upon request.
              </p>
              <p className="mb-3">
                <strong>Your facility is the Covered Entity.</strong> You are responsible for ensuring that your use
                of Lasso complies with HIPAA and all applicable state privacy laws, including obtaining appropriate
                patient authorizations where required.
              </p>
              <p>
                You agree not to enter PHI into Lasso for any patient who has not been admitted to, or is not actively
                under the care of, your registered facility.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">5. Acceptable Use</h2>
              <p className="mb-3">You agree not to use the Lasso platform to:</p>
              <ul className="list-disc list-inside space-y-2">
                <li>Enter false, misleading, or fabricated patient information</li>
                <li>Access patient records of individuals outside your authorized facility</li>
                <li>Circumvent role-based access restrictions</li>
                <li>Attempt to reverse-engineer, decompile, or extract source code from the platform</li>
                <li>Introduce malware, bots, or automated scripts that disrupt platform operation</li>
                <li>Use the platform for any unlawful purpose or in violation of applicable healthcare regulations</li>
                <li>Share your credentials or allow unauthorized access to the platform</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">6. Digital Signatures</h2>
              <p>
                Lasso supports digital signatures and initials for clinical documentation. By applying your digital
                signature within the platform, you confirm that the documentation is accurate and that you are the
                authorized signatory. Digital signatures applied in Lasso carry the same legal intent as a handwritten
                signature for documentation purposes within the platform.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">7. No Medical Advice</h2>
              <p>
                Lasso is a documentation tool. Nothing in the platform constitutes medical advice, clinical
                recommendations, or a substitute for the professional judgment of a licensed healthcare provider.
                All clinical decisions must be made by qualified healthcare professionals in accordance with
                applicable standards of care.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">8. Intellectual Property</h2>
              <p>
                All content, features, and functionality of the Lasso platform — including but not limited to software,
                design, text, and graphics — are owned by {COMPANY} and are protected by applicable intellectual
                property laws. You are granted a limited, non-exclusive, non-transferable license to use the platform
                solely for its intended purpose during your active subscription period.
              </p>
              <p className="mt-3">
                Patient data and facility records entered into the platform remain the property of the facility and
                the patients they belong to.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">9. Availability and Modifications</h2>
              <p>
                We strive to maintain high availability of the platform but do not guarantee uninterrupted service.
                We reserve the right to modify, suspend, or discontinue any feature of the platform with reasonable
                notice. We will not make changes that result in loss of patient records without providing data export
                options to affected facilities.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">10. Disclaimer of Warranties</h2>
              <p>
                The platform is provided "as is" and "as available" without warranties of any kind, express or implied,
                including but not limited to warranties of merchantability, fitness for a particular purpose, or
                non-infringement. We do not warrant that the platform will be error-free or that defects will be
                corrected.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">11. Limitation of Liability</h2>
              <p>
                To the fullest extent permitted by law, {COMPANY} shall not be liable for any indirect, incidental,
                special, consequential, or punitive damages arising from your use of the platform, including but not
                limited to errors in clinical documentation, data loss, or unauthorized access resulting from your
                failure to safeguard credentials. Our total liability shall not exceed the amount paid by you in the
                twelve (12) months preceding the claim.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">12. Indemnification</h2>
              <p>
                You agree to indemnify and hold harmless {COMPANY} and its officers, directors, employees, and agents
                from any claims, damages, or expenses (including legal fees) arising from your use of the platform,
                your violation of these Terms, or your violation of any applicable law or regulation.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">13. Termination</h2>
              <p>
                We reserve the right to suspend or terminate your access to the platform at any time for violation of
                these Terms, non-payment, or any conduct we determine to be harmful to the platform or other users.
                Upon termination, your right to use the platform ceases immediately. Provisions that by their nature
                should survive termination (including data retention, intellectual property, and limitation of
                liability) will remain in effect.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">14. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the State of Hawaii,
                without regard to conflict of law principles. Any disputes arising under these Terms shall be resolved
                in the state or federal courts located in Honolulu, Hawaii.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">15. Changes to These Terms</h2>
              <p>
                We may update these Terms from time to time. We will notify active users of material changes via email
                or in-platform notice. Continued use of the platform after changes take effect constitutes acceptance
                of the revised Terms.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-lasso-navy mb-3">16. Contact Us</h2>
              <p>For questions about these Terms, contact us at:</p>
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
