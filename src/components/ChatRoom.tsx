import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Send, SkipForward, X, Loader2, Users, Wifi, WifiOff } from 'lucide-react';
import { Message, Participant, ChatSession } from '@/types/chat';
import { cn } from '@/lib/utils';

interface ChatRoomProps {
  currentSession: ChatSession | null;
  currentParticipant: Participant | null;
  partner: Participant | null;
  messages: Message[];
  isConnected: boolean;
  isSearching: boolean;
  onSendMessage: (content: string) => void;
  onSkip: () => void;
  onStop: () => void;
}

export const ChatRoom = ({ 
  currentSession, 
  currentParticipant, 
  partner, 
  messages, 
  isConnected, 
  isSearching,
  onSendMessage, 
  onSkip, 
  onStop 
}: ChatRoomProps) => {
  const [messageInput, setMessageInput] = useState('');
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState<Date | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input when connected
  useEffect(() => {
    if (isConnected && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isConnected]);

  // Track last message time for delivery status
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.participant_id === currentParticipant?.id) {
        setLastMessageTime(new Date(lastMessage.sent_at));
      }
    }
  }, [messages, currentParticipant]);

  const handleSendMessage = () => {
    const trimmedMessage = messageInput.trim();
    if (trimmedMessage && isConnected && trimmedMessage.length <= 500) {
      onSendMessage(trimmedMessage);
      setMessageInput('');
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 500) {
      setMessageInput(value);
      setIsTyping(value.length > 0);
    }
  };

  const handleSkip = () => {
    setShowSkipDialog(false);
    onSkip();
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getConnectionStatus = () => {
    if (isSearching) {
      return {
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        text: "Searching for someone online...",
        color: "text-yellow-300"
      };
    }
    
    if (isConnected && partner) {
      return {
        icon: <Wifi className="w-4 h-4" />,
        text: `Connected with ${partner.name}`,
        color: "text-green-300"
      };
    }
    
    return {
      icon: <WifiOff className="w-4 h-4" />,
      text: "Not connected",
      color: "text-red-300"
    };
  };

  const status = getConnectionStatus();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm p-4 border-b border-white/10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-white font-bold text-lg">nobodyknowsyou</h1>
            <div className={cn("text-sm flex items-center gap-2", status.color)}>
              {status.icon}
              {status.text}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isConnected && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowSkipDialog(true)}
                className="bg-yellow-600/20 border-yellow-500/50 text-yellow-300 hover:bg-yellow-600/30"
              >
                <SkipForward className="w-4 h-4 mr-1" />
                Skip
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={onStop}
              className="bg-red-600/20 border-red-500/50 text-red-300 hover:bg-red-600/30"
            >
              <X className="w-4 h-4 mr-1" />
              Stop
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 max-w-4xl mx-auto w-full p-4 flex flex-col">
        <Card className="flex-1 bg-white/10 backdrop-blur-sm border-white/20 flex flex-col">
          <CardHeader className="py-3">
            <div className="text-center">
              {isSearching ? (
                <div className="text-white/80">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p>Looking for someone online to chat with...</p>
                  <p className="text-sm text-white/60 mt-1">
                    {currentParticipant && (
                      <>Searching as {currentParticipant.name} ({currentParticipant.gender}) for {currentParticipant.preferred_gender === 'any' ? 'anyone' : `${currentParticipant.preferred_gender}s`}</>
                    )}
                  </p>
                  <div className="mt-2 text-xs text-white/50">
                    💡 Only online users will be matched
                  </div>
                </div>
              ) : isConnected && partner ? (
                <div className="text-white/80">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Wifi className="w-5 h-5 text-green-400" />
                    <span>Connected with <span className="font-semibold text-white">{partner.name}</span></span>
                  </div>
                  <p className="text-sm text-white/60">
                    {partner.gender !== 'any' && `${partner.gender.charAt(0).toUpperCase() + partner.gender.slice(1)} • `}
                    Say hello and start chatting!
                  </p>
                </div>
              ) : (
                <div className="text-white/80">
                  <WifiOff className="w-6 h-6 mx-auto mb-2 text-red-400" />
                  Waiting to connect...
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-96 md:max-h-[500px]">
              {messages.length === 0 && isConnected ? (
                <div className="text-center text-white/60 py-8">
                  <div className="bg-white/10 rounded-lg p-4 max-w-sm mx-auto">
                    <p className="mb-2">🎉 You're connected!</p>
                    <p className="text-sm">Start the conversation by saying hello or asking a question.</p>
                  </div>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isOwnMessage = message.participant_id === currentParticipant?.id;
                  const isLastMessage = index === messages.length - 1;
                  
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex animate-in slide-in-from-bottom-2 duration-300",
                        isOwnMessage ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-xs md:max-w-sm px-3 py-2 rounded-lg text-sm break-words",
                          isOwnMessage
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "bg-white/20 text-white rounded-bl-sm"
                        )}
                      >
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        <div className={cn(
                          "text-xs mt-1 opacity-70 flex items-center justify-between",
                          isOwnMessage ? "text-blue-100" : "text-white/60"
                        )}>
                          <span>{formatTime(message.sent_at)}</span>
                          {isOwnMessage && isLastMessage && (
                            <span className="ml-2">✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={messageInput}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyPress}
                  placeholder={
                    isConnected 
                      ? "Type a message..." 
                      : isSearching 
                        ? "Searching for someone online..." 
                        : "Waiting to connect..."
                  }
                  disabled={!isConnected}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60 focus:bg-white/25"
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || !isConnected || messageInput.length > 500}
                  size="icon"
                  className={cn(
                    "transition-all duration-200",
                    messageInput.trim() && isConnected && messageInput.length <= 500
                      ? "bg-blue-600 hover:bg-blue-700 scale-100"
                      : "bg-gray-600 scale-95"
                  )}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              
              {/* Character count and status */}
              <div className="flex justify-between items-center mt-1 text-xs">
                <div className="text-white/50">
                  {isConnected && partner && (
                    <span className="flex items-center gap-1">
                      <Wifi className="w-3 h-3" />
                      Connected
                    </span>
                  )}
                </div>
                <div className={cn(
                  "text-white/60",
                  messageInput.length > 450 && "text-yellow-300",
                  messageInput.length > 480 && "text-red-300"
                )}>
                  {messageInput.length > 400 && `${messageInput.length}/500`}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Skip Confirmation Dialog */}
      <Dialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <DialogContent className="bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Skip this chat?</DialogTitle>
            <DialogDescription className="text-gray-300">
              Are you sure you want to skip this conversation and find someone new to chat with?
              {partner && ` You'll leave your chat with ${partner.name}.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowSkipDialog(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSkip}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              Yes, Skip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};