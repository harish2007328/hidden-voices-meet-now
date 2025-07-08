import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft } from 'lucide-react';
import { ChatType, GenderType } from '@/types/chat';

interface UserSetupProps {
  chatType: ChatType;
  onBack: () => void;
  onStart: (name: string, gender: GenderType, preferredGender: GenderType) => void;
}

export const UserSetup = ({ chatType, onBack, onStart }: UserSetupProps) => {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<GenderType>('any');
  const [preferredGender, setPreferredGender] = useState<GenderType>('any');

  const handleStart = () => {
    if (name.trim()) {
      onStart(name.trim(), gender, preferredGender);
    }
  };

  const getChatTypeTitle = () => {
    switch (chatType) {
      case 'text': return 'Text Chat';
      case 'audio': return 'Audio Chat';
      case 'video': return 'Video Chat';
      default: return 'Chat';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={onBack}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <CardTitle className="text-white text-xl">
                Setup for {getChatTypeTitle()}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white">
                Choose a name (anything you want)
              </Label>
              <Input
                id="name"
                placeholder="Enter your chat name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/60"
                maxLength={30}
              />
            </div>

            {/* Gender Selection */}
            <div className="space-y-3">
              <Label className="text-white">Your gender</Label>
              <RadioGroup 
                value={gender} 
                onValueChange={(value) => setGender(value as GenderType)}
                className="grid grid-cols-3 gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="male" className="text-white" />
                  <Label htmlFor="male" className="text-white text-sm">Male</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="female" className="text-white" />
                  <Label htmlFor="female" className="text-white text-sm">Female</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="any" id="any-gender" className="text-white" />
                  <Label htmlFor="any-gender" className="text-white text-sm">Any</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Preferred Gender */}
            <div className="space-y-3">
              <Label className="text-white">Who do you want to chat with?</Label>
              <RadioGroup 
                value={preferredGender} 
                onValueChange={(value) => setPreferredGender(value as GenderType)}
                className="grid grid-cols-3 gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="male" id="prefer-male" className="text-white" />
                  <Label htmlFor="prefer-male" className="text-white text-sm">Males</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="female" id="prefer-female" className="text-white" />
                  <Label htmlFor="prefer-female" className="text-white text-sm">Females</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="any" id="prefer-any" className="text-white" />
                  <Label htmlFor="prefer-any" className="text-white text-sm">Anyone</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Start Button */}
            <Button 
              onClick={handleStart}
              disabled={!name.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              size="lg"
            >
              Start Chatting
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};