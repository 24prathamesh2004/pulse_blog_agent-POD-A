# Supabase Database — Pulse Autonomous Newsroom

This document covers the complete database design for the Pulse project. Pulse is an
autonomous, multi-agent newsroom platform that discovers, scrapes, curates, and publishes
news articles using a local LLM. Everything the application does — from running agents to
serving the public frontend — is backed by this database.

The database runs on Supabase (PostgreSQL 15) with the pgvector extension for semantic
search and embeddings.

---

## Contributors

- Auth and Observability schema — Varsha
- Content Pipeline and Editorial Structure schema — Sakshi

---

## Table of Contents

1. Project Overview
2. Migration Files
3. Extensions
4. Shared Utilities
5. Auth and Observability Schema
6. Content Pipeline and Editorial Structure Schema
7. Row Level Security
8. pgvector Search Functions
9. Enums Reference


---

## 1. Project Overview

The database is the single source of truth for the entire Pulse platform. It stores:

- The content that agents discover, scrape, and write
- The editorial structure that organizes content into categories and storylines
- The observability data that tracks every agent run and tool call
- The authentication and authorization data for admin users
- The analytics data for visits and user questions

The schema is designed around a pipeline model. Raw URLs enter as candidates, get scraped
and scored, and eventually become published posts. Every step of that pipeline is logged
in the database so the system is fully auditable.

---

## 2. Migration Files

Migrations are applied in filename order. Each file is owned by a specific contributor
so that individual work is clearly visible in version control.


### 20260501144056_extensions-and-shared-setup.sql
Owner: Varsha

Sets up the PostgreSQL extensions that the rest of the schema depends on, and defines
the shared trigger helper function used across multiple tables.

### 20260501144100_auth-and-observability.sql
Owner: Varsha

Creates all tables related to user authentication, role management, agent observability,
analytics tracking, and application settings. Also defines the functions and triggers
that automatically provision new users.

### 20260501144200_content-pipeline-and-editorial.sql
Owner: Sakshi

Creates all tables that form the content pipeline and editorial structure. This includes
the categories that organize content, the sources that feed the pipeline, the candidates
that flow through it, and the posts that come out the other end. Also defines the
pgvector search functions used by the RAG system and the curator agent.

### 20260501144300_security-patches.sql
Owner: Sakshi

Hardens the security posture of the database by fixing function search paths and moving
the extensions out of the public schema into a dedicated extensions schema.

---

## 3. Extensions

Two PostgreSQL extensions are installed.

### vector (pgvector)
Adds a native vector data type and vector similarity operators to PostgreSQL. This is
what makes semantic search possible. The application stores 768-dimensional embeddings
produced by the nomic-embed-text model directly in the database, and uses the cosine
distance operator to find similar content.

Used in: posts.embedding, post_chunks.embedding, match_posts(), match_post_chunks()

### pg_trgm
Adds trigram-based text similarity functions. Trigrams are sets of three consecutive
characters extracted from a string. This extension enables fast fuzzy text search and
similarity matching on text columns.

After the security patch migration, both extensions are moved from the public schema
into a dedicated extensions schema to follow the principle of least privilege.

---

## 4. Shared Utilities

### touch_updated_at()

A trigger function that automatically sets the updated_at column to the current
timestamp whenever a row is updated. This is attached as a BEFORE UPDATE trigger on
every table that has an updated_at column.

Without this, the application would have to manually set updated_at in every update
query, which is error-prone. The trigger handles it at the database level so it cannot
be forgotten.

Tables that use this trigger: categories, sources, posts, settings

---

## 5. Auth and Observability Schema

This section covers the tables owned by Varsha.

### profiles

Stores public-facing user information for every registered user. A row is automatically
created in this table whenever a new user signs up through Supabase Auth.

Columns:
- id: The user's UUID, which is a foreign key to auth.users. This is the primary key.
- email: The user's email address, copied from auth.users at signup time.
- display_name: A human-readable name. Defaults to the part of the email before the
  @ symbol if no display name is provided.
- created_at: When the profile was created.

This table exists separately from auth.users because auth.users is managed by Supabase
internally and should not be modified directly. The profiles table is the application's
own record of user identity.

### user_roles

Stores the role assigned to each user. The application has two roles: admin and user.
Admins can access the newsroom dashboard, trigger agent pipelines, manage sources, and
view all analytics. Regular users have read-only access to published content.

Columns:
- id: UUID primary key.
- user_id: Foreign key to auth.users.
- role: The assigned role, either admin or user.
- created_at: When the role was assigned.

The combination of user_id and role is unique, so a user cannot be assigned the same
role twice.

### has_role(user_id, role)

A SQL function that checks whether a given user has a given role. It returns true or
false. This function is used extensively in Row Level Security policies throughout the
schema to gate access to admin-only tables and operations.

It is defined as SECURITY DEFINER, which means it runs with the privileges of the
function owner rather than the calling user. This is necessary because RLS policies
need to query user_roles, but the user_roles table itself is protected by RLS. Without
SECURITY DEFINER, the function would hit an infinite loop.

Execute permission is granted only to authenticated users and service_role. Anonymous
users cannot call this function.

### handle_new_user()

A trigger function that fires after every new row is inserted into auth.users. It does
two things:

First, it creates a corresponding row in the profiles table with the new user's id,
email, and display name.

Second, it assigns a role. If there are no existing rows in user_roles at the time of
signup, the new user is assigned the admin role. This handles the bootstrap case where
the very first person to sign up becomes the administrator. Every subsequent user is
assigned the user role.

This trigger runs automatically and requires no action from the application code.

### agent_runs

Records every execution of every agent in the pipeline. When an agent starts, a row is
inserted with status running. When it finishes, the row is updated with the final
status, output, token counts, and finish time.

Columns:
- id: UUID primary key.
- agent: Which agent ran. One of: orchestrator, keyword, discovery, scraper, curator,
  editor, publisher.
- parent_run_id: Self-referencing foreign key. When the orchestrator spawns child
  agents, each child records the orchestrator's run id here. This creates a tree
  structure that lets you trace a full pipeline execution.
- category_id: Which category this run was for.
- status: Current state. One of: running, succeeded, failed, cancelled.
- input: The JSON input that was passed to the agent.
- output: The JSON result the agent produced.
- error: If the agent failed, the error message is stored here.
- tokens_in: Number of tokens sent to the LLM during this run.
- tokens_out: Number of tokens received from the LLM during this run.
- started_at: When the run began.
- finished_at: When the run ended. Null if still running.

An index on started_at DESC makes it fast to query recent runs.

### tool_calls

Records every individual tool invocation made by an agent during a run. Agents call
external tools like RSS parsers, web scrapers, and the LLM. Each call is logged here
with its arguments, result, and how long it took.

Columns:
- id: UUID primary key.
- run_id: Foreign key to agent_runs. Every tool call belongs to a run.
- tool: The name of the tool that was called, such as rss, fetch_extract,
  google_trends, or storyline_match.
- args: The JSON arguments passed to the tool.
- result: The JSON result returned by the tool.
- error: If the tool call failed, the error message.
- latency_ms: How many milliseconds the tool call took.
- created_at: When the tool was called.

This table is the most granular level of observability in the system. If an agent run
fails, you can look at the tool_calls for that run to see exactly which step went wrong
and what the inputs and outputs were.

### visits

Tracks daily view counts for each published post. Rather than storing one row per page
view, which would grow very large, this table stores one row per post per day with an
aggregate count.

Columns:
- post_id: Foreign key to posts.
- day: The calendar date.
- count: How many times the post was viewed on that day.

The primary key is the combination of post_id and day, which enforces one row per post
per day. To record a view, the application does an upsert that increments the count.

### rag_questions

Stores every question asked through the RAG (Retrieval-Augmented Generation) interface,
along with the answer that was generated and the source citations.

Columns:
- id: UUID primary key.
- user_id: The user who asked the question, if they were authenticated. Null for
  anonymous questions.
- post_id: If the question was asked in the context of a specific article, that
  article's id is stored here. Null for questions asked against the full archive.
- question: The text of the question.
- answer: The LLM-generated answer.
- citations: A JSON array of citation objects. Each citation includes the chunk number,
  the post id, the post slug, the post title, and the similarity score.
- created_at: When the question was asked.

This table serves two purposes. It is a log of user activity, and it is a dataset that
could be used to evaluate and improve the RAG system over time.

### settings

A key-value store for application configuration. The application reads settings from
this table at runtime rather than relying solely on environment variables, which means
settings can be changed without redeploying.

Columns:
- key: The setting name. This is the primary key.
- value: The setting value stored as JSON.
- updated_at: When the setting was last changed.

The table is seeded with two default rows:
- llm: Contains the Ollama connection details including base URL, model names, and API
  key. The admin can update these from the newsroom settings panel.
- agents_enabled: A boolean flag that can be used to pause all agent activity.

---

## 6. Content Pipeline and Editorial Structure Schema

This section covers the tables owned by Sakshi.

### categories

Defines the editorial sections of the newsroom. Each category represents a topic area
and has its own autonomous publishing policy. The application ships with six default
categories: Artificial Intelligence, Climate and Energy, Markets, Geopolitics, Science,
and Culture.

Columns:
- id: UUID primary key.
- slug: A URL-safe identifier like ai or climate. Used in routes and as a stable
  reference across the codebase.
- name: The human-readable category name.
- description: A short description of what the category covers.
- color: A hex color used for UI accents.
- gradient_from and gradient_to: Two hex colors that define the gradient used for
  category chips and hero backgrounds.
- icon: The name of the Lucide icon used to represent this category.
- autonomy_mode: Controls how the agent pipeline behaves for this category. One of:
  - auto_publish: Articles are published immediately without human review.
  - draft_only: Articles are created as drafts and require a human to publish them.
  - off: The pipeline does not run for this category at all.
- schedule_cron: A cron expression that defines how often the pipeline should run for
  this category. Defaults to every four hours.
- quality_threshold: The minimum quality score (0 to 100) an article must receive from
  the curator agent to be accepted. Articles scoring below this are rejected.
- max_per_run: The maximum number of articles the editor agent will write in a single
  pipeline run for this category.
- dedup_window_hours: How far back in time the system looks when checking for duplicate
  content. Articles similar to something published within this window are rejected.
- enabled: Whether this category is active. Disabled categories are skipped by the
  scheduler.
- sort_order: Controls the display order of categories in the UI.
- created_at and updated_at: Timestamps managed automatically.

### sources

Stores the RSS feeds and web sources that the discovery agent monitors for new content.
Each source belongs to a category and feeds articles into that category's pipeline.

Columns:
- id: UUID primary key.
- category_id: Which category this source feeds into.
- name: A human-readable label for the source.
- url: The URL of the RSS feed or web page. This is unique across all sources.
- type: Either rss or web.
- enabled: Whether the discovery agent should check this source.
- last_ok_at: The last time the source was successfully fetched.
- last_error: The most recent error message if the source failed to fetch.
- error_count: How many consecutive failures have occurred. The application can use
  this to automatically disable unreliable sources.
- trust_score: A 0 to 100 score representing how reliable this source is. Currently
  set manually but could be computed automatically in the future.
- created_at and updated_at: Timestamps managed automatically.

### keywords

Stores trending search terms discovered by the keyword agent. These terms are used by
the discovery agent to search for relevant news articles beyond what RSS feeds provide.

Columns:
- id: UUID primary key.
- category_id: Which category this keyword belongs to.
- term: The keyword or phrase itself.
- score: A numeric relevance score. Higher scores indicate more trending terms.
- trend_direction: A label describing the trend, such as rising or news.
- related: A JSON array of related terms that were discovered alongside this one.
- captured_at: When this keyword was discovered.

Keywords are not deduplicated across runs. Each pipeline run inserts fresh keywords.
The captured_at timestamp allows the application to use only recent keywords.

### storylines

Represents an ongoing narrative thread that groups related articles together. When the
editor agent publishes a new article, it computes the article's embedding and compares
it against recent storylines. If the similarity is above 0.75, the article is linked to
that storyline. Otherwise a new storyline is created.

Columns:
- id: UUID primary key.
- title: A broad narrative title generated by the LLM, such as "OpenAI's GPT-5
  Development" rather than the specific headline of any one article.
- entity: The main entity the storyline is about, such as a person, company, or
  country. Extracted by the LLM.
- summary: A two-sentence synthesis of all the events in this storyline, regenerated
  by the LLM each time a new article is linked.
- started_at: When the first article in this storyline was published.
- last_event_at: When the most recent article was linked. Used to filter for active
  storylines and to sort the timeline view.
- created_at: When the storyline record was created.

### posts

The central table of the entire application. Stores every article that has been written
by the editor agent, whether it is a draft awaiting review or a published piece.

Columns:
- id: UUID primary key.
- slug: A URL-safe identifier used in the article's public URL. Generated from the
  title with a random suffix to avoid collisions.
- title: The article headline, up to 90 characters.
- subtitle: A secondary headline, up to 140 characters.
- body_md: The full article body in Markdown format, typically 500 to 900 words.
- hero_url: URL of the hero image. Extracted from the source article's og:image tag.
- hero_prompt: A vivid illustration prompt generated by the LLM, intended for use with
  an image generation model.
- summary: A two-sentence summary of the article.
- takeaways: A JSON array of three to five bullet point takeaways.
- category_id: Which category this article belongs to.
- storyline_id: Which storyline this article is part of, if any.
- status: The publication state. One of: draft, published, rejected, archived.
- quality_score: The score assigned by the curator agent, from 0 to 100.
- source_url: The URL of the original article that was rewritten.
- source_name: The domain name of the source, such as techcrunch.com.
- reasoning: Internal notes from the curator agent explaining the quality score.
- published_at: When the article was published. Null for drafts.
- embedding: A 768-dimensional vector embedding of the article's title and summary.
  Used for semantic deduplication and RAG retrieval.
- created_at and updated_at: Timestamps managed automatically.

Several indexes are created on this table:
- A composite index on status and published_at for fast feed queries.
- A composite index on category_id and published_at for category feed queries.
- A unique index on slug to enforce URL uniqueness.
- A partial index on published_at filtered to published articles only.
- An IVFFlat index on the embedding column for fast approximate nearest neighbor
  search. The lists parameter is set to 100, which is appropriate for a collection
  of up to 1 million rows.

### post_chunks

Stores the article body split into overlapping chunks of approximately 800 words, each
with its own embedding. This is the foundation of the RAG system.

When a user asks a question, the question is embedded and compared against all chunks
in this table. The most similar chunks are retrieved and passed to the LLM as context
for generating an answer. Chunking is necessary because the full article body is too
long to embed as a single vector without losing detail.

Columns:
- id: UUID primary key.
- post_id: Foreign key to posts. Deleting a post cascades to delete all its chunks.
- idx: The zero-based position of this chunk within the article. Used to reconstruct
  the reading order if needed.
- content: The text content of this chunk.
- embedding: A 768-dimensional vector embedding of the chunk content.
- created_at: When the chunk was created.

An IVFFlat index on the embedding column enables fast similarity search. A composite
index on post_id and idx enables fast retrieval of all chunks for a specific article.

### storyline_events

A join table that links posts to storylines. Each row represents one article being part
of one storyline.

Columns:
- id: UUID primary key.
- storyline_id: Foreign key to storylines.
- post_id: Foreign key to posts.
- occurred_at: When this event was recorded, which is approximately when the article
  was published.

The combination of storyline_id and post_id is unique, so an article cannot be linked
to the same storyline twice.

### candidates

Stores URLs that have been discovered by the discovery agent but have not yet been
processed into published articles. A candidate moves through several status values as
it progresses through the pipeline.

Columns:
- id: UUID primary key.
- url: The URL of the discovered article. Unique across all candidates.
- title: The title extracted from the RSS feed or news search result.
- source_id: Which source this candidate came from, if it came from an RSS feed.
- keyword_id: Which keyword search led to this candidate, if applicable.
- category_id: Which category this candidate belongs to.
- raw_text: The plain text content extracted by the scraper agent using Mozilla
  Readability. Up to 50,000 characters.
- raw_html: The parsed HTML content extracted by the scraper agent. Up to 200,000
  characters.
- hero_url: The og:image URL extracted from the article page.
- status: The current pipeline stage. One of:
  - discovered: The URL has been found but not yet scraped.
  - scraped: The content has been extracted successfully.
  - approved: The curator agent has scored this article above the quality threshold.
  - rejected: The curator agent rejected this article, either because it was a
    duplicate, scored too low, or the scraper found insufficient content.
  - duplicate: Specifically rejected because a semantically similar article already
    exists in the posts table.
  - published: The editor agent has written and published an article from this
    candidate.
- reason: A human-readable explanation of why the candidate was rejected or approved,
  appended by each agent as it processes the candidate.
- discovered_at: When this URL was first found.

Two indexes are created: one on status and discovered_at for pipeline queries, and one
on category_id and status for filtering candidates by category and stage.

---

## 7. Row Level Security

Every table in the schema has Row Level Security enabled. This means that by default,
no row is accessible unless a policy explicitly permits it. The application uses the
Supabase service role key on the server side, which bypasses RLS entirely. RLS policies
apply to client-side queries made with the public anon key or a user's JWT.

The general pattern across the schema is:

- Public content (published posts, categories, sources, storylines) is readable by
  anyone without authentication.
- Admin-only content (candidates, agent_runs, tool_calls, keywords, settings) requires
  the admin role.
- User-specific content (profiles, user_roles, rag_questions) is readable by the
  owning user and by admins.
- All write operations require the admin role, except for rag_questions inserts which
  are allowed from any authenticated or anonymous user.

The has_role() function is the building block of all admin-gating policies. It is
called inside the USING clause of each policy to check whether the requesting user has
the admin role.

---

## 8. pgvector Search Functions

### match_post_chunks(query_embedding, match_count, filter_post_id)

Used by the RAG service to retrieve the most relevant article chunks for a given
question.

Parameters:
- query_embedding: A 768-dimensional vector embedding of the user's question.
- match_count: How many chunks to return. Defaults to 8.
- filter_post_id: If provided, restricts the search to chunks from a specific article.
  Used when the user asks a question in the context of a single article.

Returns a table with columns: id, post_id, idx, content, similarity.

The similarity score is computed as 1 minus the cosine distance between the query
embedding and the chunk embedding. A score of 1.0 means identical, 0.0 means
completely unrelated.

Only chunks from published articles are returned. The function joins against the posts
table and filters on status = published.

### match_posts(query_embedding, match_count, similarity_threshold)

Used by the curator agent to check whether a newly scraped article is a duplicate of
something already published.

Parameters:
- query_embedding: A 768-dimensional vector embedding of the candidate article's title
  and content.
- match_count: How many similar posts to return. Defaults to 5.
- similarity_threshold: The minimum similarity score to include in results. Defaults
  to 0.0, meaning all results are returned regardless of similarity.

Returns a table with columns: id, title, similarity.

The curator agent calls this function with a threshold of 0.85. If any existing post
scores above that threshold, the candidate is marked as a duplicate and rejected.

Both functions are defined with SECURITY INVOKER, meaning they run with the permissions
of the calling user rather than the function owner. Execute permission is restricted to
service_role only, so these functions cannot be called from client-side code.

---

## 9. Enums Reference

### app_role
Values: admin, user
Used in: user_roles.role

### autonomy_mode
Values: auto_publish, draft_only, off
Used in: categories.autonomy_mode

### source_type
Values: rss, web
Used in: sources.type

### post_status
Values: draft, published, rejected, archived
Used in: posts.status

### candidate_status
Values: discovered, scraped, approved, rejected, duplicate, published
Used in: candidates.status

### agent_kind
Values: orchestrator, keyword, discovery, scraper, curator, editor, publisher
Used in: agent_runs.agent

### run_status
Values: running, succeeded, failed, cancelled
Used in: agent_runs.status

---