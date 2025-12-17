import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Send, MessageCircle, AlertTriangle, Check, CheckCheck } from 'lucide-react';

const Chat = ({ solicitudId, token, currentUserId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/chat/messages/${solicitudId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Poll for new messages every 5 seconds
    pollIntervalRef.current = setInterval(fetchMessages, 5000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [solicitudId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/chat/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            solicitud_id: solicitudId,
            contenido: newMessage
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, data]);
        setNewMessage('');
        
        if (data.warning) {
          toast.warning(data.warning, { duration: 6000 });
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error al enviar mensaje');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.created_at);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  if (loading) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="p-4 text-center text-gray-500">
          Cargando chat...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md flex flex-col h-[400px]">
      <CardHeader className="py-3 px-4 border-b bg-gradient-to-r from-emerald-500 to-cyan-500">
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <MessageCircle className="w-5 h-5" />
          Chat de Negociación
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No hay mensajes aún</p>
            <p className="text-sm">Inicia la conversación</p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date}>
              <div className="flex justify-center mb-3">
                <Badge variant="secondary" className="text-xs bg-gray-200">
                  {date}
                </Badge>
              </div>
              {dateMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender_id === currentUserId ? 'justify-end' : 'justify-start'} mb-2`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      message.sender_id === currentUserId
                        ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-br-md'
                        : 'bg-white shadow-sm border rounded-bl-md'
                    }`}
                  >
                    {message.sender_id !== currentUserId && (
                      <p className="text-xs font-medium text-emerald-600 mb-1">
                        {message.sender_nombre}
                      </p>
                    )}
                    
                    {message.bloqueado && (
                      <div className={`flex items-center gap-1 text-xs mb-1 ${
                        message.sender_id === currentUserId ? 'text-amber-200' : 'text-amber-600'
                      }`}>
                        <AlertTriangle className="w-3 h-3" />
                        <span>Contenido filtrado</span>
                      </div>
                    )}
                    
                    <p className={message.sender_id === currentUserId ? 'text-white' : 'text-gray-800'}>
                      {message.contenido}
                    </p>
                    
                    <div className={`flex items-center justify-end gap-1 mt-1 ${
                      message.sender_id === currentUserId ? 'text-white/70' : 'text-gray-400'
                    }`}>
                      <span className="text-xs">{formatTime(message.created_at)}</span>
                      {message.sender_id === currentUserId && (
                        message.leido ? (
                          <CheckCheck className="w-3 h-3" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      {/* Warning banner */}
      <div className="px-4 py-2 bg-amber-50 border-t border-amber-200">
        <p className="text-xs text-amber-700 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Los datos de contacto externo serán filtrados. Negocia dentro de la plataforma.
        </p>
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-3 border-t bg-white">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="flex-1 rounded-full"
            disabled={sending}
          />
          <Button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default Chat;
