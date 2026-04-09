# PRN Records in MAR Chart - Feature Specification

## Current Status
**PENDING IMPLEMENTATION**

The "+ Add PRN Record" button at the top of the MAR page (below facility name) has been temporarily hidden via comment. It will be re-enabled once PRN records are fully integrated into the MAR chart. The button in the PRN Records section below remains active and functional.

## Overview
Add PRN (as needed) medication records to the main MAR chart, creating a unified view where PRN administrations appear alongside routine medications and vitals.

## Key Concept
- **Same underlying data**: Uses existing `mar_prn_records` table
- **Two views**: 
  1. MAR chart format (grouped by medication, one row per PRN medication)
  2. Table format below (existing, one row per administration record)
- **Nurse flexibility**: Nurses can choose which view works better for their workflow

## MAR Chart Display Requirements

### Row Structure
Each unique PRN medication gets **one row** in the MAR chart (similar to medications/vitals):

**Column 1 - Medication Info (sticky column):**
- PRN icon (distinctive, like vitals icon)
- "PRN" label
- Medication Name
- Dosage
- Reason/Indication

**Column 2 - Start/Stop Date (sticky column):**
- Start Date (editable, syncs across all records for that medication)
- Stop Date (if applicable)

**Column 3 - Hour/Time (sticky column):**
- Display "PRN" or similar indicator (since times vary per administration)

**Day Columns (1-31):**
- Each day can have **multiple time/result entries** (stacked vertically)
- Display format:
  ```
  [Time] [Result] [Initials]
  [Time] [Result] [Initials]
  + Time  + Result
  ```
- Completed entries show: time administered, result, initials
- New entry buttons: "+ Time" and "+ Result" for adding more

### Interactive Buttons

**Time Button:**
- Opens modal/input for time entry
- Format: HH:MM with AM/PM selector (like existing PRN table)
- Saves to `mar_prn_records.hour`

**Result Button:**
- Opens modal/input for result entry
- Includes optional notes field
- Saves to `mar_prn_records.result` and `mar_prn_records.note`

**Sequential Flow:**
1. User adds PRN record → creates row if new medication, or adds to existing row
2. User clicks "+ Time" on a specific date → enters time → saves
3. User clicks "+ Result" → enters result (+ optional notes) → saves
4. New "+ Time" and "+ Result" buttons appear for additional entries
5. Process repeats for multiple administrations

## Data Model

### Existing Table: `mar_prn_records`
Each record represents one administration:
- `id`: UUID
- `mar_form_id`: UUID (foreign key)
- `start_date`: DATE (new column, from migration 066)
- `date`: DATE (date administered)
- `hour`: TIME (time administered)
- `medication`: VARCHAR(255)
- `dosage`: TEXT
- `reason`: TEXT
- `result`: TEXT
- `initials`: VARCHAR(10)
- `staff_signature`: VARCHAR(255)
- `signed_by`: UUID
- `entry_number`: INTEGER (for table display order)
- `note`: TEXT

### Grouping Logic
PRN records are grouped by:
- `medication` (medication name)
- Within each group, records are organized by `date` (administered date)
- Multiple records on same date → multiple entries in that day column

## Implementation Steps

### 1. Data Grouping
- Create function to group PRN records by medication name
- Within each group, organize records by date
- Handle multiple records per date (array of records)

### 2. Render PRN Rows in MAR Table
- Add PRN rows after Vitals rows (or in custom order)
- Render sticky columns (medication info, start date, "PRN" indicator)
- Apply color coding for visual distinction

### 3. Day Column Rendering
- For each day, find all PRN records for that medication on that date
- Display each existing record: time, result, initials (read-only or editable)
- Add "+ Time" and "+ Result" buttons for new entries

### 4. Time Entry Interaction
- Click "+ Time" → open time input modal/inline input
- User enters HH:MM + AM/PM
- Save creates new `mar_prn_records` entry with:
  - `mar_form_id`
  - `medication`, `dosage`, `reason` (from PRN medication)
  - `start_date` (from PRN group)
  - `date` (selected day)
  - `hour` (entered time)
  - `entry_number` (next sequential)

### 5. Result Entry Interaction
- Click "+ Result" (appears after time entered)
- Open result input modal with:
  - Result field (text)
  - Optional notes field
- Save updates the PRN record with `result` and `note`

### 6. Multiple Entries Per Day
- After completing time + result, show the completed entry
- Display new "+ Time" and "+ Result" buttons below
- Allow unlimited entries per day

### 7. Sync with PRN Records Table
- All changes in MAR chart update `mar_prn_records` table
- Table below automatically reflects changes (shared state)
- Entry numbers stay sequential across all PRN records

### 8. Filter Buttons
- Update "Show" filter to include PRN option
- Options: All, Routine meds, Vitals, PRN
- Filter logic includes PRN rows

### 9. Styling
- Choose distinctive color for PRN rows (different from vitals/medications)
- Apply to sticky columns for visual consistency
- Consider: yellow/orange tones to indicate "as needed" nature

## Edge Cases to Handle

1. **Empty PRN records**: If no PRN records exist, don't show any PRN rows
2. **Date validation**: Administered date must fall within MAR month
3. **Sequential entry numbers**: Maintain order across all PRN records
4. **Deleting entries**: Remove from chart and table, renumber remaining entries
5. **Editing medication**: Changing medication name moves record to different row group
6. **Start date sync**: Changing start date updates all records for that medication
7. **Print view**: Ensure PRN rows render correctly in print layout

## Technical Considerations

- **State management**: PRN records already in `prnRecords` state
- **Grouping function**: Similar to medication grouping by name/dosage/dates
- **Row rendering**: May need new component similar to `MarMedTableRow`
- **Modal reuse**: Can reuse existing time/result input patterns
- **Performance**: Consider useMemo for grouping if many PRN records

## Questions Resolved
- PRN records appear in both MAR chart AND table below ✓
- Each PRN medication = one row in chart ✓
- Multiple entries per day = stacked in day column ✓
- Data source = `mar_prn_records` table (no new table needed) ✓
- Sync between chart and table = shared state ✓
