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
   - `localStorage` holds only settings (theme, sort order, active tab, current program, PIN lock and backup-encryption settings). No patient records ever touch `localStorage`; the safety copy taken before a Replace import or Drive restore is kept in its own IndexedDB database (`arv_kkbk_safety`) for 7 days.
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

The app is built with Vite into a static `dist/` folder (no backend). `dist/` is generated, not committed.

### Option A: GitHub Pages (current setup)
Every push to `main` runs `.github/workflows/deploy.yml`, which type-checks, runs the tests, builds with Vite and publishes `dist/`. A failing test stops the deploy. The site path is set by `base` in `vite.config.ts`.

### Option B: Cloudflare Pages / Netlify / Vercel
1. Link the repository.
2. Build command: `npm run build`. Publish directory: `dist`.
3. Change `base` in `vite.config.ts` to `/` if the site is served from the domain root.

### Option C: Local / clinic network only
To run privately without uploading anything:
```bash
npm run build
npm run preview -- --host
```
Then open the address it prints (the path includes the `base` from `vite.config.ts`).

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

```bash
npm install        # once
npm run dev        # live-reloading dev server
npm test           # type check + all tests + production build
npm run test:watch # re-run tests on every save
```

Tests live in `tests/` and use Vitest. Storage tests run the real IndexedDB code against an in-memory database (fake-indexeddb); UI tests render components in a simulated page (jsdom). Static files (icons, manifest, service worker) live in `public/`.

## Programs, tabs and security

- **One app, two programs.** The ARV | MMT switch in the header changes the whole app. A person can be in both programs and stays one record (matched by IC number). Removing someone from one program keeps the other.
- **Three tabs.** Records, TCA (called Review in MMT) and More. More holds the Message Generator, Google Drive, Local Data, Security, Recently Deleted and About.
- **MMT records:** current dose and dose history, a daily dose log (dispensed or missed), take-home supplies, urine tests, and reviews. Patients are listed under "Needs follow-up" after 3 days of missed doses or an overdue review. Both numbers are constants at the top of `src/utils/mmt.ts`.
- **Security:** optional PIN lock with auto-lock, encrypted Drive backups and exports (passphrase, AES-256-GCM), Recently Deleted for 30 days, and Sync Now to merge changes from another device (newest edit per patient wins).
- **Tests:** `npm test` type-checks, runs every test and builds. The build output (`dist/`) is not committed.
- Backups and exports contain patient data. Do not commit them to a public repository.
