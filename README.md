# Climate Podcast Explorer

Existing repository: mctrexler/climate-podcasts. Existing production address: https://climate-podcasts.vercel.app/. Keep the existing Vercel project and repository connection.

## Local setup

Run `npm ci`, then `npm run dev`. Copy `.env.example` to `.env.local` and set the three server-only Google settings for the podcast editorial spreadsheet. Never commit private keys or borrow credentials from another app. Share the intended spreadsheet with the service account as Viewer, and enable Google Sheets API in its project. Use an `Episodes` tab with columns documented in the parent project's Admin/WORKFLOW.md.

The API reads Episodes A1:W10000. Only explicitly Published rows are eligible; records whose Content type is article are excluded from the podcast explorer. They remain in the editorial Sheet and source collection. Set Publication status to Ready to hide any other record. Private editorial columns are not projected. Missing configuration, invalid schema, duplicate IDs and invalid visible records fail closed. No bundled CSV or sample-data fallback is used. Summary previews are excerpts of the authoritative Summary field. Date windows overlap known day/month/year intervals; unknown dates are available under All time. Dates supplied by the editor in filenames are accepted editorial dates; they receive no unverified label.

Tests: `node --test tests/sheetRecords.test.cjs`. Build: `npm run build`.

## Migration gate

The connected editorial Sheet has788records with an exact24428-cell import readback. The approved publication selection contains733source-based records;54legacy description-only records and one existing exclusion remain hidden. Publication status readback is a separate step; do not infer publication from import approval. The legacy CSV was archived in the parent project's processing_runs/app-migration-20261117. No private Sheet snapshots belong in public/ or the repository.

Validate dialog keyboard opening, Tab/Shift+Tab focus containment, Escape and Close, restoration to trigger, touch and narrow screens. Validate filtering combinations, error/empty states, exclusion of private rows, and dates/tags against Sheet data. Then deploy through the existing Vercel project. Set environment variables there before deployment.

## Existing Vercel project

Keep climate-podcasts.vercel.app and the existing GitHub integration. Configure GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY as server-only Production environment variables. The local .env.local already holds the podcast settings; import it only into the existing project's environment settings, never GitHub. Keep the service account Viewer. Deploy the approved commit after configuration and publication readback. Verify /api/episodes returns the approved733public records and no private editorial fields after deployment.
