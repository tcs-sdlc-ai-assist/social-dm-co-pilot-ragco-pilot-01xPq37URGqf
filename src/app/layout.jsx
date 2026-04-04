import '@/app/globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { DMProvider } from '@/contexts/DMContext';
import { DraftProvider } from '@/contexts/DraftContext';
import { LeadProvider } from '@/contexts/LeadContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { AuditProvider } from '@/contexts/AuditContext';
import { EventProvider } from '@/contexts/EventContext';
import { APP_NAME } from '@/utils/constants';

/**
 * Root layout metadata for the application
 * Sets page title, description, and viewport configuration
 */
export const metadata = {
  title: APP_NAME,
  description: 'Social DM Copilot — AI-powered direct message management for Stockland real estate teams. Manage inbox, generate draft responses, capture leads, and ensure compliance.',
  viewport: {
    width: 'device-width',
    initialScale: 1,
  },
};

/**
 * Root layout component
 * Wraps all pages with HTML structure, global CSS, font loading,
 * and all context providers required by the application.
 *
 * Provider nesting order (outermost to innermost):
 * 1. AuthProvider — authentication state must be available to all other providers
 * 2. AuditProvider — audit logging is used by most services
 * 3. EventProvider — cross-cluster event bus for integration between services
 * 4. NotificationProvider — notification state for alerts and SLA breaches
 * 5. DMProvider — DM inbox state and context retrieval
 * 6. DraftProvider — draft generation, editing, and review state
 * 7. LeadProvider — lead extraction, scoring, and Salesforce sync state
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Page content rendered by the App Router
 * @returns {React.ReactElement}
 */
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>
          <AuditProvider>
            <EventProvider>
              <NotificationProvider>
                <DMProvider>
                  <DraftProvider>
                    <LeadProvider>
                      {children}
                    </LeadProvider>
                  </DraftProvider>
                </DMProvider>
              </NotificationProvider>
            </EventProvider>
          </AuditProvider>
        </AuthProvider>
      </body>
    </html>
  );
}