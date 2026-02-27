-- Base mínima para widget dinâmico + configurações do bot

create table if not exists public.bot_settings (
  bot_id text primary key,
  bot_name text,
  primary_color text,
  position text,
  bot_avatar text,
  welcome_avatar text,
  welcome_message text,
  webhook_url text,
  backend_url text,
  proactive_seconds integer default 8,
  enabled boolean default true,
  updated_at timestamptz default now()
);

create table if not exists public.chat_sessions (
  id bigserial primary key,
  session_id text unique not null,
  bot_id text default 'default',
  status text default 'open',
  source text default 'web_widget',
  visitor_name text,
  visitor_email text,
  visitor_phone text,
  last_message_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.chat_messages (
  id bigserial primary key,
  session_id text not null,
  bot_id text default 'default',
  role text not null,
  content text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists public.chat_tickets (
  id bigserial primary key,
  session_id text,
  bot_id text default 'default',
  status text default 'open',
  source text default 'auto',
  reason text,
  summary text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_chat_messages_session on public.chat_messages(session_id, created_at);
create index if not exists idx_chat_tickets_status on public.chat_tickets(status, created_at desc);

alter table public.bot_settings enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_tickets enable row level security;

-- Recomenda-se política restrita e uso de service_role no backend
