# RAG Chat App

A Retrieval-Augmented Generation (RAG) chat application built with Next.js, Gemini AI, and Pinecone.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **AI SDK**: Vercel AI SDK (`ai`)
- **LLM**: Google Gemini (`@google/generative-ai`)
- **Vector Store**: Pinecone (`@pinecone-database/pinecone`)
- **Styling**: Tailwind CSS v4
- **File Parsing**: pdf-parse, multer

## Features

✅ **Document Upload**: Upload PDF and text files for processing
✅ **Document Processing**: Automatic chunking and embedding generation
✅ **Vector Storage**: Store embeddings in Pinecone for similarity search
✅ **RAG Chat**: Ask questions and get answers based on uploaded documents
✅ **Source Attribution**: See which documents were used to answer your questions

## Project Structure

```
rag-chat-app/
├── app/
│   ├── api/
│   │   ├── chat/          # Chat API endpoint
│   │   └── upload/        # File upload API endpoint
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Main chat UI
│   └── globals.css        # Global styles
├── lib/
│   ├── embeddings.ts      # Gemini embeddings integration
│   ├── pinecone.ts        # Pinecone vector database setup
│   ├── rag.ts             # RAG pipeline (process & query)
│   └── utils/
│       ├── chunking.ts    # Text chunking utilities
│       └── pdf-parser.ts  # PDF and text file parsing
└── package.json
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd rag-chat-app
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the `rag-chat-app` directory:

```env
# Gemini API Key (get from https://aistudio.google.com/)
GEMINI_API_KEY=your_gemini_api_key_here

# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=rag-chat-index
PINECONE_CLOUD=aws  # Optional: aws, gcp, or azure (default: aws)
PINECONE_REGION=us-east-1  # Optional: your preferred region
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Upload Documents**: Click "Upload Document" and select a PDF or text file
2. **Wait for Processing**: The document will be chunked, embedded, and stored in Pinecone
3. **Ask Questions**: Type your question in the chat input and press Enter
4. **Get Answers**: The RAG system will retrieve relevant context and generate an answer

## Implementation Phases

### ✅ Phase 0: Project Bootstrap
- Next.js app with TypeScript
- Tailwind CSS configuration
- All dependencies installed

### ✅ Phase 1: Embeddings (Gemini)
- `lib/embeddings.ts` - Gemini Embeddings API integration
- Support for single and batch embedding generation
- Task type support (RETRIEVAL_DOCUMENT, RETRIEVAL_QUERY, etc.)

### ✅ Phase 2: Pinecone Setup
- `lib/pinecone.ts` - Pinecone vector database integration
- Auto-create index if it doesn't exist
- Vector operations: upsert, query, delete, stats

### ✅ Phase 3: File Processing
- `lib/utils/pdf-parser.ts` - PDF and text file parsing
- `lib/utils/chunking.ts` - Text chunking utilities

### ✅ Phase 4: RAG Pipeline
- `lib/rag.ts` - Complete RAG implementation
- Document processing and storage
- Query processing with context retrieval

### ✅ Phase 5: API Routes
- `app/api/chat/route.ts` - Chat endpoint
- `app/api/upload/route.ts` - File upload endpoint

### ✅ Phase 6: Frontend UI
- `app/page.tsx` - Complete chat interface
- File upload functionality
- Message display with source attribution

## API Endpoints

### POST `/api/chat`
Send a chat message and get a RAG-powered response.

**Request:**
```json
{
  "message": "What is the main topic of the document?"
}
```

**Response:**
```json
{
  "message": "The main topic is...",
  "sources": ["document.pdf"]
}
```

### POST `/api/upload`
Upload a document for processing.

**Request:** FormData with `file` field

**Response:**
```json
{
  "success": true,
  "documentId": "uuid",
  "message": "Document uploaded and processed successfully"
}
```

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Notes

- The app uses Gemini `text-embedding-004` model (768 dimensions)
- Documents are chunked into ~1000 character chunks with 200 character overlap
- Pinecone index is automatically created if it doesn't exist
- All metadata is stored with vectors for source attribution

## License

MIT
