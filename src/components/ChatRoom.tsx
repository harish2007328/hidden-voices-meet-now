import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Send, SkipForward, X, Loader2 } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (messageInput.trim() && isConnected) {
      onSendMessage(messageInput.trim());
      setMessageInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm p-4 border-b border-white/10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-white font-bold text-lg">nobodyknowsyou</h1>
            <div className="text-white/60 text-sm">
              {isSearching ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching for someone...
                </div>
              ) : isConnected && partner ? (
                `Chatting with ${partner.name}`
              ) : (
                'Not connected'
              )}
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
                  Looking for someone to chat with...
                </div>
              ) : isConnected && partner ? (
                <div className="text-white/80">
                  Connected with <span className="font-semibold text-white">{partner.name}</span>
                </div>
              ) : (
                <div className="text-white/80">Waiting to connect...</div>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-96 md:max-h-[500px]">
              {messages.length === 0 && isConnected ? (
                <div className="text-center text-white/60 py-8">
                  Start the conversation! Say hello 👋
                </div>
              ) : (
                messages.map((message) => {
                  const isOwnMessage = message.participant_id === currentParticipant?.id;
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex",
                        isOwnMessage ? "justify-end" : "justify-start"
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-xs md:max-w-sm px-3 py-2 rounded-lg text-sm",
                          isOwnMessage
                            ? "bg-blue-600 text-white"
                            : "bg-white/20 text-white"
                        )}
                      >
                        <div>{message.content}</div>
                        <div className={cn(
                          "text-xs mt-1",
                          isOwnMessage ? "text-blue-100" : "text-white/60"
                        )}>
                          {formatTime(message.sent_at)}
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
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={isConnected ? "Type a message..." : "Waiting to connect..."}
                  disabled={!isConnected}
                  className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                  maxLength={500}
                />
                <Button 
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || !isConnected}
                  size="icon"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="w-4 h-4" />
                </Button>
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