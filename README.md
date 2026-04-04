# Social DM Copilot

AI-powered direct message management for Stockland real estate teams. Manage inbox, generate draft responses, capture leads, and ensure compliance with Australian privacy regulations.

## Tech Stack

- **Framework:** Next.js 14 (App Router) with React 18
- **Language:** JavaScript (ES2022+)
- **Styling:** Tailwind CSS 3 with custom brand, accent, and neutral color palette
- **Data Layer:** IndexedDB via [idb](https://github.com/jakearchibald/idb) with AES-GCM encryption (Web Crypto API + PBKDF2)
- **State Management:** React Context API (Auth, DM, Draft, Lead, Notification, Audit, Event)
- **Build:** Static export (`next build` → `out/`)
- **Deployment:** Vercel (static)

## Getting Started

### Prerequisites

- Node.js 18+ and npm 9+

### Installation

```bash
npm install
```

### Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_APP_NAME` | Application name displayed in the UI | `Social DM Copilot` |
| `NEXT_PUBLIC_CONFIDENCE_THRESHOLD` | Minimum confidence score (0–1) for AI-generated reply suggestions | `0.7` |
| `NEXT_PUBLIC_SLA_MINUTES` | SLA response time target in minutes | `30` |
| `NEXT_PUBLIC_ENCRYPTION_KEY_SEED` | Seed used for client-side encryption of sensitive data | _(required)_ |

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
```

Produces a static export in the `out/` directory.

### Start (Production Preview)

```bash
npm start
```

### Lint

```bash
npm run lint
```

## Folder Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── layout.jsx              # Root layout with context providers
│   ├── page.jsx                # Home / Dashboard page
│   ├── login/page.jsx          # Login page
│   ├── inbox/page.jsx          # DM Inbox workspace
│   ├── leads/page.jsx          # Lead management page
│   ├── notifications/page.jsx  # Notification center page
│   ├── audit/page.jsx          # Audit log viewer page
│   ├── globals.css             # Global styles and Tailwind layers
│   ├── loading.jsx             # Global loading state
│   ├── error.jsx               # Global error boundary
│   └── not-found.jsx           # 404 page
├── components/
│   ├── common/                 # Reusable UI primitives
│   │   ├── Button.jsx
│   │   ├── ConfidenceMeter.jsx
│   │   ├── EmptyState.jsx
│   │   ├── LoadingSpinner.jsx
│   │   ├── Modal.jsx
│   │   ├── PlatformIcon.jsx
│   │   ├── SearchFilter.jsx
│   │   ├── StatusBadge.jsx
│   │   ├── Toast.jsx
│   │   └── Tooltip.jsx
│   ├── compliance/             # Privacy and compliance components
│   │   ├── AuditLogViewer.jsx
│   │   ├── ComplianceBanner.jsx
│   │   └── ConsentCheckbox.jsx
│   ├── draft/                  # Draft generation and review components
│   │   ├── DraftComposer.jsx
│   │   ├── DraftEditor.jsx
│   │   ├── DraftPreview.jsx
│   │   └── ReviewActions.jsx
│   ├── inbox/                  # DM inbox components
│   │   ├── ContextPanel.jsx
│   │   ├── DMDetailView.jsx
│   │   ├── DMListItem.jsx
│   │   └── InboxPanel.jsx
│   ├── lead/                   # Lead capture and scoring components
│   │   ├── LeadCaptureSidebar.jsx
│   │   ├── LeadForm.jsx
│   │   ├── LeadScoreBadge.jsx
│   │   └── SalesforceButton.jsx
│   ├── notifications/          # Notification components
│   │   ├── NotificationBell.jsx
│   │   ├── NotificationItem.jsx
│   │   └── NotificationPanel.jsx
│   ├── Dashboard.jsx           # Dashboard overview with metrics
│   ├── Header.jsx              # Application header with navigation
│   └── Sidebar.jsx             # Collapsible sidebar navigation
├── contexts/                   # React Context providers
│   ├── AuthContext.jsx
│   ├── AuditContext.jsx
│   ├── DMContext.jsx
│   ├── DraftContext.jsx
│   ├── EventContext.jsx
│   ├── LeadContext.jsx
│   └── NotificationContext.jsx
├── data/                       # Static mock data and templates
│   ├── draft-templates.json    # 28 draft response templates
│   ├── knowledge-base.json     # 18 properties and 20 FAQs
│   ├── mock-dms.json           # 25 mock DMs
│   └── mock-leads.json         # 25 mock leads
├── hooks/                      # Custom React hooks
│   ├── useDebounce.js
│   ├── useLocalStorage.js
│   └── useNotifications.js
├── repositories/               # IndexedDB data access layer
│   ├── db.js                   # Database schema and initialization
│   ├── audit-log-repository.js
│   ├── dm-repository.js
│   ├── draft-repository.js
│   ├── lead-repository.js
│   └── notification-repository.js
├── services/                   # Business logic services
│   ├── audit-log-service.js
│   ├── compliance-service.js
│   ├── context-retrieval-service.js
│   ├── dm-inbox-service.js
│   ├── draft-generation-service.js
│   ├── draft-review-service.js
│   ├── event-publisher.js
│   ├── lead-extraction-service.js
│   ├── lead-scoring-service.js
│   ├── notification-service.js
│   ├── salesforce-sync-service.js
│   └── sla-monitor-service.js
└── utils/                      # Shared utilities
    ├── constants.js
    ├── encryption.js
    ├── formatters.js
    ├── pii-filter.js
    └── validators.js
```

## Features

### Unified DM Inbox (FR-001)

Paginated DM list with sender info, platform icon, status badge, timestamp, and content preview. Supports debounced text search, platform filter, status filter, and sort options. DM selection with visual highlight and keyboard navigation. Unread and escalated DM visual indicators.

### Context Retrieval (FR-002)

Keyword extraction and matching against the knowledge base (18 properties and 20 FAQs). Relevance scoring and ranking for matched context items. Property context cards with key details, features, and relevance scores. FAQ context cards with expandable answers and category badges. In-memory context cache with 10-minute TTL.

### Draft Generation with Confidence Scoring (FR-003 / FR-008)

Simulated RAG + GPT draft generation using template matching and context filling. 28 draft templates across availability, pricing, property, general, showings, and process categories. Confidence score calculation (0–1) based on property match quality, FAQ relevance, template fit, inquiry clarity, sentiment, and lead score. Confidence meter with color-coded progress bar and threshold indicator. Low-confidence warning banner requiring mandatory human review.

### Human Review Workflow (FR-004)

Draft editor with editable textarea, character count, undo/redo, and real-time validation. Edit history tracking with restore capability. Approve & Send action with low-confidence blocking. Reject action with optional reason and confirmation modal. Draft status state machine: generated → edited → approved/rejected.

### Lead Extraction and Capture (FR-005)

Pattern-based extraction of structured lead data from DM content (email, phone, budget, location, intent, bedrooms, property interests, urgency). Lead capture sidebar with auto-filled and editable form fields. Extraction confidence scoring based on field completeness. Incomplete lead flagging for manual entry.

### Lead Scoring (FR-005)

Rule-based lead scoring (0–100) evaluating declared intent, engagement signals, budget, location match, extraction confidence, sentiment, and urgency. No demographic-based scoring per NFR-004. Priority labels: Hot (≥80), Warm (≥50), Cold (<50). Automatic high-priority lead notification on score ≥80.

### Simulated Salesforce Sync (FR-005)

Simulated Salesforce CRM API with async delay and configurable failure rate. Circuit breaker pattern: disables sync after 5 consecutive failures, auto-resumes after 5-minute cooldown. Retry logic with exponential backoff (up to 3 attempts per sync). Sync status indicator with Salesforce record ID display.

### Notification Center (FR-007)

High-priority lead alert notifications with lead score badge. SLA breach warning notifications with elapsed time display. Notification bell icon with unread count badge and animated ring. Notification panel with type filter, read status filter, and pagination. Mark as read and dismiss actions.

### SLA Monitoring

Periodic SLA breach monitoring with configurable interval. DM response time tracking against configurable SLA target (default 30 minutes). Automatic SLA breach notification creation for New DMs exceeding threshold.

### Compliance and Privacy Guardrails

Consent verification before message send (Australian Privacy Act 1988, Spam Act 2003). PII detection in draft content (email, phone, SSN, credit card, name patterns). PII stripping from audit log details before storage. Low-confidence draft review enforcement. Non-compliant action blocking with audit trail logging.

### Audit Logging

Centralized audit log service with timestamped, encrypted entries. PII stripping from all log detail fields before storage. Audit log viewer with entity type, action type, performed by, and entity ID filters. Sort options, pagination, and expandable detail rows. CSV export with browser download trigger.

### Cross-Cluster Event Integration

Client-side event bus (EventPublisher) with publish/subscribe pattern. Cross-cluster event listeners: dm_sent → lead extraction, lead_created → lead scoring, lead_scored → high-priority notification, sla_breach → monitoring.

### Dashboard

Dashboard overview with total DMs, response rate, average response time, leads created, and SLA compliance metrics. DM status breakdown with color-coded badges and distribution bar. Lead score distribution chart (Hot, Warm, Cold). Notification summary with unread count.

## Data Layer

All data is stored client-side in IndexedDB using the [idb](https://github.com/jakearchibald/idb) library. Sensitive fields (DM content, lead PII, draft content, audit details) are encrypted at rest using AES-GCM with a key derived from the `NEXT_PUBLIC_ENCRYPTION_KEY_SEED` environment variable via PBKDF2.

Mock data (25 DMs, 25 leads, 18 properties, 20 FAQs, 28 draft templates) is loaded into IndexedDB on first launch.

## Deployment

The application is configured for static export and Vercel deployment.

```bash
npm run build
```

The `out/` directory can be deployed to any static hosting provider. A `vercel.json` is included for SPA routing on Vercel.

### Vercel

Push to your connected Git repository. Vercel will automatically build and deploy using the `next build` command with `output: 'export'` configured in `next.config.mjs`.

## License

Private — All rights reserved. This software is proprietary and confidential. Unauthorized copying, distribution, or use of this software is strictly prohibited.