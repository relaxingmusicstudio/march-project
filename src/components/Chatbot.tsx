import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Send, Bot, User, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Message = {
  id: number;
  sender: "bot" | "user";
  text: string;
  options?: string[];
  multiSelect?: boolean;
  inputType?: "text" | "email" | "phone";
  inputPlaceholder?: string;
  field?: string;
};

type LeadData = {
  name: string;
  email: string;
  phone: string;
  businessType: string;
  teamSize: string;
  callVolume: string;
  aiTimeline: string;
  interests: string[];
};

// Synced with ContactForm.tsx
const businessTypes = ["Plumbing", "HVAC", "Electrical", "Roofing", "Other"];
const interestOptions = [
  "Website SEO",
  "Google Maps SEO",
  "Paid Ads",
  "Sales Funnels",
  "Websites That Convert",
];

const Chatbot = () => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [leadData, setLeadData] = useState<LeadData>({
    name: "",
    email: "",
    phone: "",
    businessType: "",
    teamSize: "",
    callVolume: "",
    aiTimeline: "",
    interests: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Auto-open after 15 seconds or scroll
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasAutoOpened && !isOpen) {
        setIsOpen(true);
        setHasAutoOpened(true);
        initializeChat();
      }
    }, 15000);

    const handleScroll = () => {
      if (window.scrollY > 500 && !hasAutoOpened && !isOpen) {
        setIsOpen(true);
        setHasAutoOpened(true);
        initializeChat();
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [hasAutoOpened, isOpen]);

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const addBotMessageWithTyping = async (
    text: string,
    options?: string[],
    multiSelect?: boolean,
    inputType?: "text" | "email" | "phone",
    inputPlaceholder?: string,
    field?: string
  ) => {
    setIsTyping(true);
    // Simulate typing delay (random between 800-1500ms)
    await delay(800 + Math.random() * 700);
    setIsTyping(false);

    const newMessage: Message = {
      id: Date.now(),
      sender: "bot",
      text,
      options,
      multiSelect,
      inputType,
      inputPlaceholder,
      field,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const initializeChat = async () => {
    setMessages([]);
    setIsTyping(true);
    await delay(600);
    setIsTyping(false);
    
    setMessages([
      {
        id: 1,
        sender: "bot",
        text: "Hey there! 👋 I'm Alex from ApexLocal360. Quick question — are you tired of missing calls and losing out on jobs?",
        options: businessTypes,
      },
    ]);
    setCurrentStep(1);
  };

  const handleOpen = () => {
    setIsOpen(true);
    if (messages.length === 0) {
      initializeChat();
    }
  };

  const addUserMessage = (text: string) => {
    const newMessage: Message = {
      id: Date.now(),
      sender: "user",
      text,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const submitLead = async (finalData: LeadData) => {
    setIsSubmitting(true);
    try {
      const qualificationSummary = `
Business Type: ${finalData.businessType}
Team Size: ${finalData.teamSize}
Monthly Calls: ${finalData.callVolume}
AI Timeline: ${finalData.aiTimeline}
Interests: ${finalData.interests.join(", ") || "None selected"}
Source: Chatbot Qualification`;

      const { error } = await supabase.functions.invoke('contact-form', {
        body: {
          name: finalData.name,
          email: finalData.email,
          phone: finalData.phone,
          message: qualificationSummary,
          businessType: finalData.businessType,
          teamSize: finalData.teamSize,
          callVolume: finalData.callVolume,
          aiTimeline: finalData.aiTimeline,
          interests: finalData.interests,
        },
      });

      if (error) throw error;

      await addBotMessageWithTyping(
        "Awesome, you're all set! 🎉 One of our team members will reach out within 24 hours. In the meantime, wanna check out what we've got?",
        ["See Pricing", "Hear Demo", "Calculate My Losses"]
      );
      setCurrentStep(100);

      toast({
        title: "You're in!",
        description: "We'll be in touch soon.",
      });
    } catch (error) {
      console.error("Error submitting lead:", error);
      await addBotMessageWithTyping("Hmm, something went wrong on our end. Mind trying again?");
      toast({
        title: "Oops!",
        description: "Failed to submit. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOptionClick = async (option: string) => {
    if (currentStep === 5) {
      // Multi-select for interests
      if (option === "Done") {
        addUserMessage(selectedInterests.length > 0 ? selectedInterests.join(", ") : "Just AI dispatching");
        setLeadData((prev) => ({ ...prev, interests: selectedInterests }));
        setSelectedInterests([]);
        setCurrentStep(6);
        await addBotMessageWithTyping(
          "Perfect! Let me grab your details real quick so we can show you exactly how much you might be leaving on the table. What's your name?",
          undefined,
          false,
          "text",
          "Your name",
          "name"
        );
        return;
      }

      // Toggle selection
      setSelectedInterests((prev) =>
        prev.includes(option) ? prev.filter((i) => i !== option) : [...prev, option]
      );
      return;
    }

    addUserMessage(option);

    switch (currentStep) {
      case 1:
        setLeadData((prev) => ({ ...prev, businessType: option }));
        setCurrentStep(2);
        await addBotMessageWithTyping(
          `Nice! ${option} — that's a solid trade. How big is your crew right now?`,
          ["Solo", "2-5", "6-10", "10+ trucks"]
        );
        break;

      case 2:
        setLeadData((prev) => ({ ...prev, teamSize: option }));
        setCurrentStep(3);
        await addBotMessageWithTyping(
          "Got it! Roughly how many calls come in each month?",
          ["<50", "50-100", "100-200", "200+"]
        );
        break;

      case 3:
        setLeadData((prev) => ({ ...prev, callVolume: option }));
        setCurrentStep(4);
        await addBotMessageWithTyping(
          "And when are you thinking about bringing AI into your business?",
          ["Within 3 months", "3-6 months", "6-12 months", "Just exploring"]
        );
        break;

      case 4:
        setLeadData((prev) => ({ ...prev, aiTimeline: option }));
        setCurrentStep(5);
        setSelectedInterests([]);
        await addBotMessageWithTyping(
          "Besides AI dispatching, anything else you'd like help with? Tap all that apply, then hit Done 👇",
          [...interestOptions, "Done"],
          true
        );
        break;

      case 100:
        if (option === "See Pricing") {
          document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
          await addBotMessageWithTyping("Scrolled you down to pricing! Take a look and let me know if anything stands out 😊");
        } else if (option === "Hear Demo") {
          document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
          await addBotMessageWithTyping("Check out the demo above — it's pretty cool how the AI handles calls 🎧");
        } else if (option === "Calculate My Losses") {
          document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth" });
          await addBotMessageWithTyping("Here's the calculator! Plug in your numbers and see what missed calls are really costing you 📊");
        }
        break;

      default:
        await addBotMessageWithTyping(
          "I'm here if you need anything! What would you like to check out?",
          ["See Pricing", "Hear Demo", "Calculate My Losses"]
        );
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isSubmitting) return;

    const value = inputValue.trim();
    addUserMessage(value);
    setInputValue("");

    switch (currentStep) {
      case 6:
        setLeadData((prev) => ({ ...prev, name: value }));
        setCurrentStep(7);
        await addBotMessageWithTyping(
          `Great to meet you, ${value}! What's the best email to reach you at?`,
          undefined,
          false,
          "email",
          "your@email.com",
          "email"
        );
        break;

      case 7:
        if (!value.includes("@")) {
          await addBotMessageWithTyping(
            "Hmm, that doesn't look quite right. Mind double-checking the email?",
            undefined,
            false,
            "email",
            "your@email.com",
            "email"
          );
          return;
        }
        setLeadData((prev) => ({ ...prev, email: value }));
        setCurrentStep(8);
        await addBotMessageWithTyping(
          "Perfect! And what's the best number to reach you?",
          undefined,
          false,
          "phone",
          "(555) 123-4567",
          "phone"
        );
        break;

      case 8:
        const updatedData = { ...leadData, phone: value };
        setLeadData(updatedData);
        await submitLead(updatedData);
        break;

      default:
        await addBotMessageWithTyping(
          "Thanks for reaching out! Want me to point you somewhere helpful?",
          ["See Pricing", "Hear Demo", "Calculate My Losses"]
        );
    }
  };

  const getCurrentInputConfig = () => {
    const lastBotMessage = [...messages].reverse().find((m) => m.sender === "bot");
    if (lastBotMessage?.inputType) {
      return {
        type: lastBotMessage.inputType,
        placeholder: lastBotMessage.inputPlaceholder || "Type a message...",
      };
    }
    return { type: "text", placeholder: "Type a message..." };
  };

  const inputConfig = getCurrentInputConfig();

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={handleOpen}
        className={`fixed bottom-24 right-6 z-50 w-16 h-16 rounded-full bg-accent text-accent-foreground shadow-xl hover:shadow-2xl transition-all duration-300 flex items-center justify-center group ${
          isOpen ? "scale-0" : "scale-100"
        }`}
      >
        <MessageCircle className="w-7 h-7 group-hover:scale-110 transition-transform" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full animate-pulse" />
      </button>

      {/* Chat Window */}
      <div
        className={`fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] bg-card rounded-2xl shadow-2xl transition-all duration-300 overflow-hidden ${
          isOpen ? "scale-100 opacity-100" : "scale-0 opacity-0"
        }`}
      >
        {/* Header */}
        <div className="bg-primary p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
              <Bot className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <div className="font-semibold text-primary-foreground">Alex</div>
              <div className="text-xs text-primary-foreground/70 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Online now
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="w-8 h-8 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition-colors"
          >
            <X className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>

        {/* Messages */}
        <div className="h-80 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.sender === "bot" && (
                <div className="w-8 h-8 rounded-full bg-primary shrink-0 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
              )}

              <div className="max-w-[80%]">
                <div
                  className={`p-3 rounded-2xl ${
                    message.sender === "user"
                      ? "bg-accent text-accent-foreground rounded-br-sm"
                      : "bg-secondary text-secondary-foreground rounded-bl-sm"
                  }`}
                >
                  {message.text}
                </div>

                {message.options && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {message.options.map((option, index) => {
                      const isSelected = message.multiSelect && selectedInterests.includes(option);
                      const isDone = option === "Done";
                      
                      return (
                        <button
                          key={index}
                          onClick={() => handleOptionClick(option)}
                          disabled={isSubmitting || isTyping}
                          className={`px-3 py-1.5 text-sm rounded-full transition-all disabled:opacity-50 flex items-center gap-1.5 ${
                            isDone
                              ? "bg-accent text-accent-foreground hover:bg-accent/90"
                              : isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-card border-2 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {message.sender === "user" && (
                <div className="w-8 h-8 rounded-full bg-accent shrink-0 flex items-center justify-center">
                  <User className="w-4 h-4 text-accent-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-2 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary shrink-0 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="p-3 rounded-2xl bg-secondary text-secondary-foreground rounded-bl-sm">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {isSubmitting && (
            <div className="flex gap-2 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary shrink-0 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-primary-foreground animate-spin" />
              </div>
              <div className="p-3 rounded-2xl bg-secondary text-secondary-foreground rounded-bl-sm">
                Hang tight, saving your info...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <input
              type={inputConfig.type}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder={inputConfig.placeholder}
              disabled={isSubmitting || isTyping}
              className="flex-1 h-10 px-4 rounded-full border-2 border-border bg-background text-foreground focus:border-accent focus:ring-0 outline-none transition-all disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={isSubmitting || isTyping || !inputValue.trim()}
              className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Chatbot;
