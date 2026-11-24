-- A autorização acompanha a sessão do gerente em todas as operações do catálogo.
alter table public.produtos enable row level security;
drop policy if exists "Permitir cadastro de produtos" on public.produtos;
drop policy if exists "Permitir leitura de produtos" on public.produtos;
revoke all on public.produtos from public, anon, authenticated;
grant select, delete on public.produtos to authenticated;
grant insert(nome, preco, estoque, categoria, minimo, unidade, comprar, chave_cadastro),
      update(nome, preco, estoque, categoria, minimo, unidade, comprar) on public.produtos to authenticated;
create policy gerente_le_produtos on public.produtos for select to authenticated
  using ((select public.vieira_e_gerente()));
create policy gerente_cadastra_produtos on public.produtos for insert to authenticated
  with check ((select public.vieira_e_gerente()));

-- As categorias iniciais passam a existir uma única vez por loja.
with modelos as (
  select 'categoria-inicial-' || n as id, nome, case when n <= 8 then 'saida' else 'entrada' end as tipo
  from unnest(array['Fornecedor','Energia','Aluguel','Manutenção','Impostos','Folha de Pagamento','Água','Internet',
    'Vendas','Recebimento de Cliente','PIX','Cartão','Dinheiro','Outros Recebimentos']) with ordinality as t(nome,n)
), inseridas as (
  insert into public.vieira_registros(tipo,id,dados)
  select 'categorias',id,jsonb_build_object('id',id,'nome',nome,'tipo',tipo) from modelos
  on conflict do nothing returning tipo,id
) insert into public.vieira_importados(tipo,id) select tipo,id from inseridas on conflict do nothing;

-- IDs de texto eram gerados pelos cadastros locais. A marca e o produto são atômicos.
create function public.vieira_importar_produto(id_local text, produto jsonb) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.vieira_e_gerente() then raise insufficient_privilege; end if;
  if id_local is null or id_local !~ '^[a-zA-Z0-9_-]{1,100}$' or id_local ~ '^[0-9]+$' then
    raise exception 'Identificador local inválido' using errcode = '22023';
  end if;
  insert into public.vieira_importados(tipo,id) values ('produtos',id_local) on conflict do nothing;
  if not found then return false; end if;
  insert into public.produtos(nome,preco,estoque,categoria,minimo,unidade,comprar)
    values(produto->>'nome',(produto->>'preco')::numeric,(produto->>'estoque')::integer,
      produto->>'categoria',(produto->>'minimo')::numeric,produto->>'unidade',(produto->>'comprar')::boolean);
  return true;
end;
$$;
revoke all on function public.vieira_importar_produto(text,jsonb) from public, anon;
grant execute on function public.vieira_importar_produto(text,jsonb) to authenticated;
