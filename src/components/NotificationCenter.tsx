import { useState, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  X,
  Check,
  ExternalLink,
  Trash2,
  Settings,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error" | "action";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
  source?: string;
}

interface NotificationCenterProps {
  notifications?: Notification[];
  onMarkRead?: (id: string) => void;
  onMarkAllRead?: () => void;
  onDismiss?: (id: string) => void;
  onClearAll?: () => void;
}

const typeIcons = {
  info: <Info className="h-4 w-4 text-blue-400" />,
  success: <CheckCircle className="h-4 w-4 text-green-400" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
  error: <AlertTriangle className="h-4 w-4 text-red-400" />,
  action: <Bell className="h-4 w-4 text-accent" />,
};

const NotificationCenter = ({
  notifications: propNotifications,
  onMarkRead,
  onMarkAllRead,
  onDismiss,
  onClearAll,
}: NotificationCenterProps) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(
    propNotifications || []
  );

  // Fetch notifications if not provided via props
  useEffect(() => {
    if (!propNotifications) {
      // Generate mock notifications for demo
      const mockNotifications: Notification[] = [
        {
          id: "1",
          type: "action",
          title: "New Lead Requires Attention",
          message: "Sarah Johnson submitted a quote request for AC repair.",
          timestamp: new Date(Date.now() - 1000 * 60 * 5),
          read: false,
          actionUrl: "/admin/leads",
          actionLabel: "View Lead",
          source: "Lead Capture",
        },
        {
          id: "2",
          type: "success",
          title: "Sequence Completed",
          message: "Welcome sequence for 12 new subscribers finished successfully.",
          timestamp: new Date(Date.now() - 1000 * 60 * 30),
          read: false,
          source: "Sequences",
        },
        {
          id: "3",
          type: "warning",
          title: "Low API Credits",
          message: "Your AI agent has used 85% of monthly credits.",
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
          read: true,
          actionUrl: "/admin/settings",
          actionLabel: "Manage",
          source: "System",
        },
        {
          id: "4",
          type: "info",
          title: "Weekly Report Ready",
          message: "Your performance report for last week is available.",
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
          read: true,
          actionUrl: "/admin/analytics",
          actionLabel: "View Report",
          source: "Analytics",
        },
      ];
      setNotifications(mockNotifications);
    }
  }, [propNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    onMarkRead?.(id);
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    onMarkAllRead?.();
  };

  const handleDismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    onDismiss?.(id);
  };

  const handleClearAll = () => {
    setNotifications([]);
    onClearAll?.();
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const unreadNotifications = notifications.filter((n) => !n.read);
  const readNotifications = notifications.filter((n) => n.read);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-xs h-7"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            <Link to="/admin/settings">
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <Tabs defaultValue="unread" className="w-full">
          <TabsList className="w-full grid grid-cols-2 rounded-none border-b">
            <TabsTrigger value="unread" className="rounded-none">
              Unread ({unreadCount})
            </TabsTrigger>
            <TabsTrigger value="all" className="rounded-none">
              All ({notifications.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unread" className="m-0">
            <ScrollArea className="h-80">
              {unreadNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <CheckCircle className="h-8 w-8 mb-2" />
                  <p className="text-sm">All caught up!</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {unreadNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={handleMarkRead}
                      onDismiss={handleDismiss}
                      formatTime={formatTime}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="all" className="m-0">
            <ScrollArea className="h-80">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={handleMarkRead}
                      onDismiss={handleDismiss}
                      formatTime={formatTime}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {notifications.length > 0 && (
          <div className="p-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-destructive"
              onClick={handleClearAll}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  formatTime: (date: Date) => string;
}

const NotificationItem = ({
  notification,
  onMarkRead,
  onDismiss,
  formatTime,
}: NotificationItemProps) => {
  return (
    <div
      className={`p-4 hover:bg-muted/50 transition-colors ${
        !notification.read ? "bg-accent/5" : ""
      }`}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {typeIcons[notification.type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium ${!notification.read ? "text-foreground" : "text-muted-foreground"}`}>
              {notification.title}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 flex-shrink-0"
              onClick={() => onDismiss(notification.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.message}
          </p>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formatTime(notification.timestamp)}
              </span>
              {notification.source && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {notification.source}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              {!notification.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => onMarkRead(notification.id)}
                >
                  <Check className="h-3 w-3" />
                </Button>
              )}
              {notification.actionUrl && (
                <Link to={notification.actionUrl}>
                  <Button variant="ghost" size="sm" className="h-6 text-xs">
                    {notification.actionLabel || "View"}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
