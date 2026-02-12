

# AI Research Assistant — Full Build Plan

## Overview
A production-grade AI Research Assistant with ChatGPT-style interface, document analysis, multi-document comparison, translation, audio features, analytics, and more. Built with React + Tailwind + Supabase, featuring a dark-first glassmorphism design with neon accents.

---

## 🎨 Design System
- **Theme**: Dark mode primary with glassmorphism cards, frosted glass panels, subtle neon accent colors (cyan/purple)
- **Light mode**: Toggle available via header
- **Animations**: Skeleton loaders, smooth transitions, micro-interactions, upload progress bars
- **Layout**: Collapsible left sidebar + main content area, fully responsive

---

## 🔐 1. Authentication System
- **Signup**: Email + password with Supabase Auth email verification
- **Login**: Email/password with secure session (Supabase handles JWT)
- **Forgot Password**: Reset link via Supabase Auth
- **Passwords**: Hashed by Supabase Auth (bcrypt, industry standard — more secure than SHA256)

## 👤 2. User Profile System
- Profile photo upload (Supabase Storage)
- Name & basic info editing
- Change password
- View feedback history, starred chats, pinned chats

## 💬 3. Chat System (ChatGPT-style)
- **Left Sidebar**: Chat history ordered by recency, "New Chat" button
- **Per-chat 3-dot menu**: Pin, Star, Add Tag, Delete
- **Tags**: 🟢 Interview, 🔵 Exam, 🟡 Research — shown as colored indicators on chat cards
- **Context continuity**: Reopening a chat restores full conversation history
- **Per-user storage**: All chats stored in Supabase, scoped to the authenticated user

## 📄 4. Document Upload & Research Engine
- Upload PDFs (up to 30MB) with animated progress bar
- PDF text extraction via edge function
- Metadata stored in Supabase database, files in Supabase Storage
- Automatically opens a chat session linked to the uploaded document
- Ask questions, summarize, or generate insights via Qwen API (called from edge functions)

## 🌐 5. URL Upload & Safety Check
- Paste URL with animated input panel
- Phishing/safety check with visual confidence meter (green/orange/red)
- Content scraped and processed, loaded into chat for interaction

## 📊 6. Multi-Document Comparison
- Upload 2 PDFs simultaneously
- Structured comparison: algorithms, evaluation metrics, results
- Output displayed in chat format

## 🌍 7. Translation Feature
- Supported languages: English, Telugu, Hindi, Tamil, Spanish, Japanese
- Translate chat outputs and document summaries
- Uses a public translation API via edge function

## 🎙 8. Audio Features
- **Speech-to-Text**: Microphone input transcribed and inserted into chat
- **Text-to-Speech**: AI response read aloud via browser speech synthesis

## 🗂 9. Home Dashboard
- Two primary action cards: "Upload Document" and "Paste URL"
- Below: 10 recent document cards per user (title, date, preview)
- Clicking a card reopens the linked chat

## 📄 10. Document Generation
- Convert chat conversation into structured PDF summary
- Export comparison reports as downloadable PDF

## 📈 11. Analytics / Data Visualization
- Personal dashboard with recharts (already installed)
- Daily research streak, hours researched, PDFs analyzed, chat activity
- Line graph and bar graph visualizations

## ⭐ 12. Feedback System
- Popup when closing a chat session: "Helpful" or "Not Helpful"
- Feedback stored per user, viewable in profile dashboard
- Only triggers on session close, not per message

## 🧠 13. Domain Mode Toggle
- **General Mode**: Open Q&A with Qwen
- **Domain Mode**: Queries scoped to uploaded research documents only (vector-like retrieval from user's document corpus)

## 🗄 Database Architecture (Supabase PostgreSQL)
- **profiles**: user info, avatar URL
- **conversations**: chat sessions with tags, pinned/starred status
- **messages**: chat messages per conversation
- **documents**: PDF metadata, storage path, linked conversation
- **feedback**: per-session feedback records
- **analytics_events**: track user activity for visualization
- RLS policies on all tables scoped to authenticated user

## 🔒 Security
- Supabase Auth (JWT-based sessions)
- Row-Level Security on all tables
- API keys stored as Supabase secrets (edge functions only)
- Input sanitization and file validation
- No secrets in client code

## ⚙️ Backend (Supabase Edge Functions)
- `chat`: Send messages to Qwen API with conversation context
- `extract-pdf`: Extract text from uploaded PDFs
- `scrape-url`: Fetch and parse URL content
- `url-safety`: Check URL against phishing detection
- `translate`: Translate text to target language
- `generate-pdf`: Convert chat to downloadable PDF

