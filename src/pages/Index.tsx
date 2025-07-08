import { useState } from 'react';
import { WelcomePage } from '@/components/WelcomePage';
import { UserSetup } from '@/components/UserSetup';
import { ChatRoom } from '@/components/ChatRoom';
import { useChat } from '@/hooks/useChat';
import { ChatType, GenderType } from '@/types/chat';

type AppState = 'welcome' | 'setup' | 'chat';

const Index = () => {
  const [appState, setAppState] = useState<AppState>('welcome');
  const [selectedChatType, setSelectedChatType] = useState<ChatType>('text');
  
  const {
    currentSession,
    currentParticipant,
    partner,
    messages,
    isConnected,
    isSearching,
    startChat,
    sendMessage,
    skipChat,
    stopChat
  } = useChat();

  const handleChatTypeSelect = (chatType: ChatType) => {
    setSelectedChatType(chatType);
    setAppState('setup');
  };

  const handleUserSetup = (name: string, gender: GenderType, preferredGender: GenderType) => {
    setAppState('chat');
    startChat(name, gender, preferredGender, selectedChatType);
  };

  const handleStop = () => {
    stopChat();
    setAppState('welcome');
  };

  const handleBack = () => {
    setAppState('welcome');
  };

  if (appState === 'welcome') {
    return <WelcomePage onChatTypeSelect={handleChatTypeSelect} />;
  }

  if (appState === 'setup') {
    return (
      <UserSetup 
        chatType={selectedChatType}
        onBack={handleBack}
        onStart={handleUserSetup}
      />
    );
  }

  return (
    <ChatRoom
      currentSession={currentSession}
      currentParticipant={currentParticipant}
      partner={partner}
      messages={messages}
      isConnected={isConnected}
      isSearching={isSearching}
      onSendMessage={sendMessage}
      onSkip={skipChat}
      onStop={handleStop}
    />
  );
};

export default Index;
