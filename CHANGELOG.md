# Changelog

All notable changes to the Social DM Copilot project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - 2024-12-15

### Added

#### Unified DM Inbox (FR-001 / SCRUM-6529)
- DM ingestion from mock data with IndexedDB persistence
- Paginated DM list with sender info, platform icon, status badge, timestamp, and content preview
- Search and filter bar with debounced text search, platform filter, status filter, and sort options
- DM selection with visual highlight and keyboard navigation
- Unread (New) and escalated DM visual indicators
- Status badge counts in inbox header
- Responsive multi-panel layout with collapsible sidebar

#### Context Retrieval (FR-002 / SCRUM-6531)
- Keyword extraction and matching against knowledge base (properties and FAQs)
- Relevance scoring and ranking for matched context items
- Property context cards with key details, features, and relevance scores
- FAQ context cards with expandable answers and category badges
- In-memory context cache with 10-minute TTL
- Context panel integrated into DM detail view

#### Draft Generation with Confidence Scoring (FR-003 / SCRUM-6530, FR-008 / SCRUM-6535)
- Simulated RAG + GPT draft generation using template matching and context filling
- 28 draft templates across availability, pricing, property, general, showings, and process categories
- Template selection based on inquiry type, keyword overlap, and property context
- Placeholder filling with sender name, property details, budget, and location data
- Confidence score calculation (0–1) based on property match quality, FAQ relevance, template fit, inquiry clarity, sentiment, and lead score
- Confidence meter component with color-coded progress bar (red/yellow/green) and threshold indicator
- Low-confidence warning banner requiring mandatory human review
- Insert Property Info modal for adding property details into drafts
- Suggested next steps display with insert capability
- Draft regeneration action

#### Human Review Workflow (FR-004 / SCRUM-6532)
- Draft editor with editable textarea, character count, undo/redo, and real-time validation
- Edit history tracking with restore capability
- Approve & Send action with low-confidence blocking (drafts below threshold must be edited first)
- Reject action with optional reason and confirmation modal
- Draft status state machine: generated → edited → approved/rejected
- DM status automatically updated to Sent on draft approval
- Review actions component with conditional rendering based on draft status and confidence
- Draft preview component with read-only display, context attribution, and status indicators

#### Lead Extraction and Capture (FR-005 / SCRUM-6537)
- Pattern-based extraction of structured lead data from DM content (email, phone, budget, location, intent, bedrooms, property interests, urgency)
- Lead capture sidebar with auto-filled and editable form fields
- Extraction confidence scoring based on field completeness
- Incomplete lead flagging for manual entry
- Lead enrichment from knowledge base context
- Batch lead extraction support
- Lead form component with real-time field-level validation, auto-fill indicator, and keyboard shortcuts

#### Lead Scoring (FR-005 / SCRUM-6539)
- Rule-based lead scoring (0–100) evaluating declared intent, engagement signals, budget, location match, extraction confidence, sentiment, and urgency
- No demographic-based scoring per NFR-004
- Priority labels: Hot (≥80), Warm (≥50), Cold (<50)
- Lead score badge component with color coding and priority flag icon
- Score breakdown display with per-component visualization
- Batch scoring and re-scoring support
- Automatic high-priority lead notification on score ≥80

#### Simulated Salesforce Sync (FR-005 / SCRUM-6538)
- Simulated Salesforce CRM API with async delay and configurable failure rate
- Sync button with confirmation dialog, loading state, and success/error feedback
- Circuit breaker pattern: disables sync after 5 consecutive failures, auto-resumes after 5-minute cooldown
- Retry logic with exponential backoff (up to 3 attempts per sync)
- Sync status indicator (success, failed, pending) with Salesforce record ID display
- Batch sync and retry-all-failed support
- Circuit breaker warning display in UI

#### Notification Center (FR-007 / SCRUM-6540, SCRUM-6541)
- High-priority lead alert notifications with lead score badge
- SLA breach warning notifications with elapsed time display
- Notification bell icon with unread count badge and animated ring
- Notification panel with type filter, read status filter, and pagination
- Mark as read (single and bulk) and dismiss actions
- Notification item component with type icon, message, timestamp, linked entity badges, and action buttons
- Dropdown panel from header bell with click-outside-to-close

#### SLA Monitoring (SCRUM-6534, SCRUM-6541)
- Periodic SLA breach monitoring with configurable interval
- DM response time tracking against configurable SLA target (default 30 minutes)
- Automatic SLA breach notification creation for New DMs exceeding threshold
- SLA warning detection for DMs approaching threshold
- Integration with EventPublisher for breach event dispatch
- Monitoring status reporting (active, check count, breach count)

#### Compliance and Privacy Guardrails (SCRUM-6533, SCRUM-6536)
- Consent verification before message send (Australian Privacy Act 1988, Spam Act 2003)
- PII detection in draft content (email, phone, SSN, credit card, name patterns)
- PII stripping from audit log details before storage
- Compliance banner with status indicator, consent display, PII warnings, and regulatory references
- Consent checkbox with legal references tooltip and blocked send warning
- Low-confidence draft review enforcement (blocks approval without edit)
- Non-compliant action blocking with audit trail logging
- Compliance rules display with expandable details

#### Audit Logging (SCRUM-6536, SCRUM-6542)
- Centralized audit log service with timestamped, encrypted entries
- PII stripping from all log detail fields before storage
- Audit log viewer with entity type, action type, performed by, and entity ID filters
- Sort options, pagination, and expandable detail rows
- CSV export with browser download trigger
- Entity-specific convenience logging methods (DM, draft, lead, notification, sync)
- Batch logging support

#### Cross-Cluster Event Integration (SCRUM-6528, SCRUM-6533, SCRUM-6534)
- Client-side event bus (EventPublisher) with publish/subscribe pattern
- Cross-cluster event listeners: dm_sent → lead extraction, lead_created → lead scoring, lead_scored → high-priority notification, sla_breach → monitoring
- Event history buffer for debugging
- Convenience publish methods for all event types

#### Dashboard and Navigation
- Dashboard overview with total DMs, response rate, average response time, leads created, and SLA compliance metrics
- DM status breakdown with color-coded badges and distribution bar
- Lead score distribution chart (Hot, Warm, Cold)
- Notification summary with unread count
- Header with navigation links, notification bell, user info, and responsive mobile menu
- Collapsible sidebar with navigation icons, notification badge, and user info
- Login page with username and role selection
- Dedicated pages for inbox, leads, notifications, and audit log

#### Common UI Components
- Button component with primary, secondary, danger, and ghost variants
- Loading spinner with configurable size, color, and label
- Empty state component with icon, description, and action button
- Toast notification with auto-dismiss, progress bar, and pause-on-hover
- Tooltip with configurable position, delay, and ARIA support
- Modal with focus trap, scroll lock, and keyboard accessibility
- Status badge with color-coded dot indicator
- Platform icon (Facebook, Instagram) with badge styling
- Search filter bar with debounced input and dropdown filters
- Confidence meter with color-coded progress bar

#### Data Layer
- IndexedDB schema with stores for DMs, drafts, leads, notifications, and audit logs
- Encrypted storage for sensitive fields (DM content, lead PII, draft content, audit details)
- AES-GCM encryption with PBKDF2 key derivation from environment seed
- Repository layer with CRUD operations, filtering, sorting, and pagination
- Mock data: 25 DMs, 25 leads, 18 properties, 20 FAQs, 28 draft templates

#### Application Infrastructure
- Next.js 14 with App Router and static export
- React 18 with Context API for state management (Auth, DM, Draft, Lead, Notification, Audit, Event)
- Tailwind CSS with custom brand, accent, and neutral color palette
- Custom hooks: useDebounce, useLocalStorage, useNotifications
- Input sanitization and XSS prevention utilities
- PII detection and filtering utilities
- Validation utilities for lead data, draft content, and consent status
- Formatting utilities for timestamps, currency, confidence scores, and lead scores