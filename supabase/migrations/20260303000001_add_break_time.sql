-- 休憩時間カラムを weekly_schedules テーブルに追加
ALTER TABLE weekly_schedules
ADD COLUMN break_start_time TIME,
ADD COLUMN break_end_time TIME;

-- 休憩時間の妥当性チェック制約を追加
ALTER TABLE weekly_schedules
ADD CONSTRAINT valid_break_time_range
  CHECK (
    break_start_time IS NULL
    OR break_end_time IS NULL
    OR break_start_time < break_end_time
  );

-- 休憩時間が営業時間内に収まっているかのチェック制約
ALTER TABLE weekly_schedules
ADD CONSTRAINT break_time_within_schedule
  CHECK (
    break_start_time IS NULL
    OR break_end_time IS NULL
    OR (
      break_start_time >= start_time
      AND break_end_time <= end_time
    )
  );
