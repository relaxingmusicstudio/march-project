import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface FeedbackButtonsProps {
  agentType: string;
  query: string;
  response: string;
  memoryId?: string;
  onFeedbackSubmitted?: (type: 'positive' | 'negative') => void;
  className?: string;
}

const FeedbackButtons = ({
  agentType,
  query,
  response,
  memoryId,
  onFeedbackSubmitted,
  className = "",
}: FeedbackButtonsProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<'positive' | 'negative' | null>(null);

  const submitFeedback = async (type: 'positive' | 'negative') => {
    if (isSubmitting || submitted) return;

    setIsSubmitting(true);

    try {
      const response_data = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/learn-from-success`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            memory_id: memoryId,
            agent_type: agentType,
            query,
            response,
            feedback_type: type,
            feedback_value: type === 'positive' ? 5 : 1,
            feedback_source: 'user',
            metadata: {
              timestamp: new Date().toISOString(),
              user_agent: navigator.userAgent,
            },
          }),
        }
      );

      if (!response_data.ok) {
        throw new Error('Failed to submit feedback');
      }

      setSubmitted(type);
      onFeedbackSubmitted?.(type);

      if (type === 'positive') {
        toast.success("Thanks! This response has been saved for future reference.", {
          duration: 3000,
        });
      } else {
        toast.info("Thanks for the feedback. We'll work on improving.", {
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      toast.error("Couldn't save feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
        <Check className="h-3 w-3 text-green-500" />
        <span>Feedback recorded</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 hover:bg-green-500/10 hover:text-green-600"
        onClick={() => submitFeedback('positive')}
        disabled={isSubmitting}
        title="This was helpful"
      >
        {isSubmitting ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ThumbsUp className="h-3 w-3" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 hover:bg-red-500/10 hover:text-red-600"
        onClick={() => submitFeedback('negative')}
        disabled={isSubmitting}
        title="This wasn't helpful"
      >
        {isSubmitting ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ThumbsDown className="h-3 w-3" />
        )}
      </Button>
    </div>
  );
};

export default FeedbackButtons;
