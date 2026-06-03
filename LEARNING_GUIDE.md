# 📚 Your RAG System - Complete Learning Guide

## 🎯 Goal
Master your AI Document Assistant so you can **explain it, modify it, and improve it** during Buildathon Dallas.

---

## 🏗️ PART 1: Understand the Architecture

### What Your App Does (In 30 Seconds)
1. User uploads a document (PDF, TXT, DOCX)
2. App breaks it into chunks and converts to vectors (embeddings)
3. Saves vectors in Upstash database
4. When user asks a question, app finds similar chunks
5. Sends chunks + question to OpenAI to generate answer
6. Shows answer with source references

### The 5 Core Components

#### 1. **CHUNKING** (`src/lib/chunk.ts`)
**Purpose:** Split large documents into manageable pieces

**What Happens:**
```
Document: "A very long document with 10,000 characters..."
                          ↓
                 chunkText() function
                          ↓
Output: [
  { id: "chunk-0", text: "First 800 chars...", index: 0 },
  { id: "chunk-1", text: "Next 800 chars...", index: 1 },
  { id: "chunk-2", text: "Final chunk...", index: 2 }
]
```

**Key Settings:**
- `chunkSize: 800` - Each chunk is about 800 characters
- `overlap: 120` - Chunks overlap by 120 chars to preserve context

**Question to Ask Yourself:** *Why is overlap important?*
Answer: So important information at chunk boundaries doesn't get lost

---

#### 2. **EMBEDDINGS** (`src/lib/embeddings.ts`)
**Purpose:** Convert text to mathematical vectors

**What Happens:**
```
Text: "What is machine learning?"
            ↓
      OpenAI API
            ↓
Vector: [0.123, -0.456, 0.789, ..., 0.234]  ← 1536 numbers
```

**Two Functions:**
- `createEmbeddings(texts)` - Convert multiple texts to vectors
- `createQueryEmbedding(question)` - Convert user question to vector

**Why Embeddings?**
- Similar texts = similar number patterns
- Computers can compare numbers = semantic search!

---

#### 3. **STORAGE** (`src/lib/store.ts`)
**Purpose:** Save vectors in Upstash database for later search

**What Happens:**
```
chunks + embeddings
            ↓
   saveDocument()
            ↓
Stored in Upstash (like a searchable vault)
            ↓
Later: Search by comparing vectors
```

**Key Functions:**
- `saveDocument()` - Save all chunks with embeddings
- `hasDocument()` - Check if anything is uploaded

---

#### 4. **RETRIEVAL** (`src/lib/retrieval.ts`)
**Purpose:** Find the most relevant chunks for a question

**What Happens:**
```
User Question: "What is the revenue?"
            ↓
Convert to embedding vector
            ↓
Search Upstash for similar vectors
            ↓
Return top 3 most similar chunks
```

---

#### 5. **GENERATION** (in `src/lib/embeddings.ts`)
**Purpose:** Use OpenAI to generate an answer

**What Happens:**
```
System: "Answer only from context provided"
Question: "What is the revenue?"
Context: [Top 3 relevant chunks]
            ↓
        OpenAI API
            ↓
Answer: "The revenue was $1.2B in 2024"
```

---

## 🔌 PART 2: API Routes (How Frontend Talks to Backend)

### Route 1: POST `/api/upload`
**What It Does:** Handle file uploads

**Step by Step:**
1. User selects a file (PDF, TXT, or DOCX)
2. App reads the file
3. Converts to text (using pdf-parse or mammoth library)
4. Chunks the text
5. Creates embeddings
6. Saves to Upstash
7. Returns success message

**File:** `src/app/api/upload/route.ts`

---

### Route 2: POST `/api/chat`
**What It Does:** Answer user questions

**Step by Step:**
1. User asks a question
2. Check if document is uploaded
3. Convert question to embedding
4. Search Upstash for similar chunks
5. Send to OpenAI: "Here's context, answer this question"
6. Return answer + source chunks

**File:** `src/app/api/chat/route.ts`

---

### Route 3: POST `/api/auth`
**What It Does:** Authenticate users

**Simple Password Check**

**File:** `src/app/api/auth/route.ts`

---

## 🎨 PART 3: Frontend Components

### `/src/app/page.tsx` - Home/Landing Page
- Shows what the app does
- "Open App" button

### `/src/app/login/page.tsx` - Login Page
- Password authentication

### `/src/app/app/page.tsx` - Main Chat Interface
- File upload area
- Chat message history
- Source references display

---

## 🧪 PART 4: Key Questions to Test Your Understanding

**Try answering these:**

1. **Q: Why do we chunk documents?**
   A: Because embeddings work better on smaller pieces, and it helps with retrieval accuracy

2. **Q: What's the purpose of overlap in chunking?**
   A: To preserve context at chunk boundaries so important information isn't split

3. **Q: Why convert text to embeddings (vectors)?**
   A: Because computers can compare numbers mathematically to find similar content

4. **Q: How does semantic search work?**
   A: Similar meaning = similar embeddings = high cosine similarity score

5. **Q: Why do we only send top 3 chunks to OpenAI?**
   A: To save cost and prevent token limits; context is more focused

---

## 🛠️ PART 5: Key Learnings

### Technology Stack
- **Framework:** Next.js (React framework for web apps)
- **Language:** TypeScript (JavaScript with type safety)
- **Database:** Upstash Vector (serverless vector database)
- **AI:** OpenAI API (embeddings + chat)
- **UI:** Tailwind CSS (styling)

### How Data Flows

```
UPLOAD FLOW:
File → Parse → Chunk → Embed → Store in Upstash

QUERY FLOW:
Question → Embed → Search Upstash → Get top 3 → Send to OpenAI → Answer
```

### Important Files to Know

| File | Purpose | Lines |
|------|---------|-------|
| `chunk.ts` | Split documents | 58 |
| `embeddings.ts` | Convert to vectors | 51 |
| `retrieval.ts` | Search vectors | 35 |
| `store.ts` | Save vectors | 54 |
| `/api/upload/route.ts` | Handle uploads | 99 |
| `/api/chat/route.ts` | Answer questions | 60 |

---

## 💪 NEXT STEPS: Practice Understanding

1. **Read each library file** - Understand what each does
2. **Trace a user action** - What happens when user uploads a file?
3. **Trace a question** - What happens when user asks a question?
4. **Answer the 5 key questions** above
5. **Explain to someone** - Can you explain your app to a friend?

---

## 🎓 Your First Coding Task (After Understanding)

Once you understand the architecture, your first task will be:

**"Modify the chunking strategy to use 500 character chunks with 100 char overlap"**

This tests if you:
- Understand chunking
- Can locate the right file
- Can modify and test code
- Can explain why this matters

---

## 📞 Questions to Answer

Before moving forward, answer these:

1. What does `chunkText()` do?
2. What's the difference between `createEmbeddings()` and `createQueryEmbedding()`?
3. Why do we need Upstash?
4. What happens in `/api/chat/route.ts`?
5. How many chunks does your system retrieve for answering? (Hint: look at chat/route.ts)

**Write down your answers!** This proves you understand the system.

---

Good luck! You've got this! 🚀
