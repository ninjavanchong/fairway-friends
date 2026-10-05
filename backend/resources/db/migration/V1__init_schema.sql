-- Fairway Friends core schema.
--
-- courses / course_holes — Malaysian course list (par per hole), editable by players.
-- rounds   — one row per round; game/bets/meal settings are JSON.
-- players  — people in a round (host adds some, others join by QR).
-- scores   — one row per player per hole; anyone in the round may edit any score.
-- score_edits — append-only history behind the "edited by" notes.

CREATE TABLE courses (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(160) NOT NULL,
  state      VARCHAR(60)  NOT NULL,
  source     VARCHAR(120) NULL,
  verified   TINYINT(1)   NOT NULL DEFAULT 0,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_courses_name (name)
);

CREATE TABLE course_holes (
  course_id BIGINT NOT NULL,
  hole_no   INT    NOT NULL,
  par       INT    NOT NULL,
  yards     INT    NULL,
  PRIMARY KEY (course_id, hole_no),
  CONSTRAINT fk_course_holes_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE
);

CREATE TABLE rounds (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(8)   NOT NULL,
  name        VARCHAR(160) NULL,
  course_id   BIGINT       NULL,
  course_name VARCHAR(160) NOT NULL,
  holes       INT          NOT NULL DEFAULT 18,
  pars        VARCHAR(120) NOT NULL,
  game_json   TEXT         NOT NULL,
  bets_json   TEXT         NOT NULL,
  meal_json   TEXT         NOT NULL,
  status      VARCHAR(16)  NOT NULL DEFAULT 'setup',
  rev         INT          NOT NULL DEFAULT 1,
  created_by  VARCHAR(80)  NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_rounds_code (code)
);

CREATE TABLE players (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  round_id   BIGINT       NOT NULL,
  name       VARCHAR(60)  NOT NULL,
  handicap   INT          NOT NULL DEFAULT 0,
  team       VARCHAR(8)   NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_players_round (round_id),
  CONSTRAINT fk_players_round FOREIGN KEY (round_id) REFERENCES rounds (id) ON DELETE CASCADE
);

CREATE TABLE scores (
  round_id   BIGINT       NOT NULL,
  player_id  BIGINT       NOT NULL,
  hole_no    INT          NOT NULL,
  strokes    INT          NOT NULL,
  entered_by VARCHAR(80)  NULL,
  updated_by VARCHAR(80)  NULL,
  edits      INT          NOT NULL DEFAULT 0,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (round_id, player_id, hole_no),
  CONSTRAINT fk_scores_round  FOREIGN KEY (round_id)  REFERENCES rounds (id)  ON DELETE CASCADE,
  CONSTRAINT fk_scores_player FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
);

CREATE TABLE score_edits (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  round_id   BIGINT      NOT NULL,
  player_id  BIGINT      NOT NULL,
  hole_no    INT         NOT NULL,
  old_strokes INT        NULL,
  new_strokes INT        NULL,
  edited_by  VARCHAR(80) NULL,
  edited_at  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_score_edits_round (round_id, id),
  CONSTRAINT fk_score_edits_round FOREIGN KEY (round_id) REFERENCES rounds (id) ON DELETE CASCADE
);
