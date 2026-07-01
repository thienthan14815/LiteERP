# Database Architecture

Version: 1.0

---

# Overview

This project uses a lightweight architecture designed for:

- Personal usage
- AI Agent integration
- Easy backup
- Easy maintenance
- Easy migration

Core Components

```
                +----------------+
                |    Web App     |
                +--------+-------+
                         |
                         |
                         v
                +----------------+
                |   SQLite DB    |
                +--------+-------+
                         |
          +--------------+--------------+
          |                             |
          |                             |
          v                             v
  Google Drive API              AI Agent Service
          |                             |
          |                             |
          +-------------+---------------+
                        |
                        v
                Google Drive Storage
```

---

# Responsibilities

## Web Application

Responsible for

- CRUD
- User Interface
- Image Preview
- Authentication
- API

Never directly manipulate Google Drive files manually.

Everything should go through services.

---

## SQLite

SQLite stores

- users
- products
- customers
- suppliers
- orders
- logs
- settings
- Google Drive File IDs

SQLite never stores

- images
- pdf
- excel
- binary files

SQLite is considered the source of truth for metadata.

---

## Google Drive

Google Drive stores

- images
- receipts
- invoices
- pdf
- excel
- backup database

Google Drive is NOT the database.

Google Drive acts as Object Storage.

---

## AI Agent

Agent responsibilities

- Query SQLite
- Generate SQL
- Insert records
- Update records
- Read images via Google Drive
- Generate reports
- Classify documents
- OCR receipts
- Summarize invoices

Agent never edits SQLite directly.

Agent always uses the Data Access Layer.

---

# Folder Structure

```
project/

├── app/
│
├── database/
│   ├── app.sqlite
│   ├── migrations/
│   ├── backup/
│   └── schema.sql
│
├── drive/
│   ├── upload.py
│   ├── download.py
│   ├── sync.py
│   └── auth.py
│
├── repository/
│   ├── order_repository.py
│   ├── customer_repository.py
│   ├── supplier_repository.py
│   └── file_repository.py
│
├── services/
│   ├── order_service.py
│   ├── file_service.py
│   └── drive_service.py
│
├── api/
│
├── uploads/
│
└── docs/
```

---

# Layer Architecture

```
Browser

↓

API

↓

Service Layer

↓

Repository Layer

↓

SQLite
```

Only Repository may access SQLite.

Never allow API to execute SQL directly.

---

# Google Drive Flow

Upload

```
User

↓

Web App

↓

Drive Service

↓

Google Drive

↓

Receive File ID

↓

Store File ID into SQLite

↓

Return Thumbnail URL
```

---

# Image Flow

```
User opens Order

↓

SQLite returns

drive_file_id

↓

Drive Service

↓

Generate thumbnail URL

↓

Browser renders image
```

---

# Database Flow

Create Order

```
Browser

↓

POST /orders

↓

Order Service

↓

Repository

↓

SQLite
```

Update Order

```
Browser

↓

PUT /orders

↓

Service

↓

Repository

↓

SQLite
```

---

# File Flow

Upload Image

```
Browser

↓

POST /upload

↓

Google Drive API

↓

File Uploaded

↓

Drive File ID

↓

SQLite

↓

Return Success
```

---

# Repository Pattern

Every table owns one repository.

Example

```
CustomerRepository

SupplierRepository

OrderRepository

FileRepository

ProductRepository
```

Repository is the only layer allowed to execute SQL.

---

# Service Pattern

Business logic belongs here.

Example

```
Create Order

↓

Generate Order Code

↓

Validate Customer

↓

Insert Order

↓

Upload Images

↓

Save File IDs

↓

Commit
```

Business logic never belongs in Repository.

---

# Entity Relationship

```
Customer

↓

Orders

↓

Order Items

↓

Files
```

```
Supplier

↓

Purchase Orders

↓

Files
```

```
Product

↓

Files
```

Every entity may own multiple files.

---

# Google Drive Structure

```
Google Drive

app-storage/

    database/

        app.sqlite

    backup/

        app-20250501.sqlite

    uploads/

        orders/

        products/

        suppliers/

        customers/

        invoices/

        receipts/
```

---

# Synchronization

Application starts

↓

Download latest SQLite

↓

Open database

↓

Work locally

↓

Backup

↓

Upload latest SQLite

Never edit SQLite directly inside Google Drive.

Always work locally.

---

# Transaction Strategy

Every operation should use transactions.

```
BEGIN

Insert Order

Insert Items

Insert Files

COMMIT
```

Rollback on failure.

---

# Logging

Every important action

Create log.

```
Create Order

Delete Product

Upload Image

Backup Database

Restore Database

Sync Drive
```

---

# Backup Strategy

Before synchronization

```
backup/

app_20250523.sqlite
```

Keep

Last 30 backups.

---

# Security

Never expose

Google Drive File ID

OAuth Token

SQLite Path

Internal SQL

to frontend.

Frontend only receives

```
thumbnail_url

preview_url
```

---

# Scalability

Current

```
SQLite

↓

Google Drive
```

Future

```
PostgreSQL

↓

AWS S3

↓

Redis

↓

Queue

↓

Microservices
```

Application code should require minimal changes.

---

# Design Principles

Single Responsibility

Every layer has one responsibility.

Repository

↓

Database only

Service

↓

Business Logic only

Drive Service

↓

Google Drive only

API

↓

HTTP only

UI

↓

Presentation only

---

# AI Agent Rules

Agent may

- Read data
- Query SQL
- Create SQL migration
- Create reports
- Upload files
- Read Google Drive
- Generate summaries

Agent must NOT

- Delete production data
- Rename tables
- Drop schema
- Execute destructive SQL

without explicit user confirmation.

---

# Engineering Philosophy

SQLite is the metadata engine.

Google Drive is the file storage.

Repository controls data access.

Services implement business logic.

AI Agent interacts through Services.

This separation ensures the system remains maintainable, testable, and scalable.

Tôi đề xuất nâng cấp thêm một chút

Nếu mục tiêu của bạn là xây dựng một hệ thống để AI Agent có thể phát triển cùng trong nhiều năm, thì tôi sẽ thêm 2 layer nữa vào kiến trúc.

Browser / React

        │

        ▼

API (FastAPI)

        │

        ▼

Service Layer
(Business Logic)

        │

        ▼

Repository Layer
(SQLAlchemy / sqlite3)

        │

        ▼

SQLite
        │
        ├───────────────┐
        │               │
        ▼               ▼
Google Drive      Vector DB (tương lai)
(Image/File)      (Chroma/Qdrant)

        │
        ▼

AI Agent
(OpenAI / Claude / Gemini)