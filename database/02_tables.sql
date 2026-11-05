CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    food_preferences TEXT[], 
    base_location extensions.geography(Point, 4326), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.restaurants (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT, 
    location extensions.geography(Point, 4326)
);

CREATE TABLE public.dishes (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.reviews (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    restaurant_id BIGINT REFERENCES public.restaurants(id) ON DELETE CASCADE,
    dish_id BIGINT REFERENCES public.dishes(id) ON DELETE SET NULL,
    food_photo_url TEXT,
    menu_photo_url TEXT,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    price_paid NUMERIC(10, 2) NOT NULL,
    review_text TEXT,
    eaten_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_reviews_restaurant ON public.reviews(restaurant_id);
CREATE INDEX idx_reviews_user ON public.reviews(user_id);
CREATE INDEX idx_restaurants_location ON public.restaurants USING GIST (location);