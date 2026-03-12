# OpusLearn - AI Course Authoring Platform

## Overview

OpusLearn is a full-stack web application for creating and managing educational courses using AI-powered content generation. The platform allows users to create courses, organize them into modules, and build interactive content blocks including text, images, videos, quizzes, and flashcards. The application features a modern React frontend with a Node.js/Express backend, utilizing PostgreSQL for data persistence and Drizzle ORM for database management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Shadcn/UI components built on Radix UI primitives with Tailwind CSS for styling
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod schema validation
- **Drag & Drop**: React DnD for reordering modules and content blocks
- **Component Structure**: Organized with reusable UI components, course-specific components, and page-level components

### Backend Architecture
- **Runtime**: Node.js with TypeScript and ES modules
- **Framework**: Express.js for REST API endpoints
- **Development Server**: Custom Vite integration for development with HMR
- **File Uploads**: Multer for handling file uploads with validation
- **Error Handling**: Centralized error handling middleware
- **Logging**: Custom request logging with timing and response capture

### Database Design
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Connection**: Neon Database serverless PostgreSQL connection
- **Tables**:
  - `users`: User authentication and profiles
  - `courses`: Course metadata, objectives, and settings
  - `modules`: Course structure with ordering and metadata
  - `content_blocks`: Flexible content system with JSON storage
  - `reference_files`: File attachments and references per course

### Storage Architecture
- **Interface Pattern**: IStorage interface with in-memory implementation for development
- **Data Access**: Repository pattern with CRUD operations for each entity
- **File Storage**: Local filesystem with Multer for uploaded reference materials
- **Content Flexibility**: JSON-based content storage for different block types (text, AI-generated, interactive)

### API Design
- **RESTful Endpoints**: Consistent REST API structure
- **Course Management**: Full CRUD operations for courses, modules, and content blocks
- **File Handling**: Dedicated endpoints for file upload with type validation
- **Nested Resources**: Hierarchical API structure (courses → modules → content blocks)
- **Validation**: Zod schemas shared between frontend and backend

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React 18+ with TypeScript, Vite for build tooling
- **UI Framework**: Radix UI primitives with Shadcn/UI component library
- **Styling**: Tailwind CSS with CSS custom properties for theming

### Database & ORM
- **Database**: PostgreSQL via Neon Database serverless platform
- **ORM**: Drizzle ORM with Drizzle Kit for migrations
- **Connection**: @neondatabase/serverless for database connectivity

### State Management & HTTP
- **Data Fetching**: TanStack Query for server state management
- **HTTP Client**: Native fetch API with custom wrapper functions
- **Form Management**: React Hook Form with Hookform Resolvers

### Development & Build Tools
- **Build Tool**: Vite with React plugin and runtime error overlay
- **TypeScript**: Full TypeScript support with strict configuration
- **Development**: Replit-specific plugins for enhanced development experience

### Utility Libraries
- **Validation**: Zod for schema validation and type inference
- **Styling Utilities**: clsx and tailwind-merge for conditional styling
- **Date Handling**: date-fns for date manipulation
- **Drag & Drop**: react-dnd with HTML5 backend
- **File Processing**: Multer for multipart file uploads

### Session & Security
- **Session Storage**: connect-pg-simple for PostgreSQL-backed sessions
- **File Validation**: Built-in Multer file type and size validation
- **CORS**: Express CORS middleware for cross-origin requests

### Rich Text Editor
- **Editor**: TipTap-based rich text editor with floating formatting toolbar
- **Always-On Editing**: Text blocks are editable by default, no separate edit mode
- **Floating Toolbar**: Formatting menu appears as a floating bar above the editor only when clicked inside, hides when clicking outside
- **Formatting Options**:
  - Text styles: Bold, Italic, Underline
  - Headings (H1, H2, H3)
  - Text alignment: Left, Center, Right, Justify
  - Lists: Bulleted and numbered
  - Links: Insert and edit hyperlinks
  - Undo/Redo functionality
- **Auto-Save**: Content automatically saves 1 second after user stops typing
- **Implementation**: `client/src/components/ui/rich-text-editor.tsx`

### Content Block Selection
- **Bottom Toolbar**: Shows quick access tools (Text, Image, Video, Quiz) with icons and labels
- **Left Sidebar Panel**: Click "More" to open a full-height left sidebar with all content block types
- **Portal Rendering**: Sidebar uses React Portal to render directly to document.body for correct positioning
- **Subtle Colors**: Each tool has a subtle colored background matching its category (violet for AI, blue for media, etc.)
- **Left Arrow Close**: Sidebar closes with a left-pointing chevron button instead of X
- **Minimalistic Design**: Clean interface with Lucide React icons, titles, and descriptions for each tool
- **Categories**: Tools organized into AI-Powered, Text, Media, and Interactive sections with distinct color palettes
- **Tool Layout**: Each tool displays with a colored icon box, title, and descriptive text in a vertical list
- **Smart Interaction**: Quick tools for instant access, sidebar for browsing all available block types
- **Implementation**: `client/src/components/course/content-block-menu.tsx`

### AI Content Generation
- **Provider**: Google Gemini 2.5 Flash for intelligent content generation
- **Automatic Text Generation**: When a text block is added to a module, AI automatically generates relevant introductory content based on the module title and course context (2-3 paragraphs)
- **Interface**: Inline AI assistant within text content blocks (no dialogs/popups)
- **Activation**: Hover over text block shows AI sparkle icon, click to activate
- **Quick Actions**: 
  - Improve writing quality and clarity
  - Make text more concise
  - Simplify language for better understanding
- **Custom Generation**: User-defined prompts for specific content needs
  - Custom prompts now include existing text as context
  - AI modifies/enhances existing content rather than replacing it completely
  - Example: "Add an example about neural networks" adds to existing text naturally
- **Progress Indicator**: Shows "AI is writing" with spinner during generation
- **Rate Limiting**: 30 requests per minute per IP to prevent abuse
- **Course Context**: AI uses course objectives and topic for relevant content
- **Fallback Behavior**: If AI generation fails, text blocks are created with empty content so users are not blocked
- **Implementation Files**:
  - Frontend: `client/src/components/ai/inline-ai-assistant.tsx`
  - Backend: `server/ai-service.ts` with `/api/ai/generate-text` endpoint
  - Schema: `shared/schema.ts` with `aiGenerateTextSchema` validation
  - Auto-generation: `server/routes.ts` POST `/api/modules/:moduleId/content-blocks` endpoint

### Content Block Interactions
- **Hover Actions**: When hovering over a content block, three action buttons appear on the left:
  - **Duplicate**: Creates a copy of the block with current edited content
  - **Delete**: Removes the block with confirmation dialog
  - **Move**: Drag handle for reordering blocks via drag-and-drop
- **Drag-and-Drop Reordering**: Full drag-and-drop functionality for content blocks
  - React DnD integration with visual feedback (opacity change during drag)
  - Instant UI update with debounced save to backend (1 second after dragging stops)
  - Automatic order normalization and persistence
- **Visual Feedback**: Buttons have subtle shadows and hover effects for clear interaction
- **Implementation**: `client/src/components/course/content-block.tsx` and `client/src/pages/chapter-content.tsx`