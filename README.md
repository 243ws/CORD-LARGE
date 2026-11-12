# Slendo Cord

Node.js, Express, and React app for Slendo Cord.

## Run locally

Prerequisite: Node.js.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Add two private, one-time values to `LOGIN_INVITE_CODES`, separated by a comma. Keep `.env` private; it is ignored by Git.
4. Start the app with `npm start` and open `http://localhost:3000`.
5. Use one invite to create your account. Give the other invite only to the person you want to allow.

Sign-up is invite only. Passwords are stored as salted `scrypt` hashes, and successful sign-ins use an HttpOnly session cookie. App API routes require a valid session.

## Hosting note

The access accounts and sessions are stored in a local SQLite file named `cord-auth.sqlite`. A host must provide persistent storage for that file or account records can be lost when the service restarts or redeploys. Configure `LOGIN_INVITE_CODES` in the host's private environment settings; never put real invite codes in source control.

The current free Render service does not provide a persistent disk, so this SQLite setup is suitable for local testing but needs durable database storage before relying on hosted accounts.
