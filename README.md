# JournalShare

JournalShare is a mobile-first journaling experience designed for Android installs. Sign in
with Gmail, write daily journals, and share selected entries with friends using the Android
share sheet. Entries and friend lists are stored locally for offline use.

## Features

- Gmail login via Google Identity Services
- Create, tag, and save journal entries
- Maintain a friend list and share entries by friend
- Installable as a standalone app on Android (PWA manifest)

## Quick start

1. Install dependencies: `yarn install`
2. Start the app: `yarn start`
3. Open `http://localhost:3000`

## Gmail login setup

1. Create an OAuth 2.0 Client ID in Google Cloud Console (type: Web application).
2. Add authorized JavaScript origins (for example, `http://localhost:3000`).
3. Create a `.env` file with:

`REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id_here`

If a client ID is not present, the app shows a demo login option for local previews.

## Install on Android

1. Open the running app in Chrome on Android.
2. Tap the menu and choose **Install app** (or **Add to Home screen**).
3. Launch JournalShare from the home screen for the full-screen app experience.

## Available scripts

- `yarn start` - Run the development server.
- `yarn test` - Run the test suite.
- `yarn build` - Build the production bundle.
