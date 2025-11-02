# Feedback System Setup Instructions

## Database Setup

### 1. Run the migration in Supabase

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project (`chartbuddies`)
3. Navigate to **SQL Editor**
4. Copy the contents of `supabase-migrations/003_create_feedback_tables.sql`
5. Paste and run it

### 2. Create Storage Bucket for Images

1. In Supabase dashboard, go to **Storage**
2. Click **Create a new bucket**
3. Bucket name: `feedback-images`
4. **IMPORTANT**: Make it **Public** (uncheck "Private bucket")
5. Click **Create bucket**

### 3. Set Storage Policies

Run this SQL in the SQL Editor to allow public access:

```sql
-- Allow public access to feedback-images bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'feedback-images' );

CREATE POLICY "Public Upload"
ON storage.objects FOR INSERT
TO public
WITH CHECK ( bucket_id = 'feedback-images' );
```

## Testing the Feedback System

### How to Use:

1. **Enter Feedback Mode**:
   - Click the purple "Feedback Mode" button in the bottom-right
   - The cursor changes to a crosshair
   - Click anywhere on the page to place a note

2. **Add a Note**:
   - Fill in the form with:
     - Title (required)
     - Description
     - Your name (optional)
     - Upload screenshots
   - Click "Submit Note"

3. **View Dashboard**:
   - Click the blue "Dashboard" button
   - View all notes
   - Filter by:
     - **All**: All notes
     - **Incomplete**: Notes not yet completed
     - **Complete**: Completed notes
     - **This Page**: Notes on current page

4. **Mark as Complete**:
   - Click the circular button (○) in a note card
   - It changes to a checkmark (✓)

5. **Navigate to Note**:
   - Click any note card in the dashboard
   - It navigates to the page where the note was placed

### Visual Markers:

- 📝 Purple button = Feedback Mode toggle
- 📋 Blue button = Dashboard toggle
- 🎯 Yellow banner appears when in Feedback Mode
- ○ = Incomplete note
- ✓ = Complete note (green)
- ⚠️ Red border = Incomplete
- ✅ Green border = Complete

## Technical Details

### Data Stored:

- **Page URL**: Current page pathname
- **Coordinates**: X/Y position on page when clicked
- **Component Path**: CSS selector of clicked element
- **Title & Description**: User input
- **Screenshots**: Images stored in Supabase Storage
- **Status**: Complete/Incomplete
- **Timestamps**: Created/Updated dates

### How It Works:

1. Component auto-detects the clicked element's position
2. Generates a CSS selector path for the element
3. Stores note with coordinates and element path
4. Allows navigation back to the same location
5. Filters and sorts notes in real-time

## Troubleshooting

### Images not uploading?

- Check that the `feedback-images` bucket exists
- Verify the bucket is set to Public
- Check that storage policies are set correctly

### Notes not showing?

- Refresh the dashboard
- Check browser console for errors
- Verify the database migration ran successfully

### Navigation not working?

- Verify the page URL was saved correctly
- Check that the route exists in your app

