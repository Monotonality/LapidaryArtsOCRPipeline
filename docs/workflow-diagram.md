# Workflow Diagram

```mermaid
flowchart TD
    Login["Login
    single shared password"]
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

    Login --> Dash
    Dash -->|query / filter / view| DB
    Dash -->|export CSV| CSV
    CSV --> DB
    Dash -->|new record| Create
    Create --> Photo
    Photo --> OCR
    OCR --> Validate
    Validate -->|reviewed & approved| Create
    Create -->|save verified record| DB
    DB --> Dash
```

## Flow summary

1. **Login** - the app is gated behind a single shared password (no accounts).
2. **Dashboard** - the main screen offers three paths:
   - **View path**: query, filter, and view existing records straight from the database.
   - **Export path**: download the (filtered) records as a CSV file from the database.
   - **Create path**: walk the digitization workflow for a new record.
3. **Photo of physical record** - staff capture the paper invoice.
4. **OCR + AI recommended record** - Transformers.js reads the image and suggests values for the six fields (Client Name, Phone Number, Date, Date Promised, Instructions/Article Details, Price).
5. **Human-in-the-loop validation** - staff review and correct the suggested fields.
6. **Record creation** - the verified record is saved.
7. **Database** - approved records are stored in Supabase and become viewable/queryable back on the dashboard, and exportable to CSV.