# Automatic Excel Synchronization Workflow

Whenever the user provides, attaches, updates, or mentions a new Excel file (e.g. `Report Sitac  2026 FIX.xlsx`, `Rekap Collo`, `Export Perizinan.xlsx`, etc.):

1. **Execute the Universal Sync Script immediately:**
   ```powershell
   python sync_excel.py "<path_to_excel_file>"
   ```
   Or simply:
   ```powershell
   python sync_excel.py
   ```
   (if the file was saved or replaced in the workspace).

2. **What `sync_excel.py` automatically handles:**
   - Cleans all dates (`date_dispos`, `date_close`, `date_pa`) into canonical ISO `YYYY-MM-DD` (converting text strings like `2-Oct-26`, serial numbers, etc.).
   - Smart deduplication by `no_pa` and `pelanggan` + `terminating` (or `sid`/`no_so`).
   - Inserts new rows and updates existing rows in SQLite (`telecom_portal.db`).
   - Regenerates `sitac_collo_data.json` and `sitac_collo_data.js`.
   - Bumps cache-buster versions in `index.html`.
   - Deploys the latest bundle directly to Firebase Hosting (`https://analytics-811fc.web.app`).

3. **Respond directly to the user in Indonesian:**
   - Report how many new rows were inserted and updated.
   - Confirm that the data is live on `https://analytics-811fc.web.app` and ask the user to refresh (`Ctrl + F5`).
