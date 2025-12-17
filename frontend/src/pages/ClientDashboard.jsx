import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Plus, Package, MapPin, Clock, TrendingUp, User, LogOut, Route } from 'lucide-react';
import LocationPicker from '../components/LocationPicker';

const ClientDashboard = ({ user, token, onLogout }) => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    origen: '',
    destino: '',
    tipo_carga: '',
    precio_ofrecido: ''
  });

  useEffect(() => {
    fetchRequests();
    fetchStats();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/requests/my-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.cliente);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          precio_ofrecido: parseFloat(formData.precio_ofrecido)
        })
      });

      if (response.ok) {
        toast.success('Solicitud creada exitosamente');
        setOpenDialog(false);
        setFormData({
          titulo: '',
          descripcion: '',
          origen: '',
          destino: '',
          tipo_carga: '',
          precio_ofrecido: ''
        });
        fetchRequests();
        fetchStats();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error al crear solicitud');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (estado) => {
    const variants = {
      'abierto': 'bg-blue-100 text-blue-700',
      'en_negociacion': 'bg-yellow-100 text-yellow-700',
      'aceptado': 'bg-green-100 text-green-700',
      'en_transito': 'bg-purple-100 text-purple-700',
      'completado': 'bg-gray-100 text-gray-700',
      'cancelado': 'bg-red-100 text-red-700'
    };
    
    const labels = {
      'abierto': 'Abierto',
      'en_negociacion': 'En Negociación',
      'aceptado': 'Aceptado',
      'en_transito': 'En Tránsito',
      'completado': 'Completado',
      'cancelado': 'Cancelado'
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
              <h1 className="text-2xl font-bold text-gray-900">Panel Cliente</h1>
              {user.roles.includes('transportista') && (
                <Button
                  data-testid="switch-to-transporter-button"
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/transportista')}
                  className="rounded-full"
                >
                  Ir a Transportista
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
                <CardTitle className="text-sm font-medium text-gray-600">Total Solicitudes</CardTitle>
                <Package className="w-5 h-5 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{stats.total_solicitudes}</div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Activas</CardTitle>
                <Clock className="w-5 h-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{stats.solicitudes_activas}</div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Completadas</CardTitle>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900">{stats.solicitudes_completadas}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Create Request Button */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Mis Solicitudes</h2>
          <Dialog open={openDialog} onOpenChange={setOpenDialog}>
            <DialogTrigger asChild>
              <Button 
                data-testid="create-request-button"
                className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-full"
              >
                <Plus className="w-5 h-5 mr-2" />
                Nueva Solicitud
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Crear Solicitud de Transporte</DialogTitle>
                <DialogDescription>Completa los detalles de tu solicitud</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateRequest} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="titulo">Título</Label>
                  <Input
                    id="titulo"
                    data-testid="titulo-input"
                    placeholder="ej: Transporte de muebles"
                    value={formData.titulo}
                    onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo_carga">Tipo de Carga</Label>
                  <Input
                    id="tipo_carga"
                    data-testid="tipo-carga-input"
                    placeholder="ej: Muebles, Paquetes, etc."
                    value={formData.tipo_carga}
                    onChange={(e) => setFormData({ ...formData, tipo_carga: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="origen">Origen</Label>
                    <Input
                      id="origen"
                      data-testid="origen-input"
                      placeholder="Madrid"
                      value={formData.origen}
                      onChange={(e) => setFormData({ ...formData, origen: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="destino">Destino</Label>
                    <Input
                      id="destino"
                      data-testid="destino-input"
                      placeholder="Barcelona"
                      value={formData.destino}
                      onChange={(e) => setFormData({ ...formData, destino: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Textarea
                    id="descripcion"
                    data-testid="descripcion-input"
                    placeholder="Describe los detalles del transporte..."
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    rows={3}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="precio_ofrecido">Precio Ofrecido (€)</Label>
                  <Input
                    id="precio_ofrecido"
                    data-testid="precio-input"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="150.00"
                    value={formData.precio_ofrecido}
                    onChange={(e) => setFormData({ ...formData, precio_ofrecido: e.target.value })}
                    required
                  />
                </div>
                <Button 
                  data-testid="submit-request-button"
                  type="submit" 
                  className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-full"
                  disabled={loading}
                >
                  {loading ? 'Creando...' : 'Crear Solicitud'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Requests List */}
        <div className="grid gap-4">
          {requests.length === 0 ? (
            <Card className="border-0 shadow-md">
              <CardContent className="py-12 text-center">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">No tienes solicitudes aún</p>
                <Button
                  data-testid="empty-state-create-button"
                  onClick={() => setOpenDialog(true)}
                  className="bg-emerald-500 hover:bg-emerald-600 rounded-full"
                >
                  Crear Primera Solicitud
                </Button>
              </CardContent>
            </Card>
          ) : (
            requests.map((request) => (
              <Card 
                key={request.id} 
                className="border-0 shadow-md card-hover cursor-pointer"
                onClick={() => navigate(`/request/${request.id}`)}
                data-testid={`request-card-${request.id}`}
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
                      <p className="text-xs text-gray-400">
                        {new Date(request.created_at).toLocaleDateString('es-ES')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-600">€{request.precio_ofrecido}</p>
                      <p className="text-xs text-gray-500">Precio ofrecido</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
