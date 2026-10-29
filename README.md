# ARV KKBK (Antiretroviral Klinik Kesihatan Bandar Kulim)

A mobile-first, iOS-inspired personal record tracker designed primarily for iPhone Safari and secondarily for Windows Chrome and Microsoft Edge.

> **CRITICAL PRIVACY & CLINICAL DATA NOTICE:**
> - **DEMO DATA ONLY:** Do not deploy this application publicly or host it on public cloud platforms with real patient data.
> - **CONFIDENTIALITY:** Real HIV/ARV patient records and identifiable clinical details are protected health information (PHI). They must **never** be placed on public hosting, unsanctioned cloud backends, public code repositories, or third-party web services without formal healthcare organisational approval, end-to-end encryption, and rigorous access controls.
> - This codebase contains **zero** real patient records, zero API keys, and zero cloud backends.

---

## Key Features

1. **Two-Tab App Navigation**:
   - **Records Tab**: Search, All / New / Existing segmented filter, multi-criteria sorting, and responsive patient cards.
   - **TCA Tab**: Chronologically grouped appointment timeline with sticky headers:
     - **Overdue**
     - **This Week (Next 7 days)**
     - **This Month**
     - **Later**
     - Collapsed disclosure for patients with **No TCA Date Scheduled**.
   - **Mobile ($\mathbf{<900px}$)**: Restrained Liquid Glass bottom tab bar with $\ge 44\text{px}$ touch targets, safe-area inset spacing (`env(safe-area-inset-bottom)`), and a circular floating Add (+) button positioned above the bar.
   - **Desktop ($\mathbf{\ge 900px}$)**: Bottom bar is hidden. Segmented navigation tab (`[ Records | TCA ]`) is seamlessly embedded in the header beside the title.

2. **Patient Type, Blood Investigations & Plan**:
   - **Patient Type**: Required (`New` or `Existing`), toggled via iOS-style segmented control in the form (defaults to `Existing`). Filterable on main toolbar.
   - **Blood Investigation Date**:
     - Automatically prefilled to 1 calendar month before Next TCA (clamping month ends, e.g. 31 Mar $\rightarrow$ 28/29 Feb).
     - Never overwrites manual user entries.
     - Validation: Blood date cannot be after Next TCA.
     - Displayed as a quiet secondary label on cards with a subtle `(Overdue)` note if the date has passed and tests/plan are scheduled.
     - Sortable by Blood date (earliest or latest first, empty dates always last).
   - **Blood Investigations (Tickable)**:
     - Group of toggle chips/checkboxes ($\ge 44\text{px}$ tap targets, checkmarks): `VL, CD4, FBC, FBS, HbA1c, LFT, AST, RP, FLP, Other`.
     - When "Other" is ticked, an inline text input asks to state the investigation (required only if Other is ticked; unticking Other clears it).
     - Displayed on cards as mini text chips (up to 3, then `+N` badge).
     - Sortable by Blood investigations (`investigations_asc`).
   - **Plan**:
     - Separate multi-line free-text field for clinical and adherence plans, displayed full in Profile View and truncated to 2 lines on cards.
     - Sortable by Plan (`plan_asc`, case-insensitive, empty last).

3. **Patient Profile View**:
   - Tapping any card or TCA timeline row opens an iOS grouped card profile view (bottom sheet on mobile, modal on desktop).
   - Grouped sections: Header (Name & Type), Identification & Contact (IC, tap-to-call link for phone numbers), Appointments & Investigations (Next TCA + status, Blood Date), Blood Investigations (with Other text), and Plan.
   - Quick actions to Edit or Delete (protected by confirmation sheet).

4. **100% Local Device Storage & Safe Migration**:
   - Patient records are persisted solely in the device's **IndexedDB** (`arv_kkbk_db`, Schema Version 3).
   - Safe automated migration seamlessly migrates legacy combined `bloodInvestigationsPlan` into the new `plan` field with zero data loss.
   - `localStorage` is restricted exclusively to user preferences (Theme, Sort order, Active tab). No patient records ever touch `localStorage`.
   - Zero telemetry, zero analytics, zero external network requests.

5. **Safe Data Portability (Export & Import)**:
   - Export records to JSON file with `schemaVersion: 3`.
   - Import JSON accepts Version 1, 2, and 3 backups, automatically migrating legacy text fields and validating allowed investigation options.

---

## Safe Multi-Device Usage (Phone & Laptop)

Because ARV KKBK does not connect to any cloud server or database:
1. **To move records between your iPhone and laptop:**
   - On the source device (e.g. Phone), open **Data** > **Export JSON**.
   - Send the file directly to your laptop via **AirDrop**, a direct USB connection, or encrypted local file transfer.
   - On the destination device (e.g. Laptop), open **Data** > **Import JSON**, select the file, and choose **Merge** or **Replace**.
2. **Security Precaution:** Real clinical records must never be emailed through unencrypted public email or stored in public cloud storage folders. Always delete exported JSON files from temporary download folders once imported.

---

## Publishing & Deployment Options

The application is completely static (no build step or backend required on the server). You can publish either the **root folder** or the self-contained `dist/` directory.

### Option A: GitHub Pages (Free, Recommended for personal use)
1. Initialize or push this repository to GitHub (set to **Private** if you want repository visibility restricted).
2. Go to **Settings** > **Pages**.
3. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: `main` (or `master`), Folder: `/ (root)` or `/dist`.
4. Click **Save**. Your app will be live at `https://<username>.github.io/<repo-name>/`.

### Option B: Cloudflare Pages / Netlify / Vercel
1. Upload or link the repository.
2. Build command: *(leave empty or use `npm run compile`)*.
3. Publish directory: `dist` or `.`.
4. Deploy!

### Option C: Instant Local / Clinic Network Serving
To run privately on your local laptop or clinic Wi-Fi without uploading to the internet:
```bash
# In the arv-kkbk directory:
python -m http.server 8080
# Access from iPhone on the same Wi-Fi: https://<laptop-ip>:8080
```

---

## Installing on Devices (PWA)

### iPhone Safari (Primary)
1. Open the published URL in **Safari** on your iPhone.
2. Tap the **Share** button (box with an upward arrow at the bottom of Safari).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **Add**. The ARV KKBK app icon will appear on your Home Screen.
5. Opening it from the Home Screen launches it as a standalone fullscreen app with offline caching enabled.

### Windows Chrome / Microsoft Edge (Secondary)
1. Open the URL in Chrome or Edge.
2. Click the **Install** icon in the address bar (or Menu > **Install ARV KKBK**).
3. The app opens in its own clean desktop window.

---

## Running Locally

### Building / Compiling
```bash
# Compile and package production dist/ folder:
node scripts/build.js
```
