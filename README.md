# Wekraft sales dashboard
## Deploy on Vercel
1. Extract the ZIP. Upload the contents to a **private GitHub repository**. The repository root should contain vercel.json, public, api and private. The private directory contains the starting sales figures.
2. In Vercel choose **Add New → Project**, import the repository and select framework **Other**. The included configuration serves public and runs the report API. Leave the build command empty.
3. In Environment Variables set **DASHBOARD_PASSWORD** to a long, unique team password. Deploy. Open the site and sign in. Choose **Latest day** to see the most recent invoice day. The starting workbook covers 2 May 2025 through 24 November 2026.
4. Share the deployment URL and the team password privately with authorised viewers. Everyone with the password can see the whole team’s sales. The workbook and customer-level invoice details are excluded from the package.

## Connect OneDrive once

1. Use the stable production address of your Vercel project. In the Microsoft Entra admin center, open **App registrations → New registration**, choose **Personal Microsoft accounts only**, and add a **Web** redirect URI of `https://YOUR-PRODUCTION-DOMAIN/api/onedrive`. Use exactly the same domain when opening the dashboard.
2. Copy the Application (client) ID. Under **Certificates & secrets**, create a client secret and copy its **Value**. In **API permissions** add Microsoft Graph **delegated Files.ReadWrite**. Microsoft requires this permission to resolve the OneDrive sharing link. The site uses GET requests to read workbook metadata and download the file. It requests offline access for scheduled refreshes. Reconnect after rotating the client secret.
3. Connect **Upstash Redis** to the Vercel project. It holds the shared report, the encrypted Microsoft refresh token and short-lived connection state. Set these **Production** environment variables in Vercel:

| Variable | Value |
|---|---|
| SITE_URL | Your production HTTPS origin, e.g. https://my-sales.vercel.app |
| ONEDRIVE_SHARE_URL | The full Rakshith Work sheet sharing link, including its query string |
| MS_CLIENT_ID / MS_CLIENT_SECRET | The application ID and secret value in two separate variables |
| DASHBOARD_PASSWORD | A unique password for dashboard viewers |
| PUBLISHER_KEY | A separate long random admin password |
| CRON_SECRET | A different random secret of at least 32 characters |
| UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN | The two REST credentials from Upstash. KV_REST_API_URL and KV_REST_API_TOKEN also work. |

4. Redeploy to production after saving the variables. Open the site, enter the team password, expand **Update team data**, enter the publisher key and click **Connect OneDrive**. Sign in with the personal Microsoft account that can open Rakshith’s workbook. Return to the dashboard, sign in again and choose **Sync OneDrive now**. Check the reported latest invoice date and use **Latest day** to view that day's totals.
5. Vercel Cron calls the refresh endpoint daily at 13:30 UTC (7:00 PM India time). The Hobby plan can run it anywhere in the scheduled UTC hour. Production → Settings → Cron Jobs shows the schedule, and function logs show failures. Keep the workbook saved in OneDrive. After the scheduled run, viewers can reload or use **Refresh report**. Later edits appear after the next successful sync. To include them sooner use **Sync OneDrive now**.

The server reads all monthly invoice tabs, reconciles aggregate values and counts, and publishes only a validated report. If sign-in expires, reconnect from the dashboard. The last saved report remains available after an unsuccessful sync. A local workbook import is also available to the publisher.

## Report definitions
Sales use Invoice Value in monthly sheets. The import normalises known salesperson spellings, combines Module and Modules, keeps blank salesperson entries under Unassigned, excludes exact duplicate invoice rows, and includes missing amounts only in row counts. Mobile and desktop filters include month, invoice day, product and salesperson. The day selector uses the dates contained in the selected month. The separate dispatch panel uses the dated dispatch summary only when its salesperson rows reconcile to the stated total.
