# Contributing to AI Document Assistant

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## 🎯 Code of Conduct

Be respectful, inclusive, and professional in all interactions. We're committed to providing a welcoming environment for all contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### Local Development Setup

1. **Fork and Clone**
```bash
git clone https://github.com/yourusername/ragsystem.git
cd ragsystem
```

2. **Install Dependencies**
```bash
npm install
```

3. **Create a Feature Branch**
```bash
git checkout -b feature/your-feature-name
```

4. **Set Up Environment**
```bash
cp .env.example .env.local
# Add your API keys to .env.local
```

5. **Start Development Server**
```bash
npm run dev
```

## 📋 Development Workflow

### Before You Start
- Check [issues](https://github.com/yourusername/ragsystem/issues) for existing discussions
- For large changes, open an issue first to discuss your approach
- Ensure your changes align with project goals

### During Development

1. **Follow Code Style**
   - Use TypeScript for type safety
   - Follow existing code patterns
   - Use meaningful variable names
   - Write self-documenting code

2. **Commit Guidelines**
   - Use conventional commits:
     - `feat:` for new features
     - `fix:` for bug fixes
     - `refactor:` for code improvements
     - `docs:` for documentation
     - `test:` for tests
   - Keep commits focused and atomic
   - Example: `feat: add document caching to improve performance`

3. **Code Quality**
   ```bash
   npm run lint          # Check for style issues
   npm run typecheck     # Verify TypeScript
   npm run build         # Test production build
   ```

### Testing Your Changes

Before submitting:
1. Test locally on different file types (.txt, .pdf, .docx)
2. Verify responsive design (mobile, tablet, desktop)
3. Test with documents of various sizes
4. Check for console errors

## 🔄 Submitting a Pull Request

1. **Push to Your Fork**
```bash
git push origin feature/your-feature-name
```

2. **Create Pull Request**
   - Use a descriptive title
   - Reference related issues (closes #123)
   - Describe your changes clearly
   - Include before/after if UI changes

3. **PR Template**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change
- [ ] Documentation update

## Testing
How did you test this?

## Screenshots (if applicable)
```

4. **Review Process**
   - Maintainers will review your code
   - Respond to feedback and make requested changes
   - Keep discussions professional and constructive

## 🎨 Code Standards

### TypeScript
- Use strict type checking
- Avoid `any` types when possible
- Document complex types with comments

### React/Next.js
- Use functional components
- Follow hooks best practices
- Optimize performance with React.memo when needed
- Use Server Components where appropriate

### Styling
- Use Tailwind CSS classes
- Follow existing design patterns
- Ensure accessibility (a11y)
- Test dark mode if applicable

### File Organization
```
src/
├── app/           # Next.js app router pages
├── components/    # React components
└── lib/           # Utilities and helpers
```

## 🐛 Reporting Bugs

1. **Check if bug exists** - Search issues first
2. **Provide details**:
   - Description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (OS, Node version, browser)
   - Error logs/screenshots

## 💡 Suggesting Features

1. **Describe the feature**
2. **Explain the use case**
3. **Suggest implementation** (optional)
4. **Discuss tradeoffs**

## 📚 Documentation

- Update README.md if you change user-facing features
- Add inline comments for complex logic
- Update this file if workflow changes

## 🔒 Security

- Never commit API keys or secrets
- Report security issues privately to maintainers
- Don't commit `.env.local` or sensitive files

## 📝 License

By contributing, you agree that your contributions will be licensed under the project's MIT License.

## ❓ Questions?

- Open a GitHub issue
- Start a discussion
- Reach out to maintainers

---

**Happy Contributing! 🎉**
