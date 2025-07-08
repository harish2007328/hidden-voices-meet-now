import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Video, Mic, AlertTriangle } from 'lucide-react';
import { ChatType } from '@/types/chat';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WelcomePageProps {
  onChatTypeSelect: (chatType: ChatType) => void;
}

export const WelcomePage = ({ onChatTypeSelect }: WelcomePageProps) => {
  const chatOptions = [
    {
      type: 'text' as ChatType,
      icon: MessageCircle,
      title: 'Text Chat',
      description: 'Chat with text messages',
      available: true
    },
    {
      type: 'audio' as ChatType,
      icon: Mic,
      title: 'Audio Chat',
      description: 'Voice chat (Coming Soon)',
      available: false
    },
    {
      type: 'video' as ChatType,
      icon: Video,
      title: 'Video Chat',
      description: 'Video chat (Coming Soon)',
      available: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-2">
            nobodyknowsyou
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
            Connect with strangers from around the world. Choose your chat style and start conversations anonymously.
          </p>
        </div>

        {/* Audio/Video Notice */}
        <Alert className="bg-yellow-600/20 border-yellow-500/50 max-w-2xl mx-auto">
          <AlertTriangle className="h-4 w-4 text-yellow-300" />
          <AlertDescription className="text-yellow-100">
            <strong>Note:</strong> Audio and Video chat features are currently in development. 
            Only text chat is available at the moment.
          </AlertDescription>
        </Alert>

        {/* Chat Type Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {chatOptions.map(({ type, icon: Icon, title, description, available }) => (
            <Card 
              key={type}
              className={`
                bg-white/10 backdrop-blur-sm border-white/20 transition-all duration-300 
                ${available 
                  ? 'hover:bg-white/20 cursor-pointer group' 
                  : 'opacity-60 cursor-not-allowed'
                }
              `}
              onClick={() => available && onChatTypeSelect(type)}
            >
              <CardHeader className="text-center pb-2">
                <div className={`
                  mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors
                  ${available 
                    ? 'bg-white/20 group-hover:bg-white/30' 
                    : 'bg-white/10'
                  }
                `}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-white text-xl">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 text-center text-sm">
                  {description}
                </p>
                {!available && (
                  <div className="mt-2 text-center">
                    <span className="text-xs bg-yellow-600/30 text-yellow-200 px-2 py-1 rounded">
                      Coming Soon
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-white/80 text-sm">
          <div>
            <div className="font-semibold">🔒 Anonymous</div>
            <div>No registration required</div>
          </div>
          <div>
            <div className="font-semibold">🌍 Global</div>
            <div>Meet people worldwide</div>
          </div>
          <div>
            <div className="font-semibold">🆓 Free</div>
            <div>No restrictions</div>
          </div>
          <div>
            <div className="font-semibold">⚡ Instant</div>
            <div>Connect immediately</div>
          </div>
        </div>

        {/* Online Status Info */}
        <div className="text-center text-white/60 text-sm">
          <p>💡 You'll only be matched with people who are currently online</p>
        </div>
      </div>
    </div>
  );
};