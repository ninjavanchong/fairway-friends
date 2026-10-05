-- Fairway Friends core schema (Postgres).
--
-- courses / course_holes: West Malaysia course list (par per hole), editable by players.
-- rounds: one row per round; game/bets/meal settings are JSON text.
-- players / scores / score_edits: who is playing, their strokes, and the "edited by" history.
--
-- Row level security is ON with no policies: the public REST API can read nothing.
-- All access goes through the `api` Edge Function, which connects as the database owner.

create table courses (
  id         integer generated always as identity primary key,
  name       varchar(160) not null unique,
  state      varchar(60)  not null,
  source     varchar(120),
  verified   boolean      not null default false,
  created_at timestamptz  not null default now()
);

create table course_holes (
  course_id integer not null references courses (id) on delete cascade,
  hole_no   integer not null,
  par       integer not null,
  yards     integer,
  primary key (course_id, hole_no)
);

create table rounds (
  id          integer generated always as identity primary key,
  code        varchar(8)   not null unique,
  name        varchar(160),
  course_id   integer,
  course_name varchar(160) not null,
  holes       integer      not null default 18,
  pars        varchar(120) not null,
  game_json   text         not null,
  bets_json   text         not null,
  meal_json   text         not null,
  status      varchar(16)  not null default 'setup',
  rev         integer      not null default 1,
  created_by  varchar(80),
  created_at  timestamptz  not null default now()
);

create table players (
  id         integer generated always as identity primary key,
  round_id   integer     not null references rounds (id) on delete cascade,
  name       varchar(60) not null,
  handicap   integer     not null default 0,
  team       varchar(8),
  created_at timestamptz not null default now()
);
create index idx_players_round on players (round_id);

create table scores (
  round_id   integer     not null references rounds (id) on delete cascade,
  player_id  integer     not null references players (id) on delete cascade,
  hole_no    integer     not null,
  strokes    integer     not null,
  entered_by varchar(80),
  updated_by varchar(80),
  edits      integer     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (round_id, player_id, hole_no)
);

create table score_edits (
  id          integer generated always as identity primary key,
  round_id    integer     not null references rounds (id) on delete cascade,
  player_id   integer     not null,
  hole_no     integer     not null,
  old_strokes integer,
  new_strokes integer,
  edited_by   varchar(80),
  edited_at   timestamptz not null default now()
);
create index idx_score_edits_round on score_edits (round_id, id);

alter table courses      enable row level security;
alter table course_holes enable row level security;
alter table rounds       enable row level security;
alter table players      enable row level security;
alter table scores       enable row level security;
alter table score_edits  enable row level security;
