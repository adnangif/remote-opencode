# SpendInsights Web — Best Practices

Conventions and patterns for keeping the `apps/web` Next.js codebase consistent, secure, and maintainable. Derived from the automated code review guidelines in `.github/instructions/`.

---

## Folder Structure

```
app/
  api/                        # Route handlers only — no business logic
    auth/
    expenses/
    recurring-expenses/
    cron/
  lib/
    db/
      schema.ts               # Single source of truth for all tables/types
    repositories/             # Data access only — one file per resource
      expense.repository.ts
      recurring-expense.repository.ts
    services/                 # Business logic — one file per resource
      expense.service.ts
      recurring-expense.service.ts
    api-auth.ts               # Shared auth helper (checkApiAuth)
  components/                 # Reusable UI — no API calls, no direct DB access
    ui/                       # Primitives: Button, Input, Badge, etc.
```

**Rules:**
- Route files (`app/api/**/route.ts`) hold only auth, validation, and response shaping — no business logic, no Drizzle queries.
- Repositories hold Drizzle queries only — no business rules.
- Services hold business rules only — they call repositories, never Drizzle directly.
- Components are pure UI — they call APIs, never the DB or service layer.

---

## API Routes

Every route handler must follow this order:

1. `export const dynamic = 'force-dynamic'` — top of every route file
2. `checkApiAuth(request)` — first line inside the handler; return 401 if it fails
3. Zod validation of the request body — return 400 with `{ error }` on failure
4. Call the service layer — never call repositories directly
5. Return `{ data }` on success, `{ error }` on failure, with appropriate HTTP status codes

```ts
// Good ✅
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await checkApiAuth(request);
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  const result = await SomeService.create(auth.userId, parsed.data);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ data: result.data }, { status: 201 });
}
```

**Rules:**
- Always return `{ data: T }` for success and `{ error: string }` for failure — never naked objects.
- Dynamic route params (`context.params`) must be `await`ed in Next.js 15.
- Cron routes use `Authorization: Bearer ${CRON_SECRET}` instead of `checkApiAuth`.
- Never expose internal error details to the client — log with `console.error('[ServiceName] ...')` and return a generic message.

---

## Repository Pattern

```ts
// app/lib/repositories/expense.repository.ts
export const ExpenseRepository = {
  async findByUserId(userId: string): Promise<Expense[]> { ... },
  async findById(id: string, userId: string): Promise<Expense | undefined> { ... },
  async create(data: NewExpense): Promise<Expense> { ... },
  async update(id: string, userId: string, data: Partial<...>): Promise<Expense> { ... },
  async delete(id: string, userId: string): Promise<void> { ... },
};
```

**Rules:**
- Every method that touches user data must accept and filter by `userId` — never return another user's data.
- Single-item lookups return `T | undefined`, never throw on not-found.
- Paginated lookups return `{ data: T[]; total: number }`.
- No business logic — only Drizzle queries and simple mapping.
- Export types alongside the repository when consumers need them (e.g. `ExpenseWithCategory`).

---

## Service Layer

```ts
// app/lib/services/expense.service.ts
type ServiceResult<T> = { data: T; error: null } | { data: null; error: string };

export const ExpenseService = {
  async create(userId: string, input: CreateInput): Promise<ServiceResult<Expense>> {
    try {
      const record = await ExpenseRepository.create({ ...input, userId });
      return { data: record, error: null };
    } catch (err) {
      console.error('[ExpenseService] create error:', err);
      return { data: null, error: 'Failed to create expense' };
    }
  },
};
```

**Rules:**
- Always return `ServiceResult<T>` — never throw from a service method.
- Wrap every method body in `try/catch`; log with `[ServiceName] method error:` prefix.
- Convert numbers to strings when writing to Drizzle `numeric` columns (`String(amount)`).
- Fire-and-forget async side effects with `void` — never `await` them if they aren't critical.
- Services may call other services, but never Drizzle directly.

---

## Database & Migrations

**Rules:**
- All schema changes go in `app/lib/db/schema.ts` only.
- Generate migrations with `pnpm drizzle-kit generate` — never write SQL migration files by hand.
- Never run `ALTER TABLE`, `CREATE TABLE`, or any raw DDL directly against the database.
- Use `numeric` (with precision/scale) for all monetary columns — never `float` or `real`.
- Every `varchar` must have a `length` specified.
- Add Drizzle `index()` on any column used in `WHERE` clauses across multiple rows.
- Use `pgEnum` for fixed-value status/type columns.
- Use `onDelete: 'cascade'` for foreign keys referencing `users.id`.
- Infer TypeScript types from the schema with `$inferSelect` / `$inferInsert` — never hand-write types that duplicate schema columns.

---

## TypeScript

**Rules:**
- Never use `any`. Use `unknown` and narrow it, or define a proper type.
- Never use `@ts-ignore` or `@ts-expect-error` without a comment explaining why.
- Import types with `import type` when the value isn't used at runtime.
- Use `@/app/` path aliases everywhere — no relative `../../` imports.
- Response shapes returned by route handlers should match `{ data: T }` / `{ error: string }` — define these types in the service or a shared types file, not inline.

---

## Zod Validation

Every `POST`, `PATCH`, and `PUT` route must validate its request body with Zod before passing data to the service:

```ts
const createSchema = z.object({
  merchant: z.string().min(1).max(255),
  amount: z.number().positive(),
  tax: z.number().min(0).optional(),
  currency: z.string().length(3),
  categoryId: z.string().uuid().nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
```

**Rules:**
- Use `.safeParse()` — never `.parse()` in route handlers (avoid unhandled throws).
- Return `{ error: 'Invalid input' }` with `status: 400` on validation failure.
- Reuse schemas across routes where the shape is the same (e.g. create vs update with `.partial()`).

---

## Security

**Rules:**
- `checkApiAuth(request)` must be the first call in every user-facing route handler.
- Always scope DB queries to `auth.userId` — never trust a `userId` from the request body or query params.
- Store all secrets in environment variables — never hardcode API keys, tokens, or credentials.
- Cron routes must check `Authorization: Bearer ${CRON_SECRET}` and return 401 immediately if it fails or the secret is not set.
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
| Log prefixes | `[PascalCaseName]` | `[RecurringExpenseService]` |

---

## Styling (Web UI)

- Use Tailwind utility classes — no inline `style` props, no custom CSS for standard layouts.
- Use `clsx` or `cn()` for conditional class composition.
- Design mobile-first: apply responsive prefixes (`sm:`, `md:`, `lg:`) for breakpoints.
- Never hardcode hex color values in components — use Tailwind theme colors.
- Touch targets must be at least 44×44px on mobile.

---

## Component Rules

- Mark interactive Client Components with `'use client'` at the top of the file.
- Components are purely presentational — no direct DB calls, no fetch in `useEffect`.
- Keep component files under ~200 lines; extract sub-components if exceeded.
- One component per file; file name matches component name in kebab-case.
- Use `useQuery` (TanStack Query) for data fetching in Client Components — never `useEffect + fetch`.
- Always handle `isLoading` and `error` states from `useQuery` — no blank screens.
