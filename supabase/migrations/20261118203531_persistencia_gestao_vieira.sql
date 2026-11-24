create table public.vieira_gerentes (
  email text primary key check (email = lower(trim(email)) and length(email) > 3)
);
alter table public.vieira_gerentes enable row level security;
revoke all on public.vieira_gerentes from public, anon, authenticated;
grant select on public.vieira_gerentes to authenticated;
create policy consultar_propria_autorizacao on public.vieira_gerentes for select to authenticated
  using (email = lower((select auth.jwt()) ->> 'email') and (select auth.uid()) is not null
         and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false));

create function public.vieira_e_gerente() returns boolean
language sql stable security invoker set search_path = ''
as $$ select exists(select 1 from public.vieira_gerentes); $$;
revoke all on function public.vieira_e_gerente() from public, anon;
grant execute on function public.vieira_e_gerente() to authenticated;

create table public.vieira_registros (
  tipo text not null check (tipo in ('categorias','funcionarios','contasPagar','contasReceber','vales')),
  id text not null check (id ~ '^[a-zA-Z0-9_-]{1,100}$'),
  dados jsonb not null check (jsonb_typeof(dados) = 'object' and dados ? 'id' and jsonb_typeof(dados->'id') = 'string' and dados->>'id' = id),
  versao bigint not null default 1,
  funcionario_tipo text generated always as (case when tipo = 'vales' then 'funcionarios' end) stored,
  funcionario_id text generated always as (case when tipo = 'vales' then dados->>'funcionarioId' end) stored,
  primary key (tipo,id),
  check (tipo <> 'vales' or funcionario_id is not null),
  foreign key (funcionario_tipo,funcionario_id) references public.vieira_registros(tipo,id) on delete restrict
);
create index vieira_vales_funcionario on public.vieira_registros(funcionario_tipo,funcionario_id) where funcionario_id is not null;
alter table public.vieira_registros enable row level security;
revoke all on public.vieira_registros from public, anon, authenticated;
grant select, delete on public.vieira_registros to authenticated;
grant insert (tipo,id,dados), update (dados) on public.vieira_registros to authenticated;
create policy gerenciar_registros on public.vieira_registros for all to authenticated
  using ((select public.vieira_e_gerente())) with check ((select public.vieira_e_gerente()));

create table public.vieira_importados (
  tipo text not null, id text not null, primary key (tipo,id)
);
alter table public.vieira_importados enable row level security;
revoke all on public.vieira_importados from public, anon, authenticated;
grant select, insert on public.vieira_importados to authenticated;
create policy conferir_importacoes on public.vieira_importados for select to authenticated using ((select public.vieira_e_gerente()));
create policy registrar_importacoes on public.vieira_importados for insert to authenticated with check ((select public.vieira_e_gerente()));

-- A marca e o registro entram na mesma transação. Outra importação não ressuscita exclusões.
create function public.vieira_importar(linhas jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare novos integer;
begin
  if not public.vieira_e_gerente() then raise insufficient_privilege; end if;
  if jsonb_typeof(linhas) <> 'array' or jsonb_array_length(linhas) > 200 then
    raise exception 'Lote de importação inválido' using errcode = '22023';
  end if;
  with entrada as (
    select r.tipo, r.dados->>'id' as id, r.dados from jsonb_to_recordset(linhas) as r(tipo text,dados jsonb)
  ), primeira as (
    insert into public.vieira_importados(tipo,id)
    select tipo,id from entrada on conflict do nothing returning tipo,id
  )
  insert into public.vieira_registros(tipo,id,dados)
    select e.tipo,e.id,e.dados from entrada e join primeira p using(tipo,id)
    on conflict do nothing;
  get diagnostics novos = row_count;
  return novos;
end;
$$;
revoke all on function public.vieira_importar(jsonb) from public, anon;
grant execute on function public.vieira_importar(jsonb) to authenticated;

alter table public.produtos add column versao bigint not null default 1,
  add column chave_cadastro uuid unique;
create function public.vieira_incrementar_versao() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin new.versao := old.versao + 1; return new; end; $$;
revoke all on function public.vieira_incrementar_versao() from public, anon, authenticated;
create trigger incrementar_versao before update on public.vieira_registros for each row execute function public.vieira_incrementar_versao();
create trigger incrementar_versao before update on public.produtos for each row execute function public.vieira_incrementar_versao();

-- Mantém a leitura do catálogo. Toda gravação da nova aplicação exige o gerente.
grant select, insert, update, delete on public.produtos to authenticated;
create policy gerente_edita_produtos on public.produtos for update to authenticated
  using ((select public.vieira_e_gerente())) with check ((select public.vieira_e_gerente()));
create policy gerente_exclui_produtos on public.produtos for delete to authenticated
  using ((select public.vieira_e_gerente()));
