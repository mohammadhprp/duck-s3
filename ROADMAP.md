# S3 GUI Client 

> Roadmap (MVP → Production)

# 1. Project Foundation

## Goals

* Native-feeling macOS app
* Modern UI
* S3-compatible support
* Fast browsing
* Simple UX
* Internal-tool quality first

---

## Tech Stack

### Desktop

* Tauri v2

### Frontend

* React
* TypeScript
* Vite

### UI

* TailwindCSS
* shadcn/ui
* Lucide icons

### Data

* TanStack Query
* Zustand

### S3

* AWS SDK v3

### Optional

* react-dropzone
* react-virtualized / tanstack virtual

---

# 2. Phase 0 — Setup

## TODO

* [x] Create Tauri app
* [x] Configure React + TypeScript
* [x] Install Tailwind
* [x] Setup shadcn/ui
* [x] Setup ESLint + Prettier
* [x] Setup folder structure
* [x] Configure dark mode
* [x] Create app layout shell

---

## Folder Structure

```text
src/
├── components/
├── features/
│   ├── auth/
│   ├── buckets/
│   ├── explorer/
│   ├── uploads/
│   └── settings/
├── hooks/
├── services/
│   └── s3/
├── stores/
├── types/
└── pages/
```

---

# 3. Phase 1 — Connection System

## Goal

User can connect to S3-compatible storage.

---

## MVP Features

* [x] Add connection form
* [x] Save credentials locally
* [x] Test connection
* [x] Connect/disconnect
* [x] Multiple profiles

---

## Fields

```text
Connection Name
Endpoint
Region
Access Key
Secret Key
Force Path Style
Use SSL
```

---

## Supported Providers

Start with:

* AWS S3
* MinIO
* Cloudflare R2

Later:

* Backblaze
* Wasabi
* DigitalOcean Spaces

---

## Technical Tasks

* [x] Build S3Client factory
* [x] Handle credential validation
* [x] Handle endpoint normalization
* [x] Add encrypted local storage

---

# 4. Phase 2 — Bucket Browser

## Goal

Display buckets.

---

## Features

* [x] List buckets
* [x] Bucket sidebar
* [x] Refresh buckets
* [x] Search buckets
* [x] Create bucket
* [x] Delete bucket

---

## UI

```text
Sidebar
 ├── Bucket A
 ├── Bucket B
 └── Bucket C
```

---

## Technical Tasks

* [x] listBuckets()
* [x] createBucket()
* [x] deleteBucket()

---

# 5. Phase 3 — Object Explorer (CORE MVP)

## Goal

Browse files like Finder.

---

## Features

* [x] List objects
* [x] Folder navigation
* [x] Breadcrumbs
* [x] File table
* [x] Search current folder
* [x] Sort files
* [x] Refresh current path

---

## Table Columns

* Name
* Size
* Last Modified
* Storage Class

---

## Technical Tasks

* [x] listObjectsV2()
* [x] Prefix handling
* [x] Delimiter handling
* [x] Pagination
* [x] Folder abstraction

---

## Important

S3 folders are fake.

You must convert:

```text
photos/2026/cat.jpg
```

Into:

```text
photos/
  2026/
    cat.jpg
```

---

# 6. Phase 4 — Upload System

## Goal

Upload files smoothly.

---

## MVP Features

* [x] Drag & drop
* [x] Upload file
* [x] Upload folder
* [x] Upload progress
* [x] Cancel upload
* [x] Retry upload

---

## Technical Tasks

* [x] Multipart upload
* [x] Progress tracking
* [x] Upload queue
* [x] Concurrent uploads

---

## Important

This becomes the hardest part quickly.

Keep MVP simple:

* no resumable uploads yet
* no background daemon yet

---

# 7. Phase 5 — Download System

## Features

* [X] Download file
* [X] Download folder
* [X] Progress tracking
* [X] Open in Finder

---

## Technical Tasks

* [X] Stream downloads
* [X] Handle large files
* [X] Save dialog integration

---

# 8. Phase 6 — File Actions

## Features

* [x] Delete object
* [x] Rename object
* [x] Move object
* [x] Copy object
* [x] Create folder
* [x] Bulk select

---

## Technical Tasks

Remember:

* rename = copy + delete
* move = copy + delete

S3 has no real rename.

---

# 9. Phase 7 — File Preview

## Goal

Preview common files.

---

## MVP Preview Types

* [x] Images
* [x] JSON
* [x] Text
* [x] PDF

---

## Technical Tasks

* [x] S3 GetObject body streaming (via Tauri command)
* [x] Base64 encoding & transfer
* [x] Preview modal
* [x] Single-click file preview

---

# 10. Phase 8 — Polishing

## UX Features

* [ ] Keyboard shortcuts
* [ ] Command palette
* [ ] Context menus
* [ ] Right-click actions
* [ ] Double-click navigation
* [ ] Multi-tab support

---

## Performance

* [ ] Virtualized lists
* [ ] Infinite scrolling
* [ ] Caching
* [ ] Debounced search

---

## Error Handling

* [ ] Network errors
* [ ] Expired credentials
* [ ] Permission errors
* [ ] Upload failures

---

# 11. Phase 9 — macOS Native Feel


## Features

* [ ] Native menus
* [ ] Native notifications
* [ ] Spotlight-like search
* [ ] Finder integration
* [ ] Drag from Finder
* [ ] Native file dialogs

---

# 12. Phase 10 — Security

## MUST HAVE

* [ ] Encrypt credentials
* [ ] Never log secrets
* [ ] Secure local storage
* [ ] Validate endpoints

---

## Optional

* [ ] Keychain integration
* [ ] Session locking
* [ ] Biometric unlock

---

# 13. Phase 11 — Advanced Features

## Optional Future

* [ ] Presigned URLs
* [ ] Bucket policies
* [ ] IAM explorer
* [ ] Object tagging
* [ ] Lifecycle rules
* [ ] Versioning
* [ ] CDN integration
* [ ] Object diff viewer
* [ ] Image optimization
* [ ] SQL querying
* [ ] Local sync

---

# 14. Recommended MVP Scope

## BUILD THIS FIRST

### Authentication

* [ ] Add connection
* [ ] Save connection

### Explorer

* [ ] Bucket list
* [ ] Browse files
* [ ] Breadcrumbs

### File Operations

* [ ] Upload
* [ ] Download
* [ ] Delete

### UX

* [ ] Drag/drop
* [ ] Progress bars
* [ ] Dark mode

---

# 15. DO NOT BUILD YET

Avoid:

* IAM management
* ACL editor
* Lifecycle editor
* Versioning
* Resumable sync
* Background daemon
* Terminal integration
* Real-time sync
* Collaboration

These kill momentum.

---

# 16. Suggested Timeline

## Weekend MVP

* Setup
* Connection system
* Bucket explorer
* Basic upload/download

---

## Week 1

* Better UI
* Progress tracking
* Drag/drop
* File actions

---

## Week 2

* Preview system
* Performance improvements
* Better error handling

---

# 17. Final MVP Definition

If users can:

* connect to S3
* browse buckets
* upload files
* download files
* delete files


