# Wekraft sales dashboard
## Deploy on Vercel
1. Extract the ZIP. Upload the contents to a **private GitHub repository**. The repository root should contain vercel.json, public, api and private. The private directory contains the starting sales figures.
2. In Vercel choose **Add New → Project**, import the repository and select framework **Other**. The included configuration serves public and runs the report API. Leave the build command empty.
3. In Environment Variables set **DASHBOARD_PASSWORD** to a long, unique team password. Deploy. Open the site and sign in. Choose **Latest day** to see the most recent invoice day. The starting workbook covers 2 May 2025 through 24 November 2026.
4. Share the deployment URL and the team password privately with authorised viewers. Everyone with the password can see the whole team’s sales. The workbook and customer-level invoice details are excluded from the package.

## Enable updates for the whole team
The initial report works with just DASHBOARD_PASSWORD. For shared updates, connect an Upstash Redis database from Vercel Storage / Marketplace. Ensure the project has UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN (KV_REST_API_URL and KV_REST_API_TOKEN are also accepted). Add a separate long random **PUBLISHER_KEY** for the person responsible for updates. Redeploy after changing environment variables.

In desktop Chrome or Edge, sign into the site, open **Update team data**, enter the publisher key and click **Connect and publish workbook**. Select the live .xlsx from the OneDrive folder synced to your computer. The site parses the workbook locally and publishes aggregate sales and dispatch values. Viewers only need the URL and team password.

Keep the publisher tab open and the computer awake. It checks the synced file every minute and publishes changes; viewers recheck every minute and when they return to the tab. After closing or reloading the publisher tab, reconnect the workbook and enter the key again. Browsers without a supported file picker can publish a single workbook manually. The website has no direct OneDrive connection and cannot retrieve a workbook while the publishing computer is off.

## Report definitions
Sales use Invoice Value in monthly sheets. The import normalises known salesperson spellings, combines Module and Modules, keeps blank salesperson entries under Unassigned, excludes exact duplicate invoice rows, and includes missing amounts only in row counts. Mobile and desktop filters include month, invoice day, product and salesperson. The day selector uses the dates contained in the selected month. The separate dispatch panel uses the dated dispatch summary only when its salesperson rows reconcile to the stated total.
