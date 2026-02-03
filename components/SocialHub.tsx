import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types';
import { 
  getFriendsList, 
  getPendingRequests, 
  getAvailableUsers, 
  sendFriendRequest, 
  acceptFriendRequest, 
  removeFriendship,
  getConversation,
  sendMessage,
  markAsRead
} from '../services/socialService';

interface SocialHubProps {
  currentUser: User;
  onExit: () => void;
}

export const SocialHub: React.FC<SocialHubProps> = ({ currentUser, onExit }) => {
  const [activeTab, setActiveTab] = useState<'friends' | 'find' | 'requests'>('friends');
  const [friends, setFriends] = useState<{ user: User, friendshipId: string }[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Chat State
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshData();
    // Simulate real-time by refreshing every 3 seconds
    const interval = setInterval(refreshChatIfActive, 3000);
    return () => clearInterval(interval);
  }, [selectedFriend]); // Dependency on selectedFriend to refresh chat

  const refreshData = () => {
    setFriends(getFriendsList(currentUser.id));
    setRequests(getPendingRequests(currentUser.id));
    setAvailableUsers(getAvailableUsers(currentUser.id));
  };

  const refreshChatIfActive = () => {
    if (selectedFriend) {
       const convo = getConversation(currentUser.id, selectedFriend.id);
       // Simple check to avoid unnecessary re-renders if length is same (not perfect but ok for demo)
       setMessages(prev => {
         if (prev.length !== convo.length) return convo;
         return prev; 
       });
       
       // Update global lists too in case of new requests
       setRequests(getPendingRequests(currentUser.id)); 
    }
  };

  useEffect(() => {
    if (selectedFriend) {
      const convo = getConversation(currentUser.id, selectedFriend.id);
      setMessages(convo);
      markAsRead(selectedFriend.id, currentUser.id);
      scrollToBottom();
    }
  }, [selectedFriend]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendRequest = (userId: string) => {
    try {
      sendFriendRequest(currentUser.id, userId);
      refreshData();
      alert("Solicitação enviada!");
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleAccept = (id: string) => {
    acceptFriendRequest(id);
    refreshData();
  };

  const handleReject = (id: string) => {
    removeFriendship(id);
    refreshData();
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedFriend) return;

    sendMessage(currentUser.id, selectedFriend.id, newMessage);
    setMessages(getConversation(currentUser.id, selectedFriend.id));
    setNewMessage('');
  };

  const filteredAvailable = availableUsers.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-screen bg-slate-50 flex flex-col md:flex-row overflow-hidden animate-fade-in">
      
      {/* LEFT SIDEBAR: Navigation & Lists */}
      <div className={`${selectedFriend ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 bg-white border-r border-slate-200 h-full`}>
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50">
           <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Comunidade
              </h2>
              <button onClick={onExit} className="text-xs text-slate-500 hover:text-slate-800 font-medium">Voltar</button>
           </div>
           
           <div className="flex bg-slate-200 rounded-lg p-1">
             <button 
               onClick={() => setActiveTab('friends')} 
               className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'friends' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
             >
               Amigos
             </button>
             <button 
               onClick={() => setActiveTab('requests')} 
               className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all relative ${activeTab === 'requests' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
             >
               Pedidos
               {requests.filter(r => r.type === 'received').length > 0 && (
                 <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
               )}
             </button>
             <button 
               onClick={() => setActiveTab('find')} 
               className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'find' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
             >
               Buscar
             </button>
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-2">
          
          {/* TAB: FRIENDS */}
          {activeTab === 'friends' && (
            <div className="space-y-1">
              {friends.length === 0 && (
                <div className="text-center p-8 text-slate-400 text-sm">
                  Você ainda não tem conexões literárias. Use a aba "Buscar" para encontrar outros escritores.
                </div>
              )}
              {friends.map(({ user }) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedFriend(user)}
                  className={`w-full flex items-center p-3 rounded-xl transition-colors ${selectedFriend?.id === user.id ? 'bg-teal-50 border border-teal-100' : 'hover:bg-slate-50'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold mr-3">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-medium text-slate-800 truncate">{user.name}</div>
                    <div className="text-xs text-slate-500 truncate">Clique para conversar</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* TAB: REQUESTS */}
          {activeTab === 'requests' && (
            <div className="space-y-3 p-2">
              {requests.length === 0 && <div className="text-center text-slate-400 text-sm mt-4">Nenhum pedido pendente.</div>}
              
              {/* Received */}
              {requests.filter(r => r.type === 'received').map(({ user, friendshipId }) => (
                <div key={user.id} className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                  <div className="flex items-center mb-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold mr-2 text-xs">
                      {user.name.charAt(0)}
                    </div>
                    <div>
                       <div className="text-sm font-bold text-slate-700">{user.name}</div>
                       <div className="text-xs text-slate-400">quer ser seu amigo</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleAccept(friendshipId)} className="flex-1 py-1.5 bg-teal-500 text-white text-xs font-bold rounded-lg hover:bg-teal-600">Aceitar</button>
                    <button onClick={() => handleReject(friendshipId)} className="flex-1 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200">Recusar</button>
                  </div>
                </div>
              ))}

              {/* Sent */}
              {requests.filter(r => r.type === 'sent').length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-2">
                   <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Enviados</h3>
                   {requests.filter(r => r.type === 'sent').map(({ user, friendshipId }) => (
                      <div key={user.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm mb-1">
                         <span className="text-slate-600">{user.name}</span>
                         <button onClick={() => handleReject(friendshipId)} className="text-xs text-rose-500 hover:underline">Cancelar</button>
                      </div>
                   ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: FIND */}
          {activeTab === 'find' && (
             <div className="p-2">
                <input 
                  type="text" 
                  placeholder="Buscar escritor..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-200 mb-4"
                />
                
                <div className="space-y-2">
                   {filteredAvailable.map(user => (
                     <div key={user.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <div className="flex items-center">
                           <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold mr-3">
                              {user.name.charAt(0)}
                           </div>
                           <span className="text-sm font-medium text-slate-700">{user.name}</span>
                        </div>
                        <button 
                          onClick={() => handleSendRequest(user.id)}
                          className="p-1.5 bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100"
                          title="Adicionar"
                        >
                           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                           </svg>
                        </button>
                     </div>
                   ))}
                   {filteredAvailable.length === 0 && (
                     <p className="text-center text-slate-400 text-xs mt-4">Nenhum escritor encontrado.</p>
                   )}
                </div>
             </div>
          )}

        </div>
      </div>

      {/* RIGHT SIDE: Chat Window */}
      <div className={`${!selectedFriend ? 'hidden md:flex' : 'flex'} flex-1 flex-col h-full bg-slate-50 relative`}>
        {selectedFriend ? (
          <>
            {/* Chat Header */}
            <div className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between flex-shrink-0">
               <div className="flex items-center">
                  <button onClick={() => setSelectedFriend(null)} className="md:hidden mr-3 text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 text-white flex items-center justify-center font-bold text-lg mr-3 shadow-sm">
                    {selectedFriend.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                     <h3 className="font-bold text-slate-800">{selectedFriend.name}</h3>
                     <span className="text-xs text-green-500 flex items-center gap-1">
                       <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Online
                     </span>
                  </div>
               </div>
               {/* Optional actions like unfriend could go here */}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
               {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                     </svg>
                     <p>Comece a conversa com {selectedFriend.name.split(' ')[0]}...</p>
                  </div>
               )}
               {messages.map((msg) => {
                 const isMe = msg.senderId === currentUser.id;
                 return (
                   <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] md:max-w-[60%] rounded-2xl px-4 py-3 shadow-sm ${
                        isMe 
                          ? 'bg-teal-500 text-white rounded-tr-none' 
                          : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                      }`}>
                         <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                         <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-teal-100' : 'text-slate-400'}`}>
                           {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                           {isMe && (
                             <span className="ml-1 opacity-75">{msg.read ? '✓✓' : '✓'}</span>
                           )}
                         </p>
                      </div>
                   </div>
                 );
               })}
               <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
               <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 bg-slate-100 border-transparent focus:bg-white border focus:border-teal-400 rounded-xl px-4 py-3 outline-none transition-all"
                  />
                  <button 
                    type="submit" 
                    disabled={!newMessage.trim()}
                    className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl px-5 py-3 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                       <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </button>
               </form>
            </div>
          </>
        ) : (
          /* Empty State for Right Side */
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400 p-8">
             <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center mb-6">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
               </svg>
             </div>
             <h3 className="text-xl font-medium text-slate-600 mb-2">Conecte-se com outros escritores</h3>
             <p className="max-w-md text-center">Selecione um amigo na lista ao lado para conversar ou busque novas conexões para compartilhar sua jornada.</p>
          </div>
        )}
      </div>
    </div>
  );
};