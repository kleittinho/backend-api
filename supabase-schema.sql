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

alter table public.bot_settings enable row level security;

-- Recomenda-se política restrita e uso de service_role no backend
-- Exemplo (ajuste conforme seu ambiente):
-- create policy "service role only" on public.bot_settings
--   for all using (auth.role() = 'service_role')
--   with check (auth.role() = 'service_role');
