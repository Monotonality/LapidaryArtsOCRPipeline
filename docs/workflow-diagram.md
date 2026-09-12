# Workflow Diagram

```mermaid
flowchart TD
    Login["Login
    email + password"]
    Signup["Signup
    create account"]
    Forgot["Forgot Password"]
    EmailReset["Password Reset Email"]
    Approval["Approval System
    in Dashboard"]
    Dash["Dashboard
    filter / view / query records"]
    DB[("Database
    Supabase")]
    CSV["CSV Export"]

    Create["Record Creation"]
    Validate["Human-in-the-Loop
    Validation & Edit"]
    OCR["OCR + AI
    Recommended Record"]
    Photo["Photo of
    Physical Record"]

    Signup --> Approval
    Approval -->|approved account| Login
    Login -->|forgot password| Forgot
    Forgot --> EmailReset
    EmailReset --> Login
    Login --> Dash

    Dash -->|approve / reject pending signups| Approval
    Dash -->|query / filter / view| DB
    DB -->|feed| CSV
    Dash -->|export| CSV
    Dash -->|new record| Photo
    Photo --> OCR
    OCR --> Validate
    Validate -->|reviewed & approved| Create
    Create -->|save verified record| DB
    DB --> Dash
```

## Flow summary

1. **Login / Signup** - access is gated behind individual email/password accounts (no shared password).
   - **Signup**: a new account is created and goes into a **pending** state until an existing authenticated user approves it.
   - **Login**: only approved accounts can sign in.
2. **Password reset** - from Login, a user can request a password reset, receives a recovery email, sets a new password, and returns to Login.
3. **Approval system** - the Dashboard includes an approval queue showing pending signups; existing authenticated users approve or reject them, which activates or denies the account.
4. **Dashboard** - after login, the main screen offers three paths:
   - **View path**: query, filter, and view existing records straight from the database.
   - **Export path**: download the (filtered) records as a CSV file from the database.
   - **Create path**: walk the digitization workflow for a new record.
5. **Photo of physical record** - staff capture the paper invoice.
6. **OCR + AI recommended record** - Transformers.js reads the image and suggests values for the six fields (Client Name, Phone Number, Date, Date Promised, Instructions/Article Details, Price).
7. **Human-in-the-loop validation** - staff review and correct the suggested fields.
8. **Record creation** - the verified record is saved.
9. **Database** - approved records are stored in Supabase and become viewable/queryable back on the dashboard, and exportable to CSV.