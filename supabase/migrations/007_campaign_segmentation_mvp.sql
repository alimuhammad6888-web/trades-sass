-- ============================================================
-- 007_campaign_segmentation_mvp.sql
-- Campaign segmentation MVP: audience filters on campaigns.
-- ============================================================

begin;

alter table public.campaigns
  add column if not exists audience_filters jsonb;

update public.campaigns
set audience_type = 'all_eligible'
where audience_type is null or audience_type = 'all_customers';

update public.campaigns
set audience_filters = '{"type":"all_eligible"}'::jsonb
where audience_filters is null;

alter table public.campaigns
  alter column audience_type set default 'all_eligible';

alter table public.campaigns
  drop constraint if exists campaigns_audience_type_check;

alter table public.campaigns
  add constraint campaigns_audience_type_check
  check (
    audience_type in (
      'all_eligible',
      'has_email',
      'has_phone',
      'booked_within',
      'not_booked_since',
      'created_within'
    )
  );

commit;
