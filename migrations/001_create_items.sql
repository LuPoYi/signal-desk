create table if not exists items (
  id bigint generated always as identity primary key,
  title text not null,
  summary text not null default '',
  source_url text not null default '',
  company text not null default '',
  rating smallint not null default 3 check (rating between 1 and 5),
  status text not null default 'candidate' check (status in ('candidate', 'selected', 'dropped')),
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_status_idx on items (status);
create index if not exists items_company_idx on items (lower(company));
create index if not exists items_created_at_idx on items (created_at desc);
