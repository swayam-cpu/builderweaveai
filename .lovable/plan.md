# Per-project generated database

Each site (project) gets its own logical database. The AI designs the tables from the prompt, and the generated HTML can list/insert/update/delete rows.

## Approach: JSONB-backed logical tables (not raw DDL)

Real per-project schemas would need runtime DDL (dangerous, slow, and doesn't fit RLS cleanly). Instead:

- `site_tables` — one row per logical table (name, columns definition as JSONB).
- `site_rows` — one row per record, `data JSONB`, linked to `site_tables`.
- Everything scoped by `site_id → sites.owner_id`; RLS reuses existing ownership.
- Published sites can expose read-only data anonymously via a public server route keyed by slug.

Pros: no DDL at runtime, full RLS, works for any schema the AI designs, easy to render in a spreadsheet UI later.

## Scope of this step

1. **Migration** — create `site_tables` and `site_rows` with RLS + grants.
2. **AI schema designer** — new server fn `designSiteSchema({ siteId, prompt })` that calls Lovable AI, returns `{ tables: [{ name, columns: [{ name, type, required }] }] }`, and upserts rows into `site_tables`.
3. **Row CRUD server fns** — `listRows`, `insertRow`, `updateRow`, `deleteRow` (owner-only via `requireSupabaseAuth`).
4. **Public read route** — `GET /api/public/sites/$slug/data/$table` returns rows for published sites (anon SELECT policy).
5. **Update site generator** — inject the site's schema + a tiny `window.WeaveDB` JS SDK into the generated HTML, so the AI writes pages that read/write the project's tables.
6. **Builder UI** — a "Database" tab on `/builder/$id` showing the AI-designed tables and their rows in read-only form (the no-code editor is the next milestone).

## Data model

```text
site_tables
  id uuid pk
  site_id uuid fk → sites.id (cascade)
  name text (unique per site)
  columns jsonb  -- [{ name, type: 'text'|'number'|'boolean'|'date'|'url', required }]
  created_at timestamptz

site_rows
  id uuid pk
  site_id uuid fk → sites.id (cascade)
  table_id uuid fk → site_tables.id (cascade)
  data jsonb
  created_at, updated_at timestamptz
```

RLS: `owner via sites.owner_id` for authenticated CRUD. Anonymous SELECT on `site_rows` only when the parent `sites.is_published = true` (via a security-definer helper).

## What the generated site sees

The builder passes the schema into the AI prompt and injects this into the HTML `<head>`:

```html
<script>
  window.WEAVE_SITE = { slug: "site-abc123" };
  window.WeaveDB = {
    list: (table) => fetch(`/api/public/sites/${WEAVE_SITE.slug}/data/${table}`).then(r => r.json())
  };
</script>
```

Writes stay in the builder (owner-only) for now; public write endpoints are a later step (needs per-project auth).

## Out of scope for this step
- No-code spreadsheet editor (next milestone)
- Auth for end users of generated apps
- Public write endpoints
- File/image uploads inside generated apps
