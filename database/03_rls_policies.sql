CREATE OR REPLACE FUNCTION public.get_recommendations_for_user(user_id_param UUID)
RETURNS TABLE (restaurant_id BIGINT, restaurant_name TEXT, category TEXT, avg_rating NUMERIC) AS $$
BEGIN
    RETURN QUERY
    SELECT r.id, r.name, r.category, ROUND(AVG(rev.rating), 1) as avg_rating
    FROM public.restaurants r
    JOIN public.reviews rev ON r.id = rev.restaurant_id
    GROUP BY r.id, r.name, r.category
    ORDER BY avg_rating DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;