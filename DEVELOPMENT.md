# Development Guide

This guide provides detailed instructions for setting up a development environment and working with the AI Document Assistant project.

## 📋 Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Git**: For version control
- **API Keys**:
  - OpenAI API key ([create here](https://platform.openai.com/api-keys))
  - Upstash Vector credentials ([setup here](https://console.upstash.com/))

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/ragsystem.git
cd ragsystem

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Add your API credentials to .env.local
```

### 2. Configure Environment

Edit `.env.local` with your credentials:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-...your-key...
OPENAI_CHAT_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Upstash Vector Database
UPSTASH_VECTOR_REST_URL=https://...your-url...
UPSTASH_VECTOR_REST_TOKEN=...your-token...

# Application
APP_PASSWORD=your-secure-password
```

### 3. Start Development

```bash
npm run dev
```

Visit `http://localhost:3000` in your browser.

## 📁 Project Structure

```
ragsystem/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout with metadata
│   │   ├── page.tsx            # Home page
│   │   └── globals.css         # Global styles
│   ├── components/             # React components
│   │   ├── ChatWindow.tsx      # Chat interface
│   │   ├── FileUpload.tsx      # File upload handler
│   │   ├── LogoutButton.tsx    # Authentication
│   │   └── SourceList.tsx      # Source display
│   └── lib/                    # Core utilities
│       ├── chunk.ts            # Document chunking logic
│       ├── embeddings.ts       # Embedding generation
│       ├── openai.ts           # OpenAI client
│       ├── retrieval.ts        # Vector search
│       └── store.ts            # Vector store management
├── .github/                    # GitHub templates
├── .editorconfig               # Editor configuration
├── CHANGELOG.md                # Version history
├── CODE_OF_CONDUCT.md         # Community guidelines
├── CONTRIBUTING.md             # Contribution guide
├── DEVELOPMENT.md              # This file
├── LICENSE                     # MIT License
├── README.md                   # Project overview
├── SECURITY.md                 # Security policy
├── next.config.ts              # Next.js configuration
├── tailwind.config.ts          # Tailwind CSS setup
├── tsconfig.json               # TypeScript configuration
└── package.json                # Dependencies and scripts
```

## 🛠️ Available Scripts

```bash
# Development
npm run dev              # Start development server on :3000

# Building
npm run build            # Production build
npm start                # Start production server

# Quality Assurance
npm run lint             # Run ESLint on source code
npm run typecheck        # Type-check with TypeScript

# Utilities
npm run build --webpack  # Build with webpack (alternative)
```

## 🔍 Code Quality

### TypeScript Checking

```bash
# Check for type errors
npm run typecheck

# Strict mode enforced in tsconfig.json
# No implicit 'any' types allowed
```

### Linting

```bash
# Check code style
npm run lint

# Fix auto-fixable issues
npm run lint --fix
```

### Formatting

The project uses EditorConfig for consistent formatting across editors:

```bash
# Install EditorConfig support in your editor:
# - VS Code: EditorConfig for VS Code extension
# - WebStorm: Built-in support
# - Sublime: EditorConfig plugin
```

## 🧪 Testing

### Manual Testing Checklist

```markdown
- [ ] Upload .txt file and verify processing
- [ ] Upload .pdf file and verify extraction
- [ ] Upload .docx file and verify parsing
- [ ] Ask questions about uploaded content
- [ ] Verify source chunks are displayed
- [ ] Test on mobile viewport
- [ ] Test on tablet viewport
- [ ] Test on desktop viewport
- [ ] Check dark mode (if applicable)
- [ ] Verify error handling with invalid files
```

### API Testing

```bash
# Test embeddings API
curl -X POST http://localhost:3000/api/embed \
  -H "Content-Type: application/json" \
  -d '{"text":"sample text"}'

# Test retrieval API
curl -X POST http://localhost:3000/api/retrieve \
  -H "Content-Type: application/json" \
  -d '{"query":"your question"}'
```

## 🐛 Debugging

### Enable Debug Logging

Add to `.env.local`:

```env
DEBUG=*
NODE_OPTIONS=--trace-warnings
```

### Browser DevTools

1. Open DevTools (F12 or Cmd+Option+I)
2. Check Console for errors
3. Use Network tab to monitor API calls
4. Profile performance in Performance tab

### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js Debug",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/next",
      "args": ["dev"],
      "skipFiles": ["<node_internals>/**"],
      "console": "integratedTerminal"
    }
  ]
}
```

## 📦 Dependency Management

### Add New Dependency

```bash
# Add production dependency
npm install package-name

# Add development dependency
npm install --save-dev package-name

# Update dependencies
npm update

# Audit for vulnerabilities
npm audit
npm audit fix
```

### Dependencies Overview

| Package | Purpose | Version |
|---------|---------|---------|
| next | Web framework | ^16.2.1 |
| react | UI library | ^19.2.4 |
| @upstash/vector | Vector database | ^1.2.3 |
| openai | LLM integration | ^6.3.0 |
| tailwindcss | CSS framework | ^4 |
| typescript | Type safety | ^5 |

## 🚢 Deployment

### Vercel Deployment

1. **Connect Repository**
   - Push code to GitHub
   - Link repository in Vercel dashboard

2. **Environment Variables**
   - Add in Vercel Project Settings
   - Copy from `.env.example`

3. **Deploy**
   ```bash
   # Automatic on git push
   # Or manual:
   vercel deploy --prod
   ```

### Build Optimization

```bash
# Analyze bundle size
npm run build -- --analyze

# Check build output
ls -lh .next/standalone/
```

## 🔐 Security Checklist

- [ ] Environment variables not committed
- [ ] API keys rotated for production
- [ ] HTTPS enabled on deployment
- [ ] Authentication enabled
- [ ] No console.log of sensitive data
- [ ] Dependencies audited (`npm audit`)
- [ ] Security headers configured

## 📚 Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Upstash Vector Docs](https://upstash.com/docs/vector/overall/getstarted)

## 🤝 Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📝 Commit Message Format

Follow conventional commits:

```bash
feat: add new feature
fix: fix a bug
refactor: code improvements
docs: documentation updates
test: add/update tests
chore: build, deps, etc
```

## ❓ Troubleshooting

### Port Already in Use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
npm run dev -- -p 3001
```

### Node Modules Issues

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### API Key Errors

```bash
# Verify environment variables
echo $OPENAI_API_KEY
echo $UPSTASH_VECTOR_REST_URL

# Check .env.local exists and is readable
cat .env.local
```

## 🎯 Performance Tips

- Use React DevTools Profiler
- Monitor API response times
- Check bundle size with `next/bundle-analyzer`
- Optimize images with Next.js Image component
- Use dynamic imports for large components

## 📞 Support

- Open an [issue](https://github.com/yourusername/ragsystem/issues)
- Check [FAQ](#faq) below
- Read security policy in [SECURITY.md](SECURITY.md)

### FAQ

**Q: How do I reset the database?**
A: The in-memory store resets on server restart. For production, access Upstash console directly.

**Q: Can I use different embedding models?**
A: Yes, update `OPENAI_EMBEDDING_MODEL` in `.env.local`.

**Q: How do I add more features?**
A: Follow [CONTRIBUTING.md](CONTRIBUTING.md) and read the architecture overview in [README.md](README.md).

---

Happy coding! 🚀
