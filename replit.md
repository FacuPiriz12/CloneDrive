# Overview

This is a full-stack Google Drive file management application called "Clone Drive" built with React, Express.js, and PostgreSQL. The application allows users to authenticate via Replit's OIDC system and copy files/folders from Google Drive shared links to their personal Google Drive. It features a modern UI with shadcn/ui components, real-time copy progress tracking, and a comprehensive file management interface.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client is built with React 18 using TypeScript and Vite as the build tool. The UI leverages shadcn/ui components with Radix UI primitives for accessibility, styled with TailwindCSS using CSS variables for theming. State management uses TanStack Query (React Query) for server state with custom query functions for API communication. Routing is handled by Wouter for lightweight client-side navigation.

## Backend Architecture  
The server uses Express.js with TypeScript in ES module format. It implements a RESTful API architecture with route handlers organized in a centralized routes file. The application uses Passport.js with OpenID Connect strategy for Replit-based authentication, including session management with PostgreSQL session storage.

## Authentication System
Authentication is implemented using Replit's OIDC provider with Passport.js. User sessions are stored in PostgreSQL using connect-pg-simple middleware. The system includes protected routes that verify authentication status and user context propagation throughout the application.

## Database Layer
PostgreSQL database with Drizzle ORM for type-safe database operations. The schema includes user management tables (required for Replit Auth), drive file tracking, copy operations with progress tracking, and session storage. Database migrations are managed through Drizzle Kit with schema versioning.

## File Management System
Integrates with multiple cloud storage providers through dedicated service layers:

### Google Drive Integration
Uses Google Drive API with OAuth2 authentication for secure access. Supports parsing Google Drive URLs to extract file/folder IDs, retrieving file metadata and information, and copying files/folders with progress tracking. Copy operations are managed asynchronously with real-time status updates.

### Dropbox Integration (Manual Setup)
Implemented as a manual alternative to Replit's Dropbox integration. Uses Dropbox SDK for JavaScript with OAuth2 authentication flow. Features include:
- OAuth2 authentication and token management
- File listing, upload, and download operations  
- Shared link generation for file access
- Folder creation and management
- Token storage in database with connection status tracking

**Setup Requirements:**
- DROPBOX_APP_KEY: Application key from Dropbox Developer Console
- DROPBOX_APP_SECRET: Application secret from Dropbox Developer Console
- Redirect URI must be configured in Dropbox app settings

The system stores Dropbox tokens separately from Google Drive tokens, allowing users to connect to both services simultaneously.

## Real-time Features
Implements polling-based real-time updates for copy operation progress using React Query's refetch intervals. Progress tracking includes file counts, completion status, and error handling with user-friendly status displays.

## Development Environment
Configured for Replit development with hot module replacement via Vite. Includes development-specific middleware for error overlay and source mapping. The build process uses esbuild for server bundling and Vite for client optimization.

# External Dependencies

## Core Framework Dependencies
- **React 18**: Frontend framework with TypeScript support
- **Express.js**: Backend web framework with middleware ecosystem
- **Vite**: Build tool and development server with HMR

## Database & ORM
- **PostgreSQL**: Primary database via Neon serverless
- **Drizzle ORM**: Type-safe database toolkit with schema management
- **Drizzle Kit**: Database migrations and schema management

## Authentication & Security
- **Passport.js**: Authentication middleware framework
- **OpenID Client**: OIDC authentication for Replit integration
- **Express Session**: Session management with PostgreSQL storage
- **connect-pg-simple**: PostgreSQL session store adapter

## UI & Styling
- **shadcn/ui**: Component library built on Radix UI primitives
- **Radix UI**: Accessible component primitives
- **TailwindCSS**: Utility-first CSS framework with design system
- **Lucide React**: Icon library for consistent iconography

## State Management & Data Fetching
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form state management with validation
- **Zod**: Schema validation and type inference

## Cloud Storage Integrations
- **Google APIs**: Google Drive API client for file operations
- **googleapis**: Official Google APIs Node.js client library
- **Dropbox SDK**: Official Dropbox API client for file operations (manual integration)

## Development & Build Tools
- **TypeScript**: Static type checking across frontend and backend
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with autoprefixer
- **Wouter**: Lightweight client-side routing