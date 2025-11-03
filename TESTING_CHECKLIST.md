# Testing Checklist for Chartbuddies

## Prerequisites
✅ Database schema migration completed
✅ Environment variables set (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
✅ Dev server running (`npm run dev`)

## Test Flow

### 1. First User - Create Hospital (Superadmin)
- [ ] Go to `http://localhost:3000`
- [ ] Should redirect to `/auth/login`
- [ ] Click "Sign up" link
- [ ] Fill in:
  - Full Name: "Dr. John Admin"
  - Email: `test-admin@example.com` (or your test email)
  - Password: `testpass123`
  - Confirm Password: `testpass123`
- [ ] Click "Continue"
- [ ] **Leave "Invite Code" blank** (creating new hospital)
- [ ] Fill in:
  - Hospital Name: "General Hospital"
  - Facility Type: "Hospital"
- [ ] Click "Sign Up"
- [ ] Should redirect to `/dashboard`
- [ ] Verify you see "Welcome" message and your role shows as "SUPERADMIN"

### 2. Register First Patient
- [ ] From dashboard, click "+ Add Patient" button
- [ ] Fill in patient registration form:
  - Patient Name: "Jane Doe"
  - Record Number: "P001"
  - Date of Birth: Pick any date
  - Sex: Select one
  - Diagnosis: "Hypertension"
  - Diet: (optional)
  - Allergies: "None" or "Penicillin"
  - Physician Name: "Dr. Smith"
  - Physician Phone: "555-1234"
  - Facility Name: "General Hospital"
- [ ] Click "Register Patient"
- [ ] Should see success message and redirect to dashboard
- [ ] Verify patient "Jane Doe" appears in the patient list

### 3. Create MAR Form
- [ ] Click "View Forms →" next to the patient
- [ ] Should see "Available Forms" page
- [ ] Click "+ New MAR Form"
- [ ] Fill in patient information (most fields pre-filled):
  - Month/Year: Select current month
  - Verify other fields are pre-filled
- [ ] Click "+ Add Medication"
- [ ] Fill in medication:
  - Medication Name: "Lisinopril 10 mg"
  - Dosage: "10 mg PO daily"
  - Start Date: Pick a date
  - Stop Date: (leave blank)
  - Administration Time: "09:00"
  - Notes: (optional)
- [ ] Scroll to "Daily Administration Record"
- [ ] Test clicking days 1-5 and set status to "Given" or "Not Given"
- [ ] Add initials for given medications
- [ ] (Optional) Click "+ Add PRN Record" and fill in a PRN entry
- [ ] (Optional) Add vital signs for first few days
- [ ] Click "Save Draft" (we'll test editing later)
- [ ] Should redirect to view the MAR form

### 4. View MAR Form
- [ ] Verify MAR form displays correctly:
  - Patient information shows
  - Medications table shows with administration grid
  - PRN records (if added) show
  - Vital signs (if added) show
- [ ] Click "← Back to Patient Forms"
- [ ] Verify MAR form appears in the list

### 5. Create Second User (Nurse) - Join Hospital
- [ ] **Copy the invite code** from Supabase:
  - Go to Supabase Dashboard → Table Editor → `hospitals` table
  - Find your hospital and copy the `invite_code` (8-character code)
- [ ] Logout (click "Logout" button in dashboard)
- [ ] Click "Sign up"
- [ ] Fill in:
  - Full Name: "Nurse Sarah"
  - Email: `nurse1@example.com`
  - Password: `testpass123`
- [ ] Click "Continue"
- [ ] **Enter the invite code** you copied
- [ ] Click "Sign Up"
- [ ] Should redirect to dashboard
- [ ] Note: Dashboard might be empty (no assigned patients yet)

### 6. Assign Patient to Nurse (Superadmin Only)
- [ ] Logout as nurse
- [ ] Login as the admin user (`test-admin@example.com`)
- [ ] In Supabase Dashboard:
  - Go to `nurse_patient_assignments` table
  - Click "Insert" → "Insert row"
  - Fill in:
    - `nurse_id`: Copy the UUID from `user_profiles` table (find nurse user)
    - `patient_id`: Copy the UUID from `patients` table (find "Jane Doe")
    - `assigned_by`: Copy the admin user UUID
    - `is_active`: `true`
  - Click "Save"
- [ ] Logout admin
- [ ] Login as nurse (`nurse1@example.com`)
- [ ] Dashboard should now show "Jane Doe" patient

### 7. Nurse Creates MAR Form
- [ ] As nurse, click "View Forms →" for the patient
- [ ] Click "+ New MAR Form"
- [ ] Create a complete MAR form with:
  - Multiple medications
  - Daily administration records
  - PRN records
  - Vital signs
- [ ] Click "Submit" (not draft)
- [ ] Verify form is saved and viewable

### 8. Test Access Control
- [ ] As nurse, try to access `/dashboard`
  - Should see only assigned patients
- [ ] As admin, access `/dashboard`
  - Should see all patients in hospital

## Common Issues & Fixes

### Issue: "User profile not found" after signup
**Fix**: Check if the trigger `on_auth_user_created` ran. If not, manually create user profile in Supabase.

### Issue: "Hospital not found" error
**Fix**: Verify the user profile has a `hospital_id` set.

### Issue: Can't see patients
**Fix**: Check RLS policies. For nurses, ensure `nurse_patient_assignments` records exist.

### Issue: "Permission denied" errors
**Fix**: Verify RLS policies are enabled and check user role matches permissions.

## Next Steps After Testing
Once testing is successful:
1. Test MAR form editing functionality
2. Build Head Nurse dashboard
3. Add nurse-patient assignment UI
4. Add form builder for custom forms

