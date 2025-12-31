import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface StreakData {
  current_streak: number;
  max_streak: number;
  last_visit: string | null;
}

export const useStreak = () => {
  const { user } = useAuth();
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setStreak(null);
      setLoading(false);
      return;
    }

    const updateStreak = async () => {
      const today = new Date().toISOString().split("T")[0];

      // Fetch existing streak
      const { data: existing, error: fetchError } = await supabase
        .from("streaks")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) {
        console.error("Streak fetch error:", fetchError);
        setLoading(false);
        return;
      }

      if (!existing) {
        // Create initial streak
        const { data: newStreak, error: createError } = await supabase
          .from("streaks")
          .insert({
            user_id: user.id,
            current_streak: 1,
            max_streak: 1,
            last_visit: today,
          })
          .select()
          .single();

        if (createError) {
          console.error("Streak creation error:", createError);
        } else {
          setStreak(newStreak);
        }
        setLoading(false);
        return;
      }

      // Check if we need to update
      if (existing.last_visit === today) {
        setStreak(existing);
        setLoading(false);
        return;
      }

      const lastVisitDate = new Date(existing.last_visit || today);
      const todayDate = new Date(today);
      const dayDiff = Math.floor(
        (todayDate.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      let newCurrentStreak = existing.current_streak;
      if (dayDiff === 1) {
        newCurrentStreak = existing.current_streak + 1;
      } else if (dayDiff > 1) {
        newCurrentStreak = 1; // Streak broken
      }

      const newMaxStreak = Math.max(existing.max_streak, newCurrentStreak);

      // Update streak
      const { data: updated, error: updateError } = await supabase
        .from("streaks")
        .update({
          current_streak: newCurrentStreak,
          max_streak: newMaxStreak,
          last_visit: today,
        })
        .eq("user_id", user.id)
        .select()
        .single();

      if (updateError) {
        console.error("Streak update error:", updateError);
      } else {
        setStreak(updated);
      }

      setLoading(false);
    };

    updateStreak();
  }, [user]);

  return { streak, loading };
};
