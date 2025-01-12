# Story Producer v2

An AI-powered tool for analyzing source materials, extracting insights, and conducting deep-dive analysis of documents.

## Features

- 📝 Document Analysis
- 🔍 Vector Search
- 💬 AI Chat Interface
- 🤿 Deep Dive Mode
- 📊 Theme Analysis
- 🔗 Source Cross-referencing

## Documentation

### For Users
- [User Guide](docs/USER_GUIDE.md) - Complete guide to using the application
  - Document management
  - Chat interface
  - Deep dive analysis
  - Best practices

### For Developers
- [Architecture](docs/ARCHITECTURE.md) - Technical architecture and components
  - System design
  - Data flow
  - Key components
  - Integration details

### For Deployment
- [Setup Guide](docs/SETUP.md) - Installation and configuration
  - Environment setup
  - Development
  - Deployment
  - Configuration

### For Support
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md) - Common issues and solutions
  - Known issues
  - Error handling
  - Recovery procedures
  - Debugging steps

## Quick Start

1. **Install**
   ```bash
   npm install
   ```

2. **Configure**
   ```bash
   cp .env.local.example .env.local
   ```

3. **Run**
   ```bash
   npm run dev
   ```

## Tech Stack

- Next.js 14
- TypeScript
- OpenAI
- Vercel Blob Storage
- Tailwind CSS
- Radix UI

## License

MIT License - see LICENSE file for details

## Development

### Branch Structure
- `main` - Production branch, stable releases
- `development` - Active development branch
- Feature branches should branch off `development`

### Workflow
1. Create feature branch from `development`:
   ```bash
   git checkout development
   git pull
   git checkout -b feature/your-feature-name
   ```

2. Make changes and commit:
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

3. Push changes:
   ```bash
   git push -u origin feature/your-feature-name
   ```

4. Create pull request to merge into `development`

5. After testing, merge `development` into `main` for release

## Support

For issues and feature requests:
1. Check [Troubleshooting Guide](docs/TROUBLESHOOTING.md)
2. Use GitHub issue tracker
3. Include relevant logs and error messages
