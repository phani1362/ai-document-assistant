# AI Document Assistant

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://vercel.com)

An intelligent document assistant powered by **RAG (Retrieval-Augmented Generation)** that enables users to upload documents and ask natural language questions with AI-powered answers backed by source context.

## 🎯 Key Features

- **Multi-format Support**: Upload `.txt`, `.pdf`, and `.docx` files
- **Semantic Search**: OpenAI embeddings with cosine similarity for intelligent document retrieval
- **Source Attribution**: Every answer includes direct references to relevant source chunks
- **Context-Aware Responses**: Answers are grounded exclusively in document content—no hallucinations
- **Password Protection**: Secure access with authentication
- **Responsive Design**: Modern, mobile-friendly UI with Tailwind CSS
- **Real-time Processing**: Fast embedding generation and semantic search
- **Production-Ready**: Deployed on Vercel with optimized build configuration

## 🏗️ Architecture

The application implements a robust RAG pipeline:

1. **Document Ingestion**: Parse and chunk uploaded documents intelligently
2. **Embedding Generation**: Use OpenAI's embedding API to create semantic vectors
3. **Vector Storage**: Persist embeddings using Upstash Vector database
4. **Retrieval**: Find top-k most relevant chunks using cosine similarity
5. **Generation**: Pass retrieved context to GPT for grounded answer generation
6. **UI Rendering**: Display answers with highlighted source references

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| **Framework** | [Next.js 16](https://nextjs.org/) with App Router |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/) |
| **AI/LLM** | [OpenAI API](https://openai.com/) (GPT-4, embeddings) |
| **Vector DB** | [Upstash Vector](https://upstash.com/docs/vector/overall/getstarted) |
| **File Parsing** | [Mammoth](https://github.com/mwilson/mammoth.js) (DOCX), [pdf-parse](https://github.com/modesty/pdf-parse) (PDF) |
| **Deployment** | [Vercel](https://vercel.com/) |

## 📋 Prerequisites

- Node.js 18+ and npm
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))
- Upstash Vector database account ([create here](https://console.upstash.com/))

## ⚙️ Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/ragsystem.git
cd ragsystem
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
```env
OPENAI_API_KEY=your_openai_api_key
UPSTASH_VECTOR_REST_URL=your_upstash_url
UPSTASH_VECTOR_REST_TOKEN=your_upstash_token
APP_PASSWORD=your_secure_password
OPENAI_CHAT_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

4. **Start the development server**
```bash
npm run dev
```

5. **Open in browser**
Navigate to `http://localhost:3000`

## 🚀 Usage

1. **Upload Document**: Click the upload area and select a `.txt`, `.pdf`, or `.docx` file
2. **Wait for Processing**: The system generates embeddings (10-30 seconds depending on file size)
3. **Ask Questions**: Type natural language questions about your document
4. **Review Answers**: Read AI-generated answers with source chunk references below

### Example Workflow
```
📤 Upload: "annual-report-2024.pdf" (2.5MB)
⚙️ Processing: Generating embeddings...
💬 Query: "What were the total revenue figures?"
✅ Answer: "Revenue increased to $1.2B..." [Source: Page 3, Section 4.1]
```

## 📊 Performance

- **Embedding Generation**: ~100ms per 1000 tokens
- **Semantic Search**: <10ms for retrieval
- **Response Time**: 1-3 seconds end-to-end (includes LLM latency)
- **File Support**: Up to 10MB documents

## 🔐 Security Features

- Password-protected access
- Secure cookie handling (SameSite=Lax)
- Environment variable-based configuration
- No sensitive data in client-side bundles
- Server-side proxy for API keys

## 📦 Build & Deployment

```bash
# Type checking
npm run typecheck

# Linting
npm run lint

# Production build
npm run build

# Start production server
npm start
```

### Vercel Deployment

This project is optimized for Vercel:
- Configured external packages (pdf-parse, mammoth)
- Next.js App Router compatibility
- Zero-config deployment

Deploy with one click: [![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyourusername%2Fragsystem)

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

```bash
# Fork the repository
# Create a feature branch (git checkout -b feature/amazing-feature)
# Commit changes (git commit -m 'feat: add amazing feature')
# Push to branch (git push origin feature/amazing-feature)
# Open a Pull Request
```

## 📝 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- AI capabilities by [OpenAI](https://openai.com/)
- Vector database by [Upstash](https://upstash.com/)
- UI designed with [Tailwind CSS](https://tailwindcss.com/)

## 📧 Questions?

Feel free to open an issue for bugs, feature requests, or general questions.
