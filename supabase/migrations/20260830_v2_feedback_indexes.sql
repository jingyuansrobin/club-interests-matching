create index if not exists match_feedback_feedback_idx
  on public.match_feedback (feedback)
  where feedback is not null;

create index if not exists match_feedback_created_idx
  on public.match_feedback (created_at desc);

comment on table public.match_feedback is
  'Append-only beta feedback for V2 recommendations and QQ-copy behavior.';
comment on column public.match_feedback.feedback is
  'Explicit user judgement: positive, neutral, or negative.';
comment on column public.match_feedback.qq_copied is
  'True when this row records a QQ copy action.';
