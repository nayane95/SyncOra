-- Optional development configuration only. Never run automatically in production.
-- Names come from the supplied brief; authentication identities are never seeded.
begin;
insert into public.teams(name) values('Team 1'),('Team 2'),('Team 3'),('Team 4') on conflict(name) do nothing;
insert into public.projects(name) values('Bailey & Glasser'),('Wagstaff'),('AuditResolve'),('Shield Legal'),('Motley Rice'),('Pulaski'),('Other') on conflict(name) do nothing;
insert into public.modules(project_id,name) select p.id,m.name from public.projects p cross join (values('Advanced View'),('Standard View'),('Case Details'),('Defense Readiness'),('Investor Dashboard'),('Authentication')) m(name) where p.name='Bailey & Glasser' on conflict(project_id,name) do nothing;
commit;
