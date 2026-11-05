# Documentação de API - Food Critic

## Autenticação
O Supabase já gerencia o login. O Front-end deve usar:
- `supabase.auth.signUp()`
- `supabase.auth.signInWithPassword()`

## Tabelas (Endpoints automáticos do Supabase)

### 1. Criar uma Review
**Tabela:** `reviews`
**O Front-end precisa enviar:** `user_id`, `restaurant_id`, `dish_id`, `rating`, `price_paid`, `review_text`, `food_photo_url`.

### 2. Recomendações do Usuário (RPC)
**Função:** `get_recommendations_for_user`
**Código no Front:**
const { data, error } = await supabase.rpc('get_recommendations_for_user', { 
  user_id_param: user.id 
});