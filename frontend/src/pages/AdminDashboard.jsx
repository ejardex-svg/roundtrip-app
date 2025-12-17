import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { 
  Shield, Car, Users, Package, CreditCard, CheckCircle, XCircle, 
  Clock, Eye, ArrowLeft, RefreshCw, AlertTriangle
} from 'lucide-react';
import NotificationBell from '../components/NotificationBell';

const AdminDashboard = ({ user, token, onLogout }) => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [identityVerifications, setIdentityVerifications] = useState([]);
  const [vehicleVerifications, setVehicleVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('identity');
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!user.roles.includes('admin')) {
      navigate('/');
      return;
    }
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchStats(),
      fetchIdentityVerifications(),
      fetchVehicleVerifications()
    ]);
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchIdentityVerifications = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/verifications/identity?status=pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setIdentityVerifications(data);
      }
    } catch (error) {
      console.error('Error fetching identity verifications:', error);
    }
  };

  const fetchVehicleVerifications = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/verifications/vehicle?status=pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setVehicleVerifications(data);
      }
    } catch (error) {
      console.error('Error fetching vehicle verifications:', error);
    }
  };

  const handleVerificationAction = async (type, verificationId, status) => {
    setProcessing(true);
    try {
      const endpoint = type === 'identity' 
        ? `/api/admin/verifications/identity/${verificationId}`
        : `/api/admin/verifications/vehicle/${verificationId}`;
      
      const params = new URLSearchParams({
        status,
        ...(adminNotes && { admin_notes: adminNotes })
      });

      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}${endpoint}?${params}`,
        {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        toast.success(`Verificación ${status === 'approved' ? 'aprobada' : 'rechazada'}`);
        setViewDialogOpen(false);
        setSelectedVerification(null);
        setAdminNotes('');
        fetchAll();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error al procesar verificación');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setProcessing(false);
    }
  };

  const openVerificationDetails = (verification, type) => {
    setSelectedVerification({ ...verification, type });
    setViewDialogOpen(true);
    setAdminNotes('');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user.roles.includes('admin')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => navigate(-1)}
                className="text-white hover:bg-white/20 rounded-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver
              </Button>
              <h1 className="text-2xl font-bold">Panel de Administración</h1>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={fetchAll}
                className="text-white hover:bg-white/20 rounded-full"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <NotificationBell token={token} />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid md:grid-cols-5 gap-4 mb-8">
            <Card className="border-0 shadow-md">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Usuarios</p>
                    <p className="text-2xl font-bold">{stats.total_users}</p>
                  </div>
                  <Users className="w-8 h-8 text-blue-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Solicitudes</p>
                    <p className="text-2xl font-bold">{stats.total_requests}</p>
                  </div>
                  <Package className="w-8 h-8 text-emerald-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md bg-amber-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-700">Identidades Pendientes</p>
                    <p className="text-2xl font-bold text-amber-700">{stats.pending_identity_verifications}</p>
                  </div>
                  <Shield className="w-8 h-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md bg-amber-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-amber-700">Vehículos Pendientes</p>
                    <p className="text-2xl font-bold text-amber-700">{stats.pending_vehicle_verifications}</p>
                  </div>
                  <Car className="w-8 h-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Pagos Completados</p>
                    <p className="text-2xl font-bold">{stats.total_paid_transactions}</p>
                  </div>
                  <CreditCard className="w-8 h-8 text-green-500 opacity-80" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Verifications Tabs */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>Verificaciones Pendientes</CardTitle>
            <CardDescription>Revisa y aprueba las verificaciones de usuarios</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="identity" className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Identidad ({identityVerifications.length})
                </TabsTrigger>
                <TabsTrigger value="vehicle" className="flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  Vehículos ({vehicleVerifications.length})
                </TabsTrigger>
              </TabsList>

              {/* Identity Verifications */}
              <TabsContent value="identity">
                {identityVerifications.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                    <p>No hay verificaciones de identidad pendientes</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {identityVerifications.map((v) => (
                      <div 
                        key={v.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <Shield className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{v.user?.nombre || 'Usuario'}</p>
                            <p className="text-sm text-gray-500">{v.user?.email}</p>
                            <p className="text-xs text-gray-400">
                              {v.tipo_documento.toUpperCase()}: {v.numero_documento}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-gray-400">{formatDate(v.created_at)}</span>
                          <Badge className="bg-amber-100 text-amber-700">
                            <Clock className="w-3 h-3 mr-1" /> Pendiente
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() => openVerificationDetails(v, 'identity')}
                            className="rounded-full"
                          >
                            <Eye className="w-4 h-4 mr-1" /> Revisar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Vehicle Verifications */}
              <TabsContent value="vehicle">
                {vehicleVerifications.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                    <p>No hay verificaciones de vehículos pendientes</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {vehicleVerifications.map((v) => (
                      <div 
                        key={v.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                            <Car className="w-6 h-6 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium">{v.user?.nombre || 'Usuario'}</p>
                            <p className="text-sm text-gray-500">
                              {v.marca} {v.modelo} ({v.ano})
                            </p>
                            <p className="text-xs text-gray-400">
                              Matrícula: {v.matricula} | Tipo: {v.tipo_vehiculo}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-gray-400">{formatDate(v.created_at)}</span>
                          <Badge className="bg-amber-100 text-amber-700">
                            <Clock className="w-3 h-3 mr-1" /> Pendiente
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() => openVerificationDetails(v, 'vehicle')}
                            className="rounded-full"
                          >
                            <Eye className="w-4 h-4 mr-1" /> Revisar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Verification Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedVerification?.type === 'identity' ? 'Verificación de Identidad' : 'Verificación de Vehículo'}
            </DialogTitle>
            <DialogDescription>
              Revisa los documentos y decide si aprobar o rechazar
            </DialogDescription>
          </DialogHeader>
          
          {selectedVerification && (
            <div className="space-y-6 mt-4">
              {/* User Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Información del Usuario</h4>
                <p><strong>Nombre:</strong> {selectedVerification.user?.nombre}</p>
                <p><strong>Email:</strong> {selectedVerification.user?.email}</p>
                <p><strong>Teléfono:</strong> {selectedVerification.user?.telefono}</p>
              </div>

              {/* Identity Verification Details */}
              {selectedVerification.type === 'identity' && (
                <>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Documento</h4>
                    <p><strong>Tipo:</strong> {selectedVerification.tipo_documento?.toUpperCase()}</p>
                    <p><strong>Número:</strong> {selectedVerification.numero_documento}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Imagen del Documento</h4>
                    {selectedVerification.documento_imagen ? (
                      <img 
                        src={selectedVerification.documento_imagen} 
                        alt="Documento" 
                        className="max-h-64 rounded-lg border"
                      />
                    ) : (
                      <p className="text-gray-500">No se proporcionó imagen</p>
                    )}
                  </div>

                  {selectedVerification.selfie_imagen && (
                    <div>
                      <h4 className="font-medium mb-2">Selfie con Documento</h4>
                      <img 
                        src={selectedVerification.selfie_imagen} 
                        alt="Selfie" 
                        className="max-h-64 rounded-lg border"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Vehicle Verification Details */}
              {selectedVerification.type === 'vehicle' && (
                <>
                  <div className="bg-emerald-50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Datos del Vehículo</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <p><strong>Tipo:</strong> {selectedVerification.tipo_vehiculo}</p>
                      <p><strong>Marca:</strong> {selectedVerification.marca}</p>
                      <p><strong>Modelo:</strong> {selectedVerification.modelo}</p>
                      <p><strong>Año:</strong> {selectedVerification.ano}</p>
                      <p><strong>Matrícula:</strong> {selectedVerification.matricula}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Foto del Vehículo</h4>
                      {selectedVerification.foto_vehiculo ? (
                        <img 
                          src={selectedVerification.foto_vehiculo} 
                          alt="Vehículo" 
                          className="max-h-40 rounded-lg border"
                        />
                      ) : (
                        <p className="text-gray-500">No disponible</p>
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Foto de Matrícula</h4>
                      {selectedVerification.foto_matricula ? (
                        <img 
                          src={selectedVerification.foto_matricula} 
                          alt="Matrícula" 
                          className="max-h-40 rounded-lg border"
                        />
                      ) : (
                        <p className="text-gray-500">No disponible</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Admin Notes */}
              <div className="space-y-2">
                <Label>Notas del Administrador (opcional)</Label>
                <Textarea
                  placeholder="Agrega notas o razón del rechazo..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-full"
                  onClick={() => handleVerificationAction(
                    selectedVerification.type, 
                    selectedVerification.id, 
                    'approved'
                  )}
                  disabled={processing}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {processing ? 'Procesando...' : 'Aprobar'}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 rounded-full"
                  onClick={() => handleVerificationAction(
                    selectedVerification.type, 
                    selectedVerification.id, 
                    'rejected'
                  )}
                  disabled={processing}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  {processing ? 'Procesando...' : 'Rechazar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
