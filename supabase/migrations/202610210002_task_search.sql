create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;
set search_path = public, extensions, pg_temp;

create index if not exists tasks_search_text on public.tasks using gin (
  (setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
   setweight(to_tsvector('english', coalesce(description,'')), 'B'))
);
create index if not exists tasks_search_title_trigram on public.tasks using gin (title gin_trgm_ops);
create index if not exists tasks_search_description_trigram on public.tasks using gin (description gin_trgm_ops);

create or replace function public.search_tasks(p_query text default '', p_filters jsonb default '{}', p_page integer default 0, p_limit integer default 10)
returns jsonb language plpgsql stable security invoker set search_path = public, extensions, pg_temp as $$
declare
  term text := trim(coalesce(p_query,''));
  pattern text;
  query tsquery;
  result jsonb;
  key text;
begin
  if length(term) > 200 or p_page is null or p_page < 0 or p_page > 1000000 or p_limit is null or p_limit not in (10,25,50,100) then
    raise exception 'Invalid search or pagination parameters';
  end if;
  if p_filters is null or jsonb_typeof(p_filters) <> 'object' then raise exception 'Invalid search filters'; end if;
  for key in select jsonb_object_keys(p_filters) loop
    if key not in ('team_id','project_id','module_id','assignee_id','status','priority') or jsonb_typeof(p_filters->key) <> 'string' then raise exception 'Invalid search filter'; end if;
    if key in ('team_id','project_id','module_id','assignee_id') then perform (p_filters->>key)::uuid; end if;
  end loop;
  pattern := '%' || replace(replace(replace(term, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  query := websearch_to_tsquery('english', term);
  with matched as materialized (
    select t.*, case when term = '' then 0 else
      case when t.task_number::text = regexp_replace(term,'^SYNC-','','i') then 100 else 0 end +
      ts_rank(setweight(to_tsvector('english',coalesce(t.title,'')),'A') || setweight(to_tsvector('english',coalesce(t.description,'')),'B'),query) * 10 +
      word_similarity(term,t.title) end as search_rank
    from public.tasks t
    where (not (p_filters ? 'team_id') or t.team_id = (p_filters->>'team_id')::uuid)
      and (not (p_filters ? 'project_id') or t.project_id = (p_filters->>'project_id')::uuid)
      and (not (p_filters ? 'module_id') or t.module_id = (p_filters->>'module_id')::uuid)
      and (not (p_filters ? 'assignee_id') or t.assignee_id = (p_filters->>'assignee_id')::uuid)
      and (not (p_filters ? 'status') or t.status::text = p_filters->>'status')
      and (not (p_filters ? 'priority') or t.priority::text = p_filters->>'priority')
      and (term = '' or t.task_number::text = regexp_replace(term,'^SYNC-','','i')
        or (setweight(to_tsvector('english',coalesce(t.title,'')),'A') || setweight(to_tsvector('english',coalesce(t.description,'')),'B')) @@ query
        or t.title ilike pattern or t.description ilike pattern or term <% t.title)
  ), totals as (select count(*) as total from matched),
  paging as (select total, least(p_page::bigint,greatest(0,(total-1)/p_limit)) as page from totals),
  paged as (select * from matched order by search_rank desc, created_at desc, id limit p_limit offset (select page*p_limit from paging))
  select jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(paged)-'search_rank' order by search_rank desc,created_at desc,id) from paged),'[]'::jsonb), 'total',total,'page',page,'limit',p_limit) into result from paging;
  return result;
end $$;
revoke all on function public.search_tasks(text,jsonb,integer,integer) from public, anon;
grant execute on function public.search_tasks(text,jsonb,integer,integer) to authenticated;
grant usage on schema extensions to authenticated;
notify pgrst, 'reload schema';
