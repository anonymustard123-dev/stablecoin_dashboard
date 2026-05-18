# Stablecoin Pipeline Dashboard - Setup Guide

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Mapbox

Add your Mapbox token to `.env.local`:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=your_token_here
```

## Step 3: Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Step 4: Upload the Pipeline CSV

Use the upload panel in the dashboard and select the D365 pipeline export from your machine. The CSV must include these headers:

```text
Client, Opportunity, Owner, Total Bid Value, Probability, Opportunity Country, Opportunity City, Current Situation, Status, Oppty ID
```

## Next Steps

Every time you receive a new D365 export, click `Upload New Pipeline` and select the new CSV. The app remains read-only and client-side, and pipeline data is only held in the current browser session.
