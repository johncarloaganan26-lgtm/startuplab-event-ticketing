# Project Structure

## Directory Organization

### Root Level
```
startuplab-business-ticketing/
├── backend/           # Node.js/Express API server
├── frontend/          # React/TypeScript SPA
├── docs/              # Project documentation
├── knowledge base/    # Design assets and reference materials
└── .amazonq/          # AI assistant configuration
```

## Backend Structure (`/backend`)

### Core Directories

**`/controller`** - Business logic handlers
- Event management (events, ticket types, orders)
- Authentication and authorization
- Payment processing (HitPay integration)
- Analytics and reporting
- Notifications and support
- Subscription and plan management
- Organizer and team management

**`/routes`** - API endpoint definitions
- RESTful route handlers for all controllers
- Organized by feature domain
- Middleware integration for auth and permissions

**`/middleware`** - Request processing
- `auth.js` - JWT authentication
- `permissions.js` - Role-based access control

**`/database`** - Data layer
- `db.js` - Supabase client configuration
- SQL schema files for table definitions
- `/migrations` - Database migration scripts with timestamps

**`/utils`** - Shared utilities
- `auditLogger.js` - Compliance and activity tracking
- `emailQuotaManager.js` - Email sending limits per plan
- `encryption.js` - Data security utilities
- `notificationService.js` - Email notification system
- `smtpMailer.js` - Custom SMTP integration
- `planValidator.js` - Subscription feature validation
- `reservationCleanup.js` - Automated ticket reservation expiry

**`/templates`** - Email HTML templates
- Ticket confirmations (online/offline)
- Event invitations
- Google Meet integration
- Notification emails

**`/scripts`** - Maintenance and testing utilities

### Key Files
- `server.js` - Express application entry point
- `schema.sql` - Complete database schema
- `.env` - Environment configuration
- `vercel.json` - Deployment configuration

## Frontend Structure (`/frontend`)

### Core Directories

**`/views`** - Page components organized by user role
- `/Admin` - Platform administration interfaces
- `/Auth` - Login, registration, password reset
- `/Public` - Landing pages, event discovery, public profiles
- `/User` - Organizer dashboard, event management, analytics

**`/components`** - Reusable UI components
- Event cards and feeds
- Organizer profiles
- Pricing plans and upgrade modals
- Support center
- Toast notifications
- Payment gateway settings

**`/context`** - React Context providers
- `UserContext.tsx` - Authentication state
- `ToastContext.tsx` - Global notification system
- `EngagementContext.tsx` - User interaction tracking

**`/services`** - API integration
- `apiService.ts` - Backend API client with typed requests
- `mockData.ts` - Development data fixtures

**`/utils`** - Helper functions
- `eventCategories.ts` - Event classification system
- `pricingPlans.ts` - Subscription tier definitions

**`/supabase`** - Database client
- `supabaseClient.js` - Supabase configuration

**`/public`** - Static assets
- Images and logos
- Hero graphics

### Key Files
- `App.tsx` - Main application component with routing
- `index.tsx` - React application entry point
- `types.ts` - TypeScript type definitions
- `constants.tsx` - Application-wide constants
- `vite.config.ts` - Build configuration
- `tsconfig.json` - TypeScript compiler settings

## Architectural Patterns

### Backend Architecture
- **MVC Pattern**: Controllers handle business logic, routes define endpoints, database layer manages data
- **Middleware Chain**: Authentication → Permissions → Controller → Response
- **Service Layer**: Utility services for cross-cutting concerns (email, audit, encryption)
- **Migration-Based Schema**: Timestamped SQL migrations for version control

### Frontend Architecture
- **Component-Based**: Reusable React components with TypeScript
- **Context API**: Global state management for auth, notifications, engagement
- **View-Based Routing**: Organized by user role (Admin, Auth, Public, User)
- **Service Layer**: Centralized API communication through apiService

### Database Architecture
- **Supabase (PostgreSQL)**: Primary data store
- **Relational Model**: Normalized tables with foreign key constraints
- **Audit Trail**: Comprehensive logging for compliance
- **Soft Deletes**: Archive system for events and data retention

### Key Relationships
```
Users → Organizers → Events → Ticket Types → Orders → Tickets
                  ↓
            Subscriptions → Plans (Free/Professional/Enterprise)
                  ↓
            Email Quotas, Feature Limits
```

### Integration Points
- **HitPay Payment Gateway**: Webhook-based payment processing
- **Supabase Auth**: User authentication and session management
- **SMTP Services**: Email delivery (system default + custom SMTP)
- **QR Code Generation**: Ticket validation system

## Configuration Files

### Backend
- `.env` - Database credentials, API keys, SMTP settings
- `vercel.json` - Serverless deployment configuration
- `package.json` - Dependencies (Express, Supabase, Nodemailer)

### Frontend
- `.env` - API endpoints, Supabase configuration
- `vite.config.ts` - Build tool settings
- `tsconfig.json` - TypeScript strict mode enabled
- `vercel.json` - SPA routing configuration

## Documentation (`/docs`)
- API guides and integration documentation
- System flow analysis
- Feature specifications (promotions, admin plans)
- Development progress tracking
