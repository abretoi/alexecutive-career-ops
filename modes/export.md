# Mode: Export

Triggered by `/opus export` or "export my tracker" / "download to CSV" / "Google Sheets".

## Steps

1. **Read** `data/applications.md` — parse the markdown table
2. **Generate CSV** with these columns:
   ```
   #,Date Applied,Company,Role,Industry,Score,Status,Resume,Interview Date,Notes,Report Link,Job URL
   ```
3. **Save** to `data/exports/applications-{YYYY-MM-DD}.csv`
4. **Google Sheets import instructions** (always include):
   > To import into Google Sheets:
   > 1. Open Google Sheets → File → Import
   > 2. Upload `data/exports/applications-{date}.csv`
   > 3. Select "Comma" as the separator → Import data
   > 4. Optional: Format the "Score" column as numbers, "Status" column with conditional color formatting

5. **Excel instructions** (include):
   > To open in Excel: double-click the CSV file. If columns don't split correctly, use Data → Text to Columns → Delimited → Comma.

6. **Summary stats** (print in chat):
   ```
   Export complete: data/exports/applications-{date}.csv

   Summary:
   - Total tracked: N
   - Applied: N  
   - Interviews: N
   - Offers: N
   - Avg score: X.X
   - Most active month: [month]
   ```

## Google Sheets Live Sync (Advanced)

For automatic live sync, the user needs to set up a Google Apps Script that reads the CSV on a schedule. See `docs/GOOGLE-SHEETS-LIVE-SYNC.md` for instructions.
