# OpusAuthoring

A comprehensive course authoring and e-learning platform built with modern web technologies, featuring AI-powered content generation and SCORM-compliant course creation.

## 🚀 Features

- **AI-Powered Course Creation**: Generate course content, quizzes, and assignments using Google Gemini AI
- **Interactive Course Builder**: Drag-and-drop interface for creating structured courses
- **SCORM Compliance**: Export courses in SCORM format for LMS integration
- **Rich Text Editing**: Advanced text editor with multimedia support
- **Media Management**: Upload and manage images, videos, and audio files
- **Real-time Collaboration**: Live editing and collaboration features
- **Template Library**: Pre-built course templates for quick start
- **Progress Tracking**: Monitor learner progress and performance

## 🛠️ Technical Stack

### Frontend
- **React 18** - Modern UI library with hooks
- **TypeScript** - Type-safe JavaScript development
- **Vite** - Fast build tool and dev server
- **TailwindCSS** - Utility-first CSS framework
- **Radix UI** - Accessible component library
- **TanStack Query** - Data fetching and caching
- **Framer Motion** - Animation library
- **TipTap** - Rich text editor
- **Wouter** - Lightweight routing

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **TypeScript** - Type-safe server development
- **PostgreSQL** - Relational database
- **Drizzle ORM** - Type-safe database toolkit
- **Passport.js** - Authentication middleware
- **Multer** - File upload handling
- **WebSockets** - Real-time communication

### AI & Services
- **Google Gemini AI** - Content generation and analysis
- **OpenAI** - Alternative AI service integration
- **Stock Images API** - Image generation and selection

### Development Tools
- **ESBuild** - Fast JavaScript bundler
- **Drizzle Kit** - Database migrations
- **Cross-env** - Environment variable management
- **TSX** - TypeScript execution

## 📋 Software Requirements

### System Requirements
- **Node.js** v18 or higher
- **npm** v8 or higher  
- **PostgreSQL** v13 or higher
- **Git** for version control

### Development Environment
- **VS Code** (recommended) with TypeScript and Tailwind extensions
- **Windows 10/11**, macOS, or Linux
- **Chrome/Firefox** for testing (latest versions)

## 🚀 Setup Instructions

### 1. Clone Repository
```bash
git clone https://github.com/manimarant/OpusAuthoring.git
cd OpusAuthoring
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/opus_authoring

# AI Services
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=5000
NODE_ENV=development

# Session Secret
SESSION_SECRET=your_secure_session_secret_here

# File Upload Settings
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

### 4. Database Setup
```bash
# Create database (PostgreSQL must be running)
createdb opus_authoring

# Run database migrations
npm run db:push
```

### 5. Start Development Server
```bash
# Start both frontend and backend
npm run dev
```

The application will be available at `http://localhost:5000`

## 📁 Project Structure

```
OpusAuthoring/
├── client/                 # React frontend application
│   ├── public/            # Static assets
│   └── src/               # Source code
│       ├── components/    # Reusable UI components
│       ├── pages/         # Page components
│       ├── hooks/         # Custom React hooks
│       ├── lib/           # Utility libraries
│       └── utils/         # Helper functions
├── server/                # Express.js backend
│   ├── index.ts          # Main server file
│   ├── routes.ts         # API routes
│   ├── db.ts             # Database configuration
│   ├── ai-service.ts     # AI integration
│   └── storage.ts        # File storage handling
├── shared/               # Shared types and schemas
├── migrations/           # Database migrations
├── uploads/             # File upload directory
└── dist/                # Production build output
```

## 🔧 Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Database
npm run db:push      # Apply database changes

# Type Checking
npm run check        # Run TypeScript compiler
```

## 🐳 Production Deployment

### Using Node.js
```bash
npm run build
npm start
```

### Environment Variables for Production
```env
NODE_ENV=production
DATABASE_URL=your_production_database_url
PORT=5000
```

## 🔐 Security Considerations

- API keys are stored in environment variables
- File uploads are validated and sanitized
- Database queries use parameterized statements
- Session management with secure cookies
- Input validation with Zod schemas

## 🧪 Testing

The application includes comprehensive testing setup:
- Unit tests for utility functions
- Integration tests for API endpoints
- E2E tests for critical user flows

## 📚 API Documentation

The REST API provides endpoints for:
- `/api/courses` - Course management
- `/api/content` - Content block operations
- `/api/ai` - AI-powered generation
- `/api/auth` - Authentication
- `/api/upload` - File management

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `/docs` folder
- Review the troubleshooting guides in the various `.md` files

## 🎯 Roadmap

- [ ] Advanced analytics dashboard
- [ ] Multi-language support
- [ ] Mobile app companion
- [ ] Advanced SCORM 2004 features
- [ ] Integration with popular LMS platforms
- [ ] Offline content viewing
