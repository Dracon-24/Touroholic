# Touroholic

A full-stack tour discovery and **demo booking** application built with Node.js, Express, MongoDB, Mongoose, and Pug. The frontend uses an ivory, navy, and burnt orange theme, with responsive tour cards, account pages, reviews, and administration screens.

**Bookings do not collect money.** There is no payment provider, card form, or payment API key. A signed-in user can reserve a tour and see it immediately in My bookings. Demo records are stored with `paid: false` and `demo: true`; historical booking records are preserved.

## Requirements

- Node.js **20.19 or newer** and npm
- MongoDB running locally, or an accessible MongoDB connection string
- Optional SMTP or SendGrid credentials for password recovery and welcome email
- Internet access for OpenStreetMap tiles and the optional Google font; the tour-stop list remains available when the map cannot load

## Run locally

From this directory:

```bash
npm ci
cp -n config.env.example config.env
```

Edit `config.env`:

```dotenv
NODE_ENV=development
PORT=3000
DATABASE=mongodb://127.0.0.1:27017/touroholic
JWT_SECRET=your-long-random-secret
JWT_EXPIRES_IN=90d
JWT_COOKIE_EXPIRES_IN=90
EMAIL_DISABLED=true
```

Generate a random secret, for example with `openssl rand -hex 32`, and use that value for `JWT_SECRET`. Keep `config.env` private; it is ignored by Git. The copy command above preserves an existing configuration.

Start MongoDB, then build and start the app:

```bash
npm run build:js
npm run dev
```

Open **http://localhost:3000**. The server waits for its database connection before accepting requests. Change the URL if you set a different port.

To load the included tours, users, and reviews into the configured database:

```bash
npm run seed
```

Seeding inserts missing sample records without replacing existing records. Sample user passwords are already hashed and are imported without hashing them a second time. Create your own account through Sign up instead of relying on sample-user credentials.

## Commands

| Command | Purpose |
| --- | --- |
| `npm start` | Start the server |
| `npm run dev` | Restart the server automatically when source files change |
| `npm run start:prod` | Start with production error handling and security headers |
| `npm run build:js` | Build the browser JavaScript and map assets with Parcel |
| `npm run watch:js` | Rebuild browser assets while developing |
| `npm run lint` | Run ESLint using the current flat configuration |
| `npm test` | Run frontend and controller regression tests |
| `npm run test:integration` | Run HTTP and database integration tests against an isolated local MongoDB |
| `npm run seed` | Insert missing sample records |

Run the browser watcher in a second terminal when editing imported files in `public/js`. The browser build explicitly targets browsers; the Node engine declaration must not turn it into a Node-only bundle.

## Pages and behavior

- `/` — tour overview
- `/tour/:slug` — tour details, stops, map, reviews, and demo booking
- `/signup.html` — account creation and automatic sign-in
- `/login` — login
- `/forgot-password` and `/reset-password/:token` — password recovery
- `/me` — name, email, profile photo, and password settings
- `/my-tours` — the current user's booked tours
- `/my-reviews.html` — create, edit, and delete the current user's reviews
- `/billing` — booking history and demo-payment status
- `/admin/tours`, `/admin/users`, `/admin/reviews`, `/admin/bookings` — administrator tools
- `/about` — information about the demo, browser access, guide roles, and contact

`/signup` and `/my-reviews` redirect to their working pages. The old `/overview.html` and `/tour.html` examples redirect to the live application rather than presenting disconnected sample controls.

### Accounts and email

Signup signs the user in immediately. Welcome-email failure does not roll back account creation or prevent login. The signup page verifies the session before redirecting.

To enable email, set `EMAIL_DISABLED=false` and configure `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USERNAME`, `EMAIL_PASSWORD`, and `EMAIL_FROM`. If both `SENDGRID_USERNAME` and `SENDGRID_PASSWORD` are set, they are used instead of SMTP.

With email disabled, signup and login continue to work, but password recovery reports that email is unavailable. Reset links expire after ten minutes and open a browser form. Set a real sender address when enabling delivery. SMTP delivery depends on the supplied mail service and credentials.

### Administrator access

New accounts always receive the `user` role. To make your own account an administrator, update its role in your configured MongoDB database using MongoDB Compass or mongosh:

```javascript
db.users.updateOne(
  { email: 'your-account@example.com' },
  { $set: { role: 'admin' } }
)
```

Refresh the account page to see the administration links. Only administrators can open these pages. Admins can add/edit tours, edit users and roles, moderate reviews, and remove bookings. New tours use included photography; the tour API also supports image uploads. Public signup is the supported way to create user accounts.

### Reviews and bookings

- Review authorship comes from the authenticated user, not a submitted user ID.
- Users can edit or delete only their own reviews; administrators can moderate reviews.
- Ratings are whole numbers from 1 to 5. One review per user per tour is enforced by a database index.
- Editing or deleting a review recalculates the tour's average rating.
- Demo reservations use the server's tour price and authenticated user ID.
- Repeated or concurrent demo booking requests reuse the reservation. A sparse unique index on `demoKey` protects new demo reservations without rewriting historical bookings.
- Billing shows demo reservations as having collected no payment. Older records retain their original status.

## Project structure

```text
app.js                  Express app, middleware, and route mounting
server.js               Configuration, database connection, and startup
controllers/            Request handlers and application behavior
models/                 Mongoose schemas, indexes, and rating calculations
routes/                 View and API routes
views/                  Pug page and email templates
public/css/             Shared theme and responsive styles
public/js/              Browser source and standalone page scripts
public/js/dist/         Generated browser bundle and map assets
public/img/             Logos, icons, users, and tour photographs
scripts/                Frontend build tooling
utils/                  Errors, email, query helpers, and request validation
dev-data/data/          Sample data and importer
tests/                  Regression tests
tests/integration/      Isolated HTTP/MongoDB integration tests
```

## API overview

The API is mounted under `/api/v1` and accepts JSON. Login/signup set an HTTP-only session cookie; protected API requests may also use `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/users/signup` | Register and sign in |
| POST | `/users/login` | Sign in |
| GET | `/users/logout` | Sign out |
| GET | `/users/me` | Read the signed-in account |
| PATCH | `/users/updateMe` | Update name, email, and optional multipart photo |
| PATCH | `/users/updateMyPassword` | Change password using the current password |
| POST | `/users/forgotPassword` | Request a recovery email |
| PATCH | `/users/resetPassword/:token` | Reset a password and sign in |
| GET | `/tours` and `/tours/:id` | Browse tours |
| POST | `/bookings/demo/:tourId` | Reserve a tour without payment |
| GET/POST | `/reviews` | List or create reviews |
| PATCH/DELETE | `/reviews/:id` | Edit or remove a permitted review |

Administrator CRUD routes also exist for tours, users, reviews, and bookings. Tour lists support pagination, selected fields, sorting, and comparison filters such as `price[gte]=100`. Upload limits are 5 MB for user photos and 10 MB per tour image.

## Tests

Build before running the regression suite, because one test executes the generated browser bundle:

```bash
npm run build:js
npm run lint
npm test
```

For integration tests, run a **separate** MongoDB process on port 27019 in another terminal:

```bash
mkdir -p /tmp/touroholic-test-db
mongod --dbpath /tmp/touroholic-test-db --port 27019 --bind_ip 127.0.0.1
```

Then:

```bash
npm run test:integration
```

The suite creates a database named `touroholic_test_<process-id>` and drops only that database afterward. It does not use the application's `DATABASE` setting. Mail is disabled during these tests, and all accounts, tours, reviews, and reservations are disposable fixtures.

Tests cover cookie authentication, signup without email, tour updates and slugs, concurrent demo booking, review ownership and aggregate ratings, account updates, reset tokens, access to admin pages, frontend error recovery, and navigation.

## Troubleshooting

- **Database connection fails:** start MongoDB or correct `DATABASE`. The app does not start serving requests until the connection succeeds.
- **Changes do not appear:** run `npm run build:js`, restart the server for backend/template route changes, and hard-refresh the browser.
- **Password reset email is unavailable:** configure a mail service and set `EMAIL_DISABLED=false`.
- **Map tiles do not load:** check internet access. Tile images send the app origin as their Referer to comply with OpenStreetMap's tile policy, while other requests retain the application's referrer policy. If an older bundle shows “Access blocked,” rebuild and hard-refresh. Tour stops and external map links remain available. No map API key is required.
- **No tours are listed:** run `npm run seed` against the intended database or add tours through an administrator account.
- **Demo booking does not save:** ensure you are logged in and MongoDB is connected. No payment setup is needed.

The optional command `node dev-data/data/import-dev-data.js --delete --confirm-delete` deletes **all** tours, users, reviews, and bookings from the configured database. It is not needed for normal setup.
