import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Truck, MapPin, Package, TrendingUp, Clock, User, LogOut } from 'lucide-react';

const TransporterDashboard = ({ user, token, onLogout }) => {
  const navigate = useNavigate();
  const [availableRequests, setAvailableRequests] = useState([]);
  const [myOffers, setMyOffers] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('disponibles');

  useEffect(() => {
    fetchAvailableRequests();
    fetchMyOffers();
    fetchStats();
  }, []);

  const fetchAvailableRequests = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Filter only open and in negotiation requests
        const available = data.filter(r => ['abierto', 'en_negociacion'].includes(r.estado));
        setAvailableRequests(available);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const fetchMyOffers = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/offers/my-offers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMyOffers(data);
      }
    } catch (error) {
      console.error('Error fetching offers:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.transportista);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getStatusBadge = (estado) => {
    const variants = {
      'abierto': 'bg-blue-100 text-blue-700',
      'en_negociacion': 'bg-yellow-100 text-yellow-700',
      'pendiente': 'bg-yellow-100 text-yellow-700',
      'aceptada': 'bg-green-100 text-green-700',
      'rechazada': 'bg-red-100 text-red-700'
    };
    
    const labels = {
      'abierto': 'Abierto',
      'en_negociacion': 'En Negociación',
      'pendiente': 'Pendiente',
      'aceptada': 'Aceptada',
      'rechazada': 'Rechazada'
    };

    return (
      <Badge className={`${variants[estado]} border-0`}>
        {labels[estado]}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">Panel Transportista</h1>
              {user.roles.includes('cliente') && (
                <Button
                  data-testid="switch-to-client-button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/cliente')}
                  className="rounded-full"
                >
                  Ir a Cliente
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                data-testid="profile-button"
                variant="ghost"
                size="sm"
                onClick={() => navigate('/profile')}
                className="rounded-full"
              >
                <User className="w-4 h-4 mr-2" />
                {user.nombre}
              </Button>
              <Button
                data-testid="logout-button"
                variant="outline"
                size="sm"
                onClick={onLogout}
                className="rounded-full"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Salir
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card className="border-0 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Ofertas</CardTitle>
                <Package className="w-5 h-5 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{stats.total_ofertas}</div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Pendientes</CardTitle>
                <Clock className="w-5 h-5 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{stats.ofertas_pendientes}</div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Aceptadas</CardTitle>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{stats.ofertas_aceptadas}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            data-testid="tab-disponibles"
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'disponibles'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('disponibles')}
          >
            Solicitudes Disponibles ({availableRequests.length})
          </button>
          <button
            data-testid="tab-mis-ofertas"
            className={`px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'mis-ofertas'
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('mis-ofertas')}
          >
            Mis Ofertas ({myOffers.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'disponibles' && (
          <div className="grid gap-4">
            {availableRequests.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center">
                  <Truck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No hay solicitudes disponibles en este momento</p>
                </CardContent>
              </Card>
            ) : (
              availableRequests.map((request) => (
                <Card 
                  key={request.id} 
                  className="border-0 shadow-md card-hover cursor-pointer"
                  onClick={() => navigate(`/request/${request.id}`)}
                  data-testid={`available-request-${request.id}`}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg mb-2">{request.titulo}</CardTitle>
                        <CardDescription className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4" />
                          {request.origen} → {request.destino}
                        </CardDescription>
                      </div>
                      {getStatusBadge(request.estado)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">{request.tipo_carga}</p>
                        <p className="text-xs text-gray-400">Cliente: {request.cliente_nombre}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-600">€{request.precio_ofrecido}</p>
                        <p className="text-xs text-gray-500">Precio solicitado</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {activeTab === 'mis-ofertas' && (
          <div className="grid gap-4">
            {myOffers.length === 0 ? (
              <Card className="border-0 shadow-md">
                <CardContent className="py-12 text-center">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No has hecho ofertas aún</p>
                </CardContent>
              </Card>
            ) : (
              myOffers.map((offer) => (
                <Card 
                  key={offer.id} 
                  className="border-0 shadow-md card-hover cursor-pointer"
                  onClick={() => navigate(`/request/${offer.solicitud_id}`)}
                  data-testid={`my-offer-${offer.id}`}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg mb-2">Oferta {offer.tipo}</CardTitle>
                        <CardDescription className="text-sm">
                          {offer.mensaje || 'Sin mensaje'}
                        </CardDescription>
                      </div>
                      {getStatusBadge(offer.estado)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-400">
                        {new Date(offer.created_at).toLocaleDateString('es-ES')}
                      </p>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-cyan-600">€{offer.precio_oferta}</p>
                        <p className="text-xs text-gray-500">Tu oferta</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransporterDashboard;
