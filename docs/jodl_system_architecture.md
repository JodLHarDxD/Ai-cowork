# JODL System Architecture Blueprint
Comprehensive Documentation of `jodl-workspace` and `.agents` Intelligence Layer

---

## 1. Executive Summary
The JODL system is a next-generation hybrid architecture merging a standard software monorepo (`jodl-workspace`) with a filesystem-based multi-AI coordination layer (`.agents`). It is designed to orchestrate various AI models (Claude, Gemini, Codex, GPT) to autonomously collaborate, design, build, and ship features for luxury-tier web applications without stepping on each other's toes.

## 2. System Overview
The architecture is fundamentally divided into two interconnected realms:
- **The Brain (`.agents`)**: A Git-versioned, file-system-based knowledge graph, memory store, and command bus. It acts as the cognitive layer and communication protocol for multiple AI agents.
- **The Workspace (`jodl-workspace`)**: A pnpm-based TypeScript monorepo containing a shared component library, various end-user applications, and the CLI tools that interact with the Brain.

---

## 3. The Cognitive Architecture (`.agents` Brain)
The `.agents` directory serves as the centralized intelligence and coordination hub for all AI providers. 

### 3.1 Memory Protocol & Tiers
The system enforces a strict write-protocol to maintain high signal-to-noise ratios in AI context windows. Knowledge is separated into four confidence tiers:
- **`experiments/`**: Bold, untested decisions. AIs must write here *before* executing risky code changes.
- **`staging/`**: Newly learned insights and patterns. They require validation across 2+ sessions before promotion.
- **`mistakes/`**: Confirmed failures and anti-patterns (e.g., bad React implementations or module resolution bugs). 
- **`patterns/`**: Proven solutions reused across multiple sessions or projects (e.g., feature-based architecture layouts).

### 3.2 Handoffs and Project State
- **`handoffs/`**: Chronological records of completed sessions, allowing the next AI agent (potentially a different model) to pick up exactly where the last one left off.
- **`projects/`**: Persistent state files for individual apps (e.g., `SARTA.md`, `jodl-workspace.md`).

### 3.3 The Command Bus Protocol
Instead of an API-driven message queue, JODL uses the filesystem for atomic state transitions, enabling multi-agent collaboration:
1. **Roles**: Agents are assigned roles (e.g., `master-orchestrator`, `uiux-master`, `frontend-master`).
2. **Tasks (`command-bus/active/<sess-id>/tasks/`)**:
   - `pending-<taskId>.yaml`: Unclaimed tasks.
   - `claimed-<provider>-<taskId>.yaml`: Tasks currently being worked on by an agent.
   - `done-<taskId>.yaml`: Completed tasks.
3. **Execution Loop**: Agents run a CLI command to query the bus, atomically claim a task (reading brief and context), generate a response (code, design, or sub-task JSON), write the output, and submit it back to the bus. Orchestrators can output `spawn-tasks` JSON to automatically fan-out sub-tasks to leaf agents.

---

## 4. The Monorepo Architecture (`jodl-workspace`)
The codebase follows a modern, strict TypeScript monorepo structure managed by `pnpm` and `Turborepo`.

### 4.1 Technology Stack
- **Workspaces**: pnpm 11
- **Build Pipeline**: Turborepo 2
- **Language**: TypeScript 6 (Strict Mode)
- **App Bundler**: Vite (React 19)
- **Package Bundler**: tsup
- **Runtime**: Node.js ≥ 20

### 4.2 Application Layer (`apps/`)
Applications consume the `@jodl/*` packages.
- **`sarta`**: A luxury B2C fashion ecommerce platform (React + Vite + TS). It features Zara-style video-heroes and feature-based architecture.
- **`creat-studio` & `jodlxverse`**: Creative studio and portfolio projects built heavily on React, Three.js, and GSAP.

### 4.3 Shared Packages Layer (`packages/`)
A modular system of design primitives and intelligence hooks.
- `@jodl/tokens`: Core design tokens (colors, type, spacing, motion).
- `@jodl/ui`: Primitive components (Button, Card, Modal).
- `@jodl/motion`: GSAP and Lenis presets for high-end micro-interactions.
- `@jodl/typography`: Font pairings and complex text reveal animations.
- `@jodl/patterns`: Composed, complex layouts (CartDrawer, CheckoutFlow).
- `@jodl/hooks`: React logic layer (useCart, useAuth, useSmoothScroll).
- `@jodl/system`: The intelligence layer—component registry, knowledge graph, embeddings, and agent tooling.

---

## 5. JODL CLI Engine (`tools/jodl-cli`)
The CLI bridges the gap between the `.agents` Brain and the code.

### 5.1 Intelligence Operations
- `jodl search <query>`: Semantic search over the component registry.
- `jodl compose <page> --context <theme>`: Auto-composes pages using existing registry items.
- `jodl curate <url>`: Harvests reference sites to build motion/design datasets.

### 5.2 Orchestration Operations
- `jodl next` & `jodl claim`: Safe, atomic claiming of filesystem tasks.
- `jodl submit`: Submits drafts and parses orchestrator JSON to spawn child tasks.
- `jodl agent run <name>`: Ad-hoc agent invocation.
- `jodl vendor <app> <dest>`: Extracts an app from the monorepo, resolving and inlining all `@jodl/*` dependencies for standalone delivery.

---

## 6. Conclusion
The JODL system represents a shift from static codebases to living, agent-managed workspaces. By separating the volatile, asynchronous AI reasoning (The Brain/Command Bus) from the deterministic, strict code compilation (The Workspace), it achieves highly parallelized, high-quality output for luxury software development.
