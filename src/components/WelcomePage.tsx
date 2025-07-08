import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageCircle, Video, Mic } from 'lucide-react';
import { ChatType } from '@/types/chat';

interface WelcomePageProps {
  onChatTypeSelect: (chatType: ChatType) => void;
}

export const WelcomePage = ({ onChatTypeSelect }: WelcomePageProps) => {
  const chatOptions = [
    {
      type: 'text' as ChatType,
      icon: MessageCircle,
      title: 'Text Chat',
      description: 'Chat with text messages'
    },
    {
      type: 'audio' as ChatType,
      icon: Mic,
      title: 'Audio Chat',
      description: 'Talk with voice messages'
    },
    {
      type: 'video' as ChatType,
      icon: Video,
      title: 'Video Chat',
      description: 'Face-to-face conversation'
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

        {/* Chat Type Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {chatOptions.map(({ type, icon: Icon, title, description }) => (
            <Card 
              key={type}
              className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/20 transition-all duration-300 cursor-pointer group"
              onClick={() => onChatTypeSelect(type)}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 group-hover:bg-white/30 transition-colors">
                  <Icon className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-white text-xl">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 text-center text-sm">
                  {description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-white/80 text-sm">
          <div>
            <div className="font-semibold">Anonymous</div>
            <div>No registration required</div>
          </div>
          <div>
            <div className="font-semibold">Random</div>
            <div>Meet anyone, anywhere</div>
          </div>
          <div>
            <div className="font-semibold">Free</div>
            <div>No restrictions</div>
          </div>
          <div>
            <div className="font-semibold">Safe</div>
            <div>Skip anytime</div>
          </div>
        </div>
      </div>
    </div>
  );
};