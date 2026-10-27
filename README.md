# CampusLoop

CampusLoop is a MERN campus community app where students can share updates, ask questions, post event and Lost & Found information, and list items in a marketplace.

This guide describes the features currently implemented in the repository, how to run the app locally, how to configure its services, and the current limitations.

## Product overview

### Problem statement

Campus information is often scattered across chats, noticeboards, and social networks. Students need one campus-focused place to find timely updates, ask questions, discover events, reunite with lost items, and exchange goods.

### Target users

Students in a college or university community. A deployment can optionally restrict registration to approved email domains.

### Solution and core workflows

CampusLoop combines a public, searchable community feed with signed-in workflows:

1. Browse posts, search by text or author, and narrow results by category.
2. Create an account, sign in, and publish a categorized post with optional photos.
3. Reply to a post to ask a follow-up or share useful information.
4. List a fixed-price marketplace item, choose cash and/or UPI, and let the first buyer claim or reserve it.

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology](#technology)
- [Project layout](#project-layout)
- [Requirements](#requirements)
- [Local setup](#local-setup)
- [Configuration](#configuration)
- [Using CampusLoop](#using-campusloop)
- [Image uploads](#image-uploads)
- [Marketplace](#marketplace)
- [Replies](#replies)
- [API reference](#api-reference)
- [Validation and checks](#validation-and-checks)
- [Deployment and submission](#deployment-and-submission)
- [Troubleshooting](#troubleshooting)
- [Current limitations and next steps](#current-limitations-and-next-steps)

## Features

### Community feed

- Public feed that can be browsed without signing in.
- Category filters: General, Announcements, Questions, Events, Marketplace, and Lost & Found.
- Keyword search across post titles, content, and author names; results can be combined with a category filter.
- New posts appear first, with paginated loading for older results.
- Loading, empty, and error states.
- Post titles are limited to 3–100 characters; post content is limited to 1–2,000 characters.
- Posting requires a signed-in account.

### Accounts and sessions

- Create an account with an email address, display name, and password.
- Sign in and sign out.
- Passwords are hashed with bcryptjs before storage.
- The server sets an authentication JWT cookie configured as HttpOnly.
- The client checks the current session when the app loads.
- Optional email-domain restriction through `ALLOWED_EMAIL_DOMAINS`.
- Auth registration and login endpoints use rate limiting.

### Images

- Attach up to four images to Announcements, Events, Marketplace, and Lost & Found posts.
- JPEG, PNG, and WebP images are supported; each file is limited to 5 MB.
- Image bytes are stored outside MongoDB. MongoDB stores image URLs and metadata.
- Storage uses Cloudinary when all Cloudinary environment variables are configured; otherwise it falls back to local files in `server/uploads/`.
- Post images preserve their aspect ratio in the feed.

### Marketplace

- Marketplace posts require a selling price in Indian rupees; enter `0` for Free.
- Sellers set a fixed price and choose cash, UPI, or both. Choosing UPI requires the seller's UPI ID as a private manual-settlement reference.
- A listing can only be purchased by someone other than its seller. The first successful purchase request locks it against competing buyers.
- Free-item claims and cash purchases complete immediately. A UPI purchase reserves the listing for five minutes while the buyer completes Razorpay Checkout; if payment is not completed, another buyer can try after the reservation expires.
- The feed refreshes purchase status every five seconds so other viewers see active reservations and sold listings without manually refreshing.
- Razorpay orders are created server-side, verified against Razorpay after checkout, and finalized by a signed webhook if the buyer closes checkout. Late captured payments are sent for a full refund.
- Razorpay collects online payments into the platform account. Seller settlement is manual; the seller's UPI ID is not an automatic payout destination. Cash claims mark the listing sold immediately so the buyer and seller can arrange cash handover.

### Replies

- Signed-in users can reply to posts.
- Replies are collapsed by default; use **See replies** to expand a thread and read or add replies.
- Each reply is limited to 500 characters.

## Technology

- **Client:** React, Vite, Axios, custom responsive CSS, and lucide-react icons
- **Server:** Node.js and Express
- **Database:** MongoDB with Mongoose
- **Authentication:** JWT cookie and bcryptjs password hashing
- **Payments:** Razorpay Orders API, Standard Checkout, server-side verification, and signed webhooks
- **Image storage:** Cloudinary when configured, or local filesystem fallback
- **Uploads:** Multer memory storage
- **Development and checks:** npm, Vite, ESLint, and nodemon

React Router DOM is installed in the client dependencies but is not currently used for app navigation.

## Architecture

The React/Vite client serves the public and authenticated feed and sends credentialed requests through the development proxy. Express provides the API, validates requests, authenticates HttpOnly JWT cookies, and enforces listing ownership and purchase reservations. Mongoose stores users, posts, replies, and payment attempts in MongoDB. Image bytes are stored in Cloudinary when configured or in the server's local uploads directory for development.

For Marketplace purchases, an atomic MongoDB update ensures only one buyer can claim a listing or reserve it for five minutes. Razorpay orders are created on the server; checkout signatures and captured payment amount/order/currency are verified before marking a listing sold. A raw-body webhook has its own HMAC signature validation and finalizes payments if the checkout tab closes. Late captured payments are refunded through Razorpay. The feed requests results in pages and supports search/category filters on the server.

**Settlement limitation:** this implementation uses one platform Razorpay account and manual seller settlement. A seller UPI ID is stored as a private payout reference, but Razorpay does not automatically route checkout funds to that seller. Razorpay account enablement, payment methods, webhook setup, and seller payouts must be completed and tested by the operator before accepting real payments.

## Project layout

```text
campusloop/
  README.md
  .gitignore
  client/
    src/
      api/                 # API client functions
      components/          # Auth form, post form, and post card
      App.jsx
      App.css
      index.css
    vite.config.js          # Development proxy
  server/
    .env.example            # Safe configuration template
    src/
      app.js                # Express app and middleware
      server.js             # Environment loading, DB connection, server startup
      config/               # Database configuration
      controllers/          # Auth and post logic
      middleware/           # Authentication, uploads, limits, error handling
      models/               # User, Post, and purchase-attempt models
      routes/               # Auth and post API routes
      utils/                # Image storage
```

## Requirements

- Node.js and npm
- A MongoDB database. MongoDB Atlas can be used, or another reachable MongoDB deployment.
- Cloudinary credentials are optional for local development. Without them, the server uses local image storage.

## Local setup

Run these commands from the repository root in PowerShell.

### 1. Configure the server

Create a local environment file from the template:

```powershell
Copy-Item .\server\.env.example .\server\.env
```

Edit `server/.env` and provide a valid `MONGODB_URI` and a random `JWT_SECRET` with at least 32 characters. The example value `CHANGE_ME` is deliberately too short; the server refuses to start until you replace it. For Razorpay online payments, configure its key ID, key secret, and webhook secret as well. Keep this file private and do not commit it.

### 2. Install dependencies

In one terminal:

```powershell
Set-Location .\server
npm ci
```

In a second terminal:

```powershell
Set-Location .\client
npm ci
```

### 3. Start the server

In the server terminal:

```powershell
npm run dev
```

The server connects to MongoDB before listening on port 5000 by default. Check the terminal for connection errors.

### 4. Start the client

In the client terminal:

```powershell
npm run dev
```

Open the local URL printed by Vite, normally:

```text
http://localhost:5173
```

The Vite development server proxies `/api` and `/uploads` requests to `http://localhost:5000`.

## Configuration

The server loads `server/.env`. Available variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | Server port; defaults to `5000`. |
| `MONGODB_URI` | Yes | MongoDB connection string and database name. |
| `CLIENT_ORIGIN` | No | Allowed client origin for credentialed CORS; defaults to `http://localhost:5173`. |
| `JWT_SECRET` | Yes | Random secret with at least 32 characters used to sign and verify authentication JWTs. Server startup fails if it is missing or too short. |
| `ALLOWED_EMAIL_DOMAINS` | No | Comma-separated email domains allowed to register. Empty means no domain restriction. |
| `CLOUDINARY_CLOUD_NAME` | No | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | No | Cloudinary API key. |
| `CLOUDINARY_API_SECRET` | No | Cloudinary API secret. |
| `RAZORPAY_KEY_ID` | Online payments | Public Razorpay key ID used to create orders and open Checkout. |
| `RAZORPAY_KEY_SECRET` | Online payments | Private key for server API calls and Checkout signature verification. Never expose it to the client. |
| `RAZORPAY_WEBHOOK_SECRET` | Online payments | Webhook secret configured for `/api/payments/razorpay/webhook`; keep it server-side and separate from the API key secret. |

Example template (replace the MongoDB URI and secret locally):

```env
PORT=5000
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER_HOST/campusloop?retryWrites=true&w=majority
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=CHANGE_ME
ALLOWED_EMAIL_DOMAINS=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
```

Generate a random JWT secret with:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

MongoDB URI notes:

- Replace all example values; do not include angle brackets or quotes.
- URL-encode reserved characters in the database password (for example, `@` becomes `%40`).
- Use a dedicated database user with only the permissions the app needs.
- Configure Atlas network access to allow the machine running the server.
- Never paste real `.env` values into the README or commit them.

For Cloudinary storage, configure all three Cloudinary variables. If they are missing, the app writes local files under `server/uploads/`; local files are ignored by Git. Local uploads are not a durable production storage strategy.

### Vercel client with a separate API server

The client uses relative `/api/...` URLs. The [`client/vercel.json`](./client/vercel.json) rewrites `/api` and `/uploads` through Vercel to the Render API at `https://campusloop-pxwu.onrender.com`, keeping browser requests same-origin so the existing `SameSite=Lax` authentication cookie works. In Vercel, set the project root directory to `client/`; set the Render service's `CLIENT_ORIGIN` to the Vercel site origin after deployment. Configure `NODE_ENV=production` in the API host so authentication cookies use `Secure`.

The Express app trusts one proxy hop for correct client IP handling behind the deployment proxy. Keep the API reachable only through trusted hosting infrastructure where possible.

For Razorpay, create API keys in **Test Mode** and configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on the server (never in `client/.env` or client source); these are required to create orders and open Checkout. Configure `RAZORPAY_WEBHOOK_SECRET` separately for signed webhook finalization if the buyer closes Checkout. Register the public URL `https://<your-api-host>/api/payments/razorpay/webhook` in the Razorpay dashboard using that same webhook secret, enable the `payment.captured` event, and make sure payment auto-capture is enabled for the account. The webhook endpoint validates the unmodified JSON body. Test successful, failed, abandoned, expired-reservation, and webhook-retry flows before switching to live keys. Without the API key ID and secret, UPI purchase attempts return a setup error; cash claims and free items still work.

## Using CampusLoop

1. Open the Vite client URL.
2. Browse the public feed and select a category filter.
3. Register or sign in to create posts, reply, or purchase listings.
4. To create a post, choose a category, enter a title and body, and optionally attach images where supported.
5. For a Marketplace post, enter a fixed price, select cash and/or UPI, and provide a UPI ID if UPI is enabled. Online money is collected into the platform account and must be settled to the seller manually.
6. To reply to a post, expand **See replies** and submit a reply.
7. To purchase, select an accepted payment option and click **Purchase**. Free items and cash purchases complete immediately. A UPI purchase locks the listing for five minutes while Razorpay Checkout is open; other viewers see the reservation and cannot purchase until it expires or the listing is sold.

## Image uploads

- The form supports selecting multiple images for the supported categories.
- Maximum: four images per post, with a maximum size of 5 MB per image.
- Accepted formats are validated from the file contents as JPEG, PNG, or WebP; the filename or browser-provided MIME type is not the validation source.
- On local fallback, image URLs are served by the Express `/uploads` route and proxied by Vite during development.
- For a deployed client/server, configure the hosting and origin so image URLs are reachable from the client. Cloudinary is the intended managed-storage option; verify its credentials and upload behavior in the target environment.

## Marketplace

- A Marketplace listing requires a price. Enter `0` to list an item for Free. Price accepts rupees with paise precision and is limited to ₹100,000.
- Sellers select cash, UPI, or both. An online method requires a UPI ID as the seller's private manual-settlement reference.
- Buyers cannot purchase their own listings. Free-item claims and cash purchases complete immediately.
- A UPI purchase atomically reserves the listing for five minutes, blocking other buyers. If payment is not completed in that time, the listing becomes available again.
- Purchase status refreshes in the feed every five seconds. The server remains authoritative and rejects simultaneous or stale purchase attempts.
- The server creates Razorpay orders and verifies signatures and captured payment details. A signed `payment.captured` webhook finalizes purchases if checkout closes; late captures are sent for a full refund.
- Razorpay collects online payments into the platform account. Seller settlement is manual; a seller UPI ID is not an automatic payout destination. Cash claims mark the listing sold immediately so the buyer and seller can arrange handover.

## Replies

Replies are stored with the post. The feed initially shows a collapsed **See replies (N)** control; expanding it displays the replies and the reply form for signed-in users. Replies support a parent-reply identifier at the API/model level, but the current interface displays replies as a flat list rather than a visually nested conversation.

## API reference

All routes are served by the Express server, normally at `http://localhost:5000`.

### Health

| Method | Route | Authentication | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | No | Returns API status and MongoDB connection state. |

### Authentication

| Method | Route | Authentication | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | No | Register an account; subject to rate limiting and optional domain restrictions. |
| `POST` | `/api/auth/login` | No | Sign in; subject to rate limiting. |
| `POST` | `/api/auth/logout` | No | Clear the authentication cookie. |
| `GET` | `/api/auth/me` | Yes | Return the signed-in user. |

### Posts, images, marketplace, and replies

| Method | Route | Authentication | Description |
| --- | --- | --- | --- |
| `GET` | `/api/posts` | No | List newest posts; optional `category`, `q`, `page`, and `limit` query parameters. Response includes `hasMore`, `page`, and `limit`. Search is a case-insensitive substring match on title, content, and author. |
| `POST` | `/api/posts` | Yes | Create a post. Supports multipart form data with repeated `images` file fields. |
| `POST` | `/api/posts/:id/replies` | Yes | Add a reply. JSON body: `{ "content": "..." }`. |
| `POST` | `/api/posts/:id/purchase` | Yes | Claim a free/cash listing immediately or reserve a UPI listing for five minutes and create a Razorpay order. Body: `{ "paymentMethod": "cash" \| "upi" }`. |
| `POST` | `/api/posts/:id/purchase/verify` | Yes | Verify a Checkout response, confirm the captured payment with Razorpay, and mark the listing sold. |
| `POST` | `/api/payments/razorpay/webhook` | Razorpay HMAC signature | Handle signed `payment.captured` webhooks using the raw body; late payments are refunded. |

Authenticated API calls use the authentication cookie. For Marketplace post creation, multipart fields include required fixed `price` (use `0` for Free), `paymentMethods` as a JSON array such as `["cash","upi"]`, and `payoutUpiId` when UPI is enabled, plus `title`, `content`, `category`, and repeated image fields named `images`. Other categories do not need marketplace fields.

## Validation and checks

Client commands, run from `client/`:

```powershell
npm run build
npm run lint
```

Server startup command, run from `server/`:

```powershell
npm run dev
```

Run `npm test` from `server/` for the Razorpay signature validation unit tests. A successful client build, lint, or unit test run does not by itself verify database connectivity, real Cloudinary uploads, Razorpay account configuration, actual refunds, or complete end-to-end behavior.


```text
Project Name: CampusLoop
Student Name: Atharv Singh
Problem Statement: Campus information is scattered across channels; students need one place for updates, questions, events, Lost & Found, and item exchange.
GitHub Repository: https://github.com/Atharv12-code/campusloop
Deployed Application / Build: https://campusloop-rho.vercel.app/
Demo Video: [add the accessible 3–5 minute video URL]
Tech Stack: React, Vite, Node.js, Express, MongoDB, Mongoose, Razorpay
Major Features: Authenticated community feed, search and category filtering, posts with image uploads, replies, fixed-price marketplace listings, cash/free claims, Razorpay UPI checkout, and five-minute purchase reservations.
```

Record a short walkthrough showing the problem and target users, then demonstrate the major workflows in the working application. Open the repository, deployment, and video links in a private browser window before submitting.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Server exits before listening | Check `MONGODB_URI`, Atlas network access, and the server terminal. The server waits for its database connection before it starts listening. |
| `bad auth` from MongoDB | Verify the database username/password and URL-encode reserved characters in the password. |
| Atlas SRV lookup fails | Check DNS/network access. If necessary, use the non-SRV connection string provided by MongoDB Atlas. |
| Vite reports an `/api` proxy error | Start the server and verify it is listening on port 5000, or update the local proxy if you changed the port. |
| An image upload is rejected | Confirm the category supports images, the file is JPEG/PNG/WebP, each file is no larger than 5 MB, and no more than four images are selected. Check the server terminal for storage-provider errors. |
| A locally uploaded image does not load | Confirm the server is running and the Vite dev server includes the `/uploads` proxy. For deployed setups, ensure the returned image URL is accessible from the browser. |
| Online purchase is unavailable | Configure Razorpay test/live API keys on the server, ensure the seller accepts the selected method, and use a price of at least ₹1.00. |
| Razorpay payment is not confirmed | Check that the Checkout response reaches the server, the payment is captured, API keys match the mode, and the signed `payment.captured` webhook reaches the configured URL. |
| A late payment was refunded | The five-minute reservation expired or another buyer completed the listing before capture; check the Razorpay refund record. |
| Registration rejects an email domain | Check `ALLOWED_EMAIL_DOMAINS`; an empty value allows any valid email domain. |



Demo Video Link- https://drive.google.com/drive/folders/1YMgMJEKHQe3iSrOzZhSfSdnqt1-1JXsX?usp=sharing
