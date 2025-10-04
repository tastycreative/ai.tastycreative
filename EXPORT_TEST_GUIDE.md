# Export Feature - Quick Test Guide

## ✅ Features Added

### 1. Export Button
- Located in the top toolbar (right side)
- Shows "Export (0)" when no posts selected
- Shows "Export (3)" when 3 posts selected
- Disabled (grayed out) when selectedPostIds.length === 0

### 2. Select All Button
- Appears when there are posts
- Toggles between "☑ Select All" and "☐ Deselect All"
- Shows selection count: "3 selected"

### 3. Post Checkboxes
- Checkbox in top-left corner of each post
- Green accent color
- Click to select/deselect individual posts
- Selected posts have green ring around them

### 4. Export Dropdown Menu
When you click Export:
- 📄 **Text File (.txt)** - Captions formatted for Instagram
- 📊 **CSV File (.csv)** - Spreadsheet format
- 📋 **JSON File (.json)** - Raw data

## 🧪 Testing Steps

### Test 1: Select Individual Posts
1. Open Instagram Staging Tool
2. Look for checkboxes on post thumbnails (top-left corner)
3. Click checkbox on 1 post → Should see "1 selected"
4. Click checkbox on 2 more posts → Should see "3 selected"
5. Export button should show "Export (3)"
6. Posts should have green ring

### Test 2: Select All
1. Click "☑ Select All" button
2. All posts should get selected
3. Counter shows total: "12 selected" (if you have 12 posts)
4. Button changes to "☐ Deselect All"
5. Click again → All deselected

### Test 3: Export TXT
1. Select 2-3 posts
2. Click Export button
3. Choose "Text File (.txt)"
4. File should download: instagram-posts-[timestamp].txt
5. Open file → Should see formatted captions

### Test 4: Export CSV
1. Select posts
2. Export → CSV
3. Open in Excel/Sheets
4. Should see columns: File Name, Caption, Scheduled Date, Status, etc.

### Test 5: Export JSON
1. Select posts
2. Export → JSON  
3. Open in text editor
4. Should see valid JSON array

## 🎨 Visual Guide

```
┌─────────────────────────────────────────────────────┐
│  Instagram Staging Tool                             │
│  [☑ Select All] [3 selected] [Export (3) ▼]       │
└─────────────────────────────────────────────────────┘

Grid View:
┌─────────┬─────────┬─────────┐
│ ☑ img1  │ ☐ img2  │ ☑ img3  │  ← Checkboxes
│ [green  │         │ [green  │  ← Green rings on selected
│  ring]  │         │  ring]  │
└─────────┴─────────┴─────────┘
```

## 📋 Example Export Output

### TXT Format:
```
═══════════════════════════════════════
POST 1: sunset_beach.jpg
═══════════════════════════════════════
Scheduled: Oct 4, 2025 5:30 PM
Status: APPROVED
Type: POST

CAPTION:
🌅 Beautiful sunset! 
#sunset #beach

IMAGE URL:
https://drive.google.com/...
```

### CSV Format:
```
File Name,Caption,Scheduled Date,Status,Post Type,Image URL
sunset.jpg,"Beautiful sunset","2025-10-04T17:30:00",APPROVED,POST,https://...
```

## 🐛 Troubleshooting

### "Can't see Export button"
✅ FIXED! Button is now integrated

### "Checkboxes not showing"
- Refresh the page
- Check browser console for errors
- Make sure you're on the Grid view (not Queue view)

### "Export button is grayed out"
- This is correct! You need to select posts first
- Click checkboxes on posts
- Button will become active

### "Nothing happens when clicking Export"
- Check browser console (F12)
- Look for API errors
- Make sure posts have data (caption, fileName, etc.)

## ✨ Success Indicators

You'll know it's working when:
1. ✅ Checkboxes appear on post thumbnails
2. ✅ "Select All" button is visible
3. ✅ Selection counter shows correct number
4. ✅ Export button changes from gray to green
5. ✅ Dropdown menu appears on click
6. ✅ Files download when format is chosen
7. ✅ Selected posts have green rings

## 🎉 You're Done!

The export system is now fully functional. Users can:
- Select individual posts or all posts
- See visual feedback (green rings, counter)
- Export in 3 different formats
- Download files ready for Instagram posting

Perfect for content creators who need to batch-prepare captions! 📸
