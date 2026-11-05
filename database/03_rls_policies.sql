ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Perfis
CREATE POLICY "Perfis públicos" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Editar próprio perfil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Restaurantes e Pratos
CREATE POLICY "Restaurantes públicos" ON public.restaurants FOR SELECT USING (true);
CREATE POLICY "Logados inserem restaurantes" ON public.restaurants FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Pratos públicos" ON public.dishes FOR SELECT USING (true);
CREATE POLICY "Logados inserem pratos" ON public.dishes FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Reviews
CREATE POLICY "Reviews públicas" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Criar própria review" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Deletar própria review" ON public.reviews FOR DELETE USING (auth.uid() = user_id);