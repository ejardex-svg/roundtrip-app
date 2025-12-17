import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, MapPin, Package, User, Star, MessageSquare } from 'lucide-react';
import Chat from '../components/Chat';
import NotificationBell from '../components/NotificationBell';

const RequestDetail = ({ user, token, onLogout }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  
  const [offerData, setOfferData] = useState({
    precio_oferta: '',
    mensaje: '',
    tipo: 'oferta'
  });

  const [ratingData, setRatingData] = useState({
    rating: 5,
    comentario: ''
  });

  useEffect(() => {
    fetchRequest();
    fetchOffers();
  }, [id]);

  const fetchRequest = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/requests/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRequest(data);
      }
    } catch (error) {
      console.error('Error fetching request:', error);
    }
  };

  const fetchOffers = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/offers/request/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setOffers(data);
      }
    } catch (error) {
      console.error('Error fetching offers:', error);
    }
  };

  const handleCreateOffer = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          solicitud_id: id,
          precio_oferta: parseFloat(offerData.precio_oferta),
          mensaje: offerData.mensaje,
          tipo: offerData.tipo
        })
      });

      if (response.ok) {
        toast.success('Oferta enviada exitosamente');
        setShowOfferDialog(false);
        setOfferData({ precio_oferta: '', mensaje: '', tipo: 'oferta' });
        fetchOffers();
        fetchRequest();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error al enviar oferta');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async (offerId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/offers/${offerId}/accept`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Oferta aceptada');
        fetchOffers();
        fetchRequest();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error al aceptar oferta');
      }
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  const handleRejectOffer = async (offerId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/offers/${offerId}/reject`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Oferta rechazada');
        fetchOffers();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error al rechazar oferta');
      }
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/requests/${id}?estado=${newStatus}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Estado actualizado');
        fetchRequest();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error al actualizar estado');
      }
    } catch (error) {
      toast.error('Error de conexión');
    }
  };

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    setLoading(true);

    const acceptedOffer = offers.find(o => o.estado === 'aceptada');
    if (!acceptedOffer) {
      toast.error('No hay transportista para calificar');
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ratings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          to_user_id: acceptedOffer.transportista_id,
          solicitud_id: id,
          rating: parseInt(ratingData.rating),
          comentario: ratingData.comentario
        })
      });

      if (response.ok) {
        toast.success('Calificación enviada');
        setShowRatingDialog(false);
        setRatingData({ rating: 5, comentario: '' });
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error al enviar calificación');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  if (!request) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando...</div>;
  }

  const isClient = request.cliente_id === user.id;
  const isTransporter = user.roles.includes('transportista');
  const acceptedOffer = offers.find(o => o.estado === 'aceptada');
  const canManageStatus = isClient || (acceptedOffer && acceptedOffer.transportista_id === user.id);
  const canChat = acceptedOffer && (isClient || acceptedOffer.transportista_id === user.id);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Button 
            data-testid="back-button"
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <NotificationBell token={token} />
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Request Details */}
            <Card className="border-0 shadow-md" data-testid="request-details">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl mb-2">{request.titulo}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {request.origen} → {request.destino}
                    </CardDescription>
                  </div>
                  <Badge className={`${
                    request.estado === 'abierto' ? 'bg-blue-100 text-blue-700' :
                    request.estado === 'en_negociacion' ? 'bg-yellow-100 text-yellow-700' :
                    request.estado === 'aceptado' ? 'bg-green-100 text-green-700' :
                    request.estado === 'en_transito' ? 'bg-purple-100 text-purple-700' :
                    request.estado === 'completado' ? 'bg-gray-100 text-gray-700' :
                    'bg-red-100 text-red-700'
                  } border-0`}>
                    {request.estado.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Descripción</p>
                  <p className="text-gray-800">{request.descripcion}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Tipo de Carga</p>
                    <p className="text-gray-800">{request.tipo_carga}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Precio Ofrecido</p>
                    <p className="text-2xl font-bold text-emerald-600">€{request.precio_ofrecido}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Cliente</p>
                  <p className="text-gray-800">{request.cliente_nombre}</p>
                </div>
              </CardContent>
            </Card>

            {/* Offers Section */}
            <Card className="border-0 shadow-md">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Ofertas ({offers.length})</CardTitle>
                  {isTransporter && !isClient && ['abierto', 'en_negociacion'].includes(request.estado) && (
                    <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
                      <DialogTrigger asChild>
                        <Button 
                          data-testid="make-offer-button"
                          className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-full"
                        >
                          Hacer Oferta
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Hacer una Oferta</DialogTitle>
                          <DialogDescription>Envía tu propuesta al cliente</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateOffer} className="space-y-4 mt-4">
                          <div className="space-y-2">
                            <Label htmlFor="precio_oferta">Precio Oferta (€)</Label>
                            <Input
                              id="precio_oferta"
                              data-testid="offer-price-input"
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="150.00"
                              value={offerData.precio_oferta}
                              onChange={(e) => setOfferData({ ...offerData, precio_oferta: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="mensaje">Mensaje (opcional)</Label>
                            <Textarea
                              id="mensaje"
                              data-testid="offer-message-input"
                              placeholder="Añade detalles sobre tu oferta..."
                              value={offerData.mensaje}
                              onChange={(e) => setOfferData({ ...offerData, mensaje: e.target.value })}
                              rows={3}
                            />
                          </div>
                          <Button 
                            data-testid="submit-offer-button"
                            type="submit" 
                            className="w-full bg-cyan-500 hover:bg-cyan-600 rounded-full"
                            disabled={loading}
                          >
                            {loading ? 'Enviando...' : 'Enviar Oferta'}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {offers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p>No hay ofertas aún</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {offers.map((offer) => (
                      <div 
                        key={offer.id} 
                        className="border border-gray-200 rounded-lg p-4"
                        data-testid={`offer-${offer.id}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-gray-900">{offer.transportista_nombre}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(offer.created_at).toLocaleString('es-ES')}
                            </p>
                          </div>
                          <Badge className={`${
                            offer.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                            offer.estado === 'aceptada' ? 'bg-green-100 text-green-700' :
                            'bg-red-100 text-red-700'
                          } border-0`}>
                            {offer.estado.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-2xl font-bold text-cyan-600 mb-2">€{offer.precio_oferta}</p>
                        {offer.mensaje && (
                          <p className="text-sm text-gray-600 mb-3">{offer.mensaje}</p>
                        )}
                        {isClient && offer.estado === 'pendiente' && (
                          <div className="flex gap-2">
                            <Button 
                              data-testid={`accept-offer-${offer.id}`}
                              onClick={() => handleAcceptOffer(offer.id)}
                              className="bg-green-500 hover:bg-green-600 text-white rounded-full"
                              size="sm"
                            >
                              Aceptar
                            </Button>
                            <Button 
                              data-testid={`reject-offer-${offer.id}`}
                              onClick={() => handleRejectOffer(offer.id)}
                              variant="outline"
                              className="rounded-full"
                              size="sm"
                            >
                              Rechazar
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Management */}
            {canManageStatus && request.estado !== 'completado' && request.estado !== 'cancelado' && (
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle>Gestionar Estado</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {request.estado === 'aceptado' && (
                    <Button 
                      data-testid="status-en-transito"
                      onClick={() => handleUpdateStatus('en_transito')}
                      className="w-full bg-purple-500 hover:bg-purple-600 rounded-full"
                    >
                      Marcar En Tránsito
                    </Button>
                  )}
                  {request.estado === 'en_transito' && (
                    <Button 
                      data-testid="status-completado"
                      onClick={() => handleUpdateStatus('completado')}
                      className="w-full bg-green-500 hover:bg-green-600 rounded-full"
                    >
                      Marcar Completado
                    </Button>
                  )}
                  {isClient && ['abierto', 'en_negociacion'].includes(request.estado) && (
                    <Button 
                      data-testid="status-cancelado"
                      onClick={() => handleUpdateStatus('cancelado')}
                      variant="outline"
                      className="w-full border-red-300 text-red-600 hover:bg-red-50 rounded-full"
                    >
                      Cancelar Solicitud
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Rating */}
            {isClient && request.estado === 'completado' && acceptedOffer && (
              <Card className="border-0 shadow-md">
                <CardHeader>
                  <CardTitle>Calificar Servicio</CardTitle>
                </CardHeader>
                <CardContent>
                  <Dialog open={showRatingDialog} onOpenChange={setShowRatingDialog}>
                    <DialogTrigger asChild>
                      <Button 
                        data-testid="rate-transporter-button"
                        className="w-full bg-yellow-500 hover:bg-yellow-600 text-white rounded-full"
                      >
                        <Star className="w-4 h-4 mr-2" />
                        Calificar Transportista
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Calificar Servicio</DialogTitle>
                        <DialogDescription>Comparte tu experiencia</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSubmitRating} className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label htmlFor="rating">Calificación</Label>
                          <Select
                            value={ratingData.rating.toString()}
                            onValueChange={(value) => setRatingData({ ...ratingData, rating: parseInt(value) })}
                          >
                            <SelectTrigger data-testid="rating-select">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5">⭐⭐⭐⭐⭐ Excelente</SelectItem>
                              <SelectItem value="4">⭐⭐⭐⭐ Muy Bueno</SelectItem>
                              <SelectItem value="3">⭐⭐⭐ Bueno</SelectItem>
                              <SelectItem value="2">⭐⭐ Regular</SelectItem>
                              <SelectItem value="1">⭐ Malo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="comentario">Comentario</Label>
                          <Textarea
                            id="comentario"
                            data-testid="rating-comment-input"
                            placeholder="Comparte tu experiencia..."
                            value={ratingData.comentario}
                            onChange={(e) => setRatingData({ ...ratingData, comentario: e.target.value })}
                            rows={3}
                          />
                        </div>
                        <Button 
                          data-testid="submit-rating-button"
                          type="submit" 
                          className="w-full bg-yellow-500 hover:bg-yellow-600 rounded-full"
                          disabled={loading}
                        >
                          {loading ? 'Enviando...' : 'Enviar Calificación'}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            )}

            {/* Chat Section */}
            {canChat && (
              <Chat 
                solicitudId={id} 
                token={token} 
                currentUserId={user.id} 
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestDetail;
