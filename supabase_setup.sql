-- ==========================================
-- TEIL 1: TABELLEN ERSTELLEN
-- ==========================================

-- 1. Tabelle für die Dokumente sicherstellen
-- Wir speichern die kompletten Formulardaten als JSONB, genau wie im LocalStorage.
create table public.documents (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users not null, -- Verknüpfung zum eingeloggten User
  type text not null, -- z.B. 'Arbeitsnachweis', 'Abnahmeprotokoll'
  customer_name text, -- Für die schnelle Suche / Anzeige in Listen
  data jsonb, -- Hier landen alle Formularfelder
  signatures jsonb, -- Hier landen die Base64 Unterschriften
  pdf_url text -- Optional: Falls wir das PDF später direkt hochladen
);

-- Optional: Tabelle für Mitarbeiter-Profile (Namen statt nur E-Mail)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text default 'worker'
);

-- ==========================================
-- TEIL 2: SICHERHEIT (Row Level Security)
-- ==========================================

-- RLS aktivieren (Sonst ist die Datenbank offen oder komplett gesperrt)
alter table public.documents enable row level security;
alter table public.profiles enable row level security;

-- Regel 1: Ein eingeloggter User darf ALLES sehen (Firmen-Modus)
-- Wenn jeder Mitarbeiter alles sehen darf:
create policy "Mitarbeiter dürfen alles sehen"
  on public.documents for select
  using ( auth.role() = 'authenticated' );

-- Regel 2: Ein eingeloggter User darf neue Dokumente anlegen
create policy "Mitarbeiter dürfen speichern"
  on public.documents for insert
  with check ( auth.role() = 'authenticated' );

-- Regel 3: Dokumente bearbeiten (Updates) erlaubt
create policy "Mitarbeiter dürfen bearbeiten"
  on public.documents for update
  using ( auth.role() = 'authenticated' );
  
-- Gleiches für Profile: Jeder darf sein eigenes Profil sehen/bearbeiten
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using ( true );

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile"
  on public.profiles for update
  using ( auth.uid() = id );

-- ==========================================
-- TEIL 3: AUTOMATISMUS (Trigger)
-- ==========================================

-- Wenn ein neuer User angelegt wird, erstellen wir automatisch ein Profil
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- TEIL 4: STORAGE (Datei-Speicher)
-- ==========================================

-- Diesen Teil musst du meistens im Supabase Dashboard "Storage" klicken:
-- 1. Erstelle einen neuen Bucket namens "archives"
-- 2. Setze ihn auf "Public" (oder Private mit RLS)

-- Policy für Storage (SQL Variante, falls unterstützt):
-- insert into storage.buckets (id, name, public) values ('archives', 'archives', true);

-- policy: Auth users can upload
-- create policy "Authenticated users can upload"
-- on storage.objects for insert
-- with check ( bucket_id = 'archives' and auth.role() = 'authenticated' );
