# Remote Control — Best Practices

Conventions and patterns for keeping the `web/` Next.js codebase consistent, secure, and maintainable.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Auth | Auth.js v5 (next-auth) with Google OAuth, JWT sessions |
| Database | Neon PostgreSQL (serverless) |
| ORM | Drizzle ORM |
| Data Fetching (Client) | TanStack React Query v5 |
| UI Components | shadcn/ui (radix-nova style) |
| Styling | Tailwind CSS v4 |
| Language | TypeScript (strict) |
| Package Manager | pnpm |

---

## Folder Structure

```
web/
  app/
    (auth)/                    # Auth route group (public)
      login/
        page.tsx
    (protected)/               # Protected route group (requires auth)
      dashboard/
        page.tsx
    api/
      auth/[...nextauth]/      # Auth.js route handler
        route.ts
    layout.tsx                 # Root layout (ThemeProvider, AuthProvider, QueryProvider)
    globals.css
  lib/
    auth.ts                    # Auth.js main config (adapter, JWT callbacks)
    auth.config.ts             # Edge-compatible auth config (middleware)
    db/
      schema.ts                # Single source of truth for all tables/types
      index.ts                 # Neon client + Drizzle instance
    utils.ts                   # cn() utility
  components/
    ui/                        # shadcn primitives (Button, Input, etc.)
    auth-provider.tsx          # SessionProvider wrapper
    query-provider.tsx         # React Query provider
    theme-provider.tsx         # next-themes provider
  hooks/                       # Custom React hooks
  middleware.ts                # Auth middleware (route protection)
  drizzle.config.ts            # Drizzle Kit config
```

**Rules:**
- Route files (`app/api/**/route.ts`) hold only auth, validation, and response shaping — no business logic, no Drizzle queries.
- Repositories hold Drizzle queries only — no business rules.
- Services hold business rules only — they call repositories, never Drizzle directly.
- Components are pure UI — they use React Query for data fetching, never direct DB or service calls.

---

## Authentication (Auth.js v5)

### Architecture

- **JWT session strategy** — stateless, no DB lookup per request.
- **DrizzleAdapter** — stores user/account data in Neon DB on first sign-in.
- **Edge-compatible config** (`lib/auth.config.ts`) — used by middleware. Must not import Node.js modules.
- **Main config** (`lib/auth.ts`) — full config with adapter, JWT/session callbacks.

### Flow

1. User visits `/dashboard` → middleware checks `auth()` → redirects to `/login` if unauthenticated.
2. User clicks "Sign in with Google" → `signIn("google")` → Google OAuth flow.
3. On callback → Auth.js creates/updates user in DB via DrizzleAdapter → issues JWT.
4. JWT contains `user.id` (added in `jwt` callback) → passed to `session` callback → available as `session.user.id`.

### Rules

- Always use `auth()` (server) or `useSession()` (client) to check authentication — never roll your own cookie/header checks.
- The `auth.config.ts` file must remain edge-compatible — no `drizzle`, `neon`, or other Node.js-only imports.
- Protected routes must be listed in the `authorized` callback in `auth.config.ts`.
- Use `"use server"` actions for sign-out (server action) and `signIn("google")` for sign-in (client call).
- Never expose the JWT or session token to client-side JavaScript.

---

## API Routes

Every route handler must follow this order:

1. `export const dynamic = 'force-dynamic'` — top of every route file
2. `auth()` — first call; return 401 if it fails
3. Zod validation of the request body — return 400 with `{ error }` on failure
4. Call the service layer — never call repositories directly
5. Return `{ data }` on success, `{ error }` on failure, with appropriate HTTP status codes

```ts
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const result = await SomeService.create(session.user.id, parsed.data);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ data: result.data }, { status: 201 });
}
```

**Rules:**
- Always return `{ data: T }` for success and `{ error: string }` for failure — never naked objects.
- Dynamic route params (`context.params`) must be `await`ed in Next.js 15+.
- Never expose internal error details to the client — log with `console.error('[ServiceName] ...')` and return a generic message.

---

## Repository Pattern

```ts
// lib/repositories/example.repository.ts
export const ExampleRepository = {
  async findByUserId(userId: string) { ... },
  async findById(id: string, userId: string) { ... },
  async create(data: NewExample) { ... },
  async update(id: string, userId: string, data: Partial<...>) { ... },
  async delete(id: string, userId: string) { ... },
};
```

**Rules:**
- Every method that touches user data must accept and filter by `userId` — never return another user's data.
- Single-item lookups return `T | undefined`, never throw on not-found.
- Paginated lookups return `{ data: T[]; total: number }`.
- No business logic — only Drizzle queries and simple mapping.
- Export types alongside the repository when consumers need them.

---

## Service Layer

```ts
// lib/services/example.service.ts
type ServiceResult<T> = { data: T; error: null } | { data: null; error: string };

export const ExampleService = {
  async create(userId: string, input: CreateInput): Promise<ServiceResult<Example>> {
    try {
      const record = await ExampleRepository.create({ ...input, userId });
      return { data: record, error: null };
    } catch (err) {
      console.error('[ExampleService] create error:', err);
      return { data: null, error: 'Failed to create resource' };
    }
  },
};
```

**Rules:**
- Always return `ServiceResult<T>` — never throw from a service method.
- Wrap every method body in `try/catch`; log with `[ServiceName] method error:` prefix.
- Services may call other services, but never Drizzle directly.

---

## Database & Migrations

**Rules:**
- All schema changes go in `lib/db/schema.ts` only.
- Push schema changes with `pnpm db:push` — never write SQL migration files by hand.
- Never run `ALTER TABLE`, `CREATE TABLE`, or any raw DDL directly against the database.
- Use `numeric` (with precision/scale) for all monetary columns — never `float` or `real`.
- Every `varchar` must have a `length` specified.
- Add Drizzle `index()` on any column used in `WHERE` clauses across multiple rows.
- Use `pgEnum` for fixed-value status/type columns.
- Use `onDelete: 'cascade'` for foreign keys referencing `users.id`.
- Infer TypeScript types from the schema with `$inferSelect` / `$inferInsert` — never hand-write types that duplicate schema columns.
- The Drizzle instance is created in `lib/db/index.ts` using `@neondatabase/serverless` — import `db` from there, never create new connections.

---

## React Query

**Rules:**
- Use `useQuery` for data fetching in Client Components — never `useEffect + fetch`.
- Always handle `isLoading` and `error` states from `useQuery` — no blank screens.
- Default config: `staleTime: 60s`, `retry: 1` (no retry on 401/403), `refetchOnWindowFocus: false`.
- Use `useMutation` for POST/PATCH/DELETE — invalidate related queries in `onSuccess`.
- Query keys should follow the pattern `[resource, id?, ...filters]` — e.g. `['users']`, `['expenses', expenseId]`.

---

## TypeScript

**Rules:**
- Never use `any`. Use `unknown` and narrow it, or define a proper type.
- Never use `@ts-ignore` or `@ts-expect-error` without a comment explaining why.
- Import types with `import type` when the value isn't used at runtime.
- Use `@/` path aliases everywhere — no relative `../../` imports.
- Response shapes: `{ data: T }` / `{ error: string }` — define in the service or shared types file, not inline.

---

## Zod Validation

Every `POST`, `PATCH`, and `PUT` route must validate its request body with Zod:

```ts
const createSchema = z.object({
  name: z.string().min(1).max(255),
});
```

**Rules:**
- Use `.safeParse()` — never `.parse()` in route handlers (avoid unhandled throws).
- Return `{ error: 'Invalid input' }` with `status: 400` on validation failure.
- Reuse schemas with `.partial()` or `.extend()` where shapes overlap.

---

## Security

**Rules:**
- `auth()` must be the first call in every protected route handler — check `session?.user`.
- Always scope DB queries to the authenticated user's ID — never trust `userId` from request body or query params.
- Store all secrets in `.env` — never hardcode API keys, tokens, or credentials.
- Never commit `.env` to the repository (gitignored).
- Return generic error messages to clients — never expose stack traces, DB errors, or internal field names.
- Log detailed errors server-side with `console.error`.

---

## Error Handling

| Layer | Pattern |
|---|---|
| Service | `try/catch` → return `ServiceResult<T>` |
| Route | Check `result.error` → return `{ error }` with status |
| Client | Handle `error` from `useQuery` — show inline message, not blank screen |

**Log format:** `[ServiceName] methodName error:` followed by the caught error object.

---

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Route files | Next.js convention | `route.ts` |
| Repository files | `<entity>.repository.ts` | `expense.repository.ts` |
| Service files | `<entity>.service.ts` | `expense.service.ts` |
| Utility files | `kebab-case` | `api-auth.ts` |
| Components | `PascalCase.tsx` | `ExpenseCard.tsx` |
| Types/interfaces | `PascalCase` | `ServiceResult<T>`, `ExpenseWithCategory` |
| Zod schemas | `camelCase` + `Schema` suffix | `createExpenseSchema` |
| Log prefixes | `[PascalCaseName]` | `[ExpenseService]` |

---

## Styling (Web UI)

- Use Tailwind utility classes — no inline `style` props, no custom CSS for standard layouts.
- Use `cn()` for conditional class composition.
- Design mobile-first: apply responsive prefixes (`sm:`, `md:`, `lg:`) for breakpoints.
- Never hardcode hex color values in components — use Tailwind theme colors.
- Touch targets must be at least 44x44px on mobile.

---

## Component Rules

- Mark interactive Client Components with `'use client'` at the top of the file.
- Components are purely presentational — no direct DB calls, no fetch in `useEffect`.
- Keep component files under ~200 lines; extract sub-components if exceeded.
- One component per file; file name matches component name in kebab-case.
- Use `useQuery` (TanStack Query) for data fetching in Client Components — never `useEffect + fetch`.
- Always handle `isLoading` and `error` states from `useQuery` — no blank screens.

---

## Environment Variables

| Variable | Purpose | Example |
|---|---|---|
| `AUTH_GOOGLE_ID` | Google OAuth Client ID | From Google Cloud Console |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret | From Google Cloud Console |
| `AUTH_SECRET` | Auth.js encryption key | Generated with `openssl rand -base64 32` |
| `AUTH_URL` | Base URL of the app | `http://localhost:3000` |
| `DATABASE_URL` | Neon PostgreSQL connection string | `postgresql://...neon.tech/...` |

---

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start dev server (Turbopack) |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm format` | Format with Prettier |
| `pnpm db:push` | Push schema changes to Neon DB |
| `pnpm db:generate` | Generate SQL migration files |
| `pnpm db:studio` | Open Drizzle Studio |
