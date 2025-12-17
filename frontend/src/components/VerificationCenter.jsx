import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { Shield, Car, Upload, CheckCircle, Clock, XCircle, Camera, FileText } from 'lucide-react';

const VerificationCenter = ({ token, userRoles }) => {
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [identityDialogOpen, setIdentityDialogOpen] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  
  // Identity form
  const [identityForm, setIdentityForm] = useState({
    tipo_documento: '',
    numero_documento: '',
    documento_imagen: '',
    selfie_imagen: ''
  });
  
  // Vehicle form
  const [vehicleForm, setVehicleForm] = useState({
    tipo_vehiculo: '',
    marca: '',
    modelo: '',
    ano: new Date().getFullYear(),
    matricula: '',
    foto_vehiculo: '',
    foto_matricula: ''
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchVerificationStatus();
  }, []);

  const fetchVerificationStatus = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/verification/all`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      if (response.ok) {
        const data = await response.json();
        setVerificationStatus(data);
      }
    } catch (error) {
      console.error('Error fetching verification status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e, field, formType) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo no puede superar 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      if (formType === 'identity') {
        setIdentityForm(prev => ({ ...prev, [field]: base64 }));
      } else {
        setVehicleForm(prev => ({ ...prev, [field]: base64 }));
      }
    };
    reader.readAsDataURL(file);
  };

  const submitIdentityVerification = async () => {
    if (!identityForm.tipo_documento || !identityForm.numero_documento || !identityForm.documento_imagen) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    setSubmitting(true);
    try {
      const params = new URLSearchParams({
        tipo_documento: identityForm.tipo_documento,
        numero_documento: identityForm.numero_documento,
        documento_imagen: identityForm.documento_imagen,
        ...(identityForm.selfie_imagen && { selfie_imagen: identityForm.selfie_imagen })
      });

      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/verification/identity?${params}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        toast.success('Verificación de identidad enviada correctamente');
        setIdentityDialogOpen(false);
        fetchVerificationStatus();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error al enviar verificación');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const submitVehicleVerification = async () => {
    if (!vehicleForm.tipo_vehiculo || !vehicleForm.marca || !vehicleForm.modelo || 
        !vehicleForm.matricula || !vehicleForm.foto_vehiculo || !vehicleForm.foto_matricula) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    setSubmitting(true);
    try {
      const params = new URLSearchParams({
        tipo_vehiculo: vehicleForm.tipo_vehiculo,
        marca: vehicleForm.marca,
        modelo: vehicleForm.modelo,
        ano: vehicleForm.ano.toString(),
        matricula: vehicleForm.matricula,
        foto_vehiculo: vehicleForm.foto_vehiculo,
        foto_matricula: vehicleForm.foto_matricula
      });

      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/verification/vehicle?${params}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        toast.success('Verificación de vehículo enviada correctamente');
        setVehicleDialogOpen(false);
        fetchVerificationStatus();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Error al enviar verificación');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500 text-white"><CheckCircle className="w-3 h-3 mr-1" /> Verificado</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500 text-white"><Clock className="w-3 h-3 mr-1" /> Pendiente</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500 text-white"><XCircle className="w-3 h-3 mr-1" /> Rechazado</Badge>;
      default:
        return <Badge variant="outline">Sin verificar</Badge>;
    }
  };

  if (loading) {
    return <div className="text-center py-4">Cargando...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Identity Verification */}
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              <CardTitle className="text-lg">Verificación de Identidad</CardTitle>
            </div>
            {getStatusBadge(verificationStatus?.identity?.status)}
          </div>
          <CardDescription>
            Verifica tu identidad para aumentar la confianza
          </CardDescription>
        </CardHeader>
        <CardContent>
          {verificationStatus?.identity?.status === 'not_submitted' ? (
            <Dialog open={identityDialogOpen} onOpenChange={setIdentityDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full bg-gradient-to-r from-blue-500 to-indigo-500">
                  <Upload className="w-4 h-4 mr-2" /> Verificar Identidad
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Verificación de Identidad</DialogTitle>
                  <DialogDescription>
                    Sube tu documento de identidad para verificar tu cuenta
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Tipo de Documento *</Label>
                    <Select
                      value={identityForm.tipo_documento}
                      onValueChange={(value) => setIdentityForm(prev => ({ ...prev, tipo_documento: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dni">DNI</SelectItem>
                        <SelectItem value="nie">NIE</SelectItem>
                        <SelectItem value="pasaporte">Pasaporte</SelectItem>
                        <SelectItem value="cedula">Cédula</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Número de Documento *</Label>
                    <Input
                      placeholder="12345678A"
                      value={identityForm.numero_documento}
                      onChange={(e) => setIdentityForm(prev => ({ ...prev, numero_documento: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Foto del Documento *</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      {identityForm.documento_imagen ? (
                        <div className="space-y-2">
                          <img src={identityForm.documento_imagen} alt="Documento" className="max-h-32 mx-auto rounded" />
                          <Button variant="outline" size="sm" onClick={() => setIdentityForm(prev => ({ ...prev, documento_imagen: '' }))}>
                            Cambiar imagen
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <FileText className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500">Click para subir imagen</p>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, 'documento_imagen', 'identity')}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Selfie (Opcional)</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      {identityForm.selfie_imagen ? (
                        <div className="space-y-2">
                          <img src={identityForm.selfie_imagen} alt="Selfie" className="max-h-32 mx-auto rounded" />
                          <Button variant="outline" size="sm" onClick={() => setIdentityForm(prev => ({ ...prev, selfie_imagen: '' }))}>
                            Cambiar imagen
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <Camera className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500">Selfie con documento</p>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleFileUpload(e, 'selfie_imagen', 'identity')}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    className="w-full bg-gradient-to-r from-blue-500 to-indigo-500"
                    onClick={submitIdentityVerification}
                    disabled={submitting}
                  >
                    {submitting ? 'Enviando...' : 'Enviar Verificación'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <div className="text-sm text-gray-600">
              {verificationStatus?.identity?.status === 'pending' && 
                'Tu verificación está siendo revisada. Te notificaremos pronto.'}
              {verificationStatus?.identity?.status === 'approved' && 
                '✓ Tu identidad ha sido verificada correctamente.'}
              {verificationStatus?.identity?.status === 'rejected' && 
                `Tu verificación fue rechazada. ${verificationStatus?.identity?.admin_notes || 'Por favor, intenta de nuevo.'}`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vehicle Verification (only for transporters) */}
      {userRoles?.includes('transportista') && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-emerald-500" />
                <CardTitle className="text-lg">Verificación de Vehículo</CardTitle>
              </div>
              {verificationStatus?.has_verified_vehicle ? 
                <Badge className="bg-emerald-500 text-white"><CheckCircle className="w-3 h-3 mr-1" /> Verificado</Badge> :
                <Badge variant="outline">Sin verificar</Badge>
              }
            </div>
            <CardDescription>
              Verifica tu vehículo para recibir más solicitudes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {verificationStatus?.vehicles?.length > 0 && (
              <div className="space-y-2 mb-4">
                {verificationStatus.vehicles.map((vehicle) => (
                  <div key={vehicle.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm">{vehicle.marca} {vehicle.modelo} - {vehicle.matricula}</span>
                    {getStatusBadge(vehicle.status)}
                  </div>
                ))}
              </div>
            )}
            
            <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500">
                  <Car className="w-4 h-4 mr-2" /> Agregar Vehículo
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Verificación de Vehículo</DialogTitle>
                  <DialogDescription>
                    Registra los datos de tu vehículo
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Vehículo *</Label>
                      <Select
                        value={vehicleForm.tipo_vehiculo}
                        onValueChange={(value) => setVehicleForm(prev => ({ ...prev, tipo_vehiculo: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="moto">Moto</SelectItem>
                          <SelectItem value="coche">Coche</SelectItem>
                          <SelectItem value="furgoneta">Furgoneta</SelectItem>
                          <SelectItem value="camion">Camión</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Año *</Label>
                      <Input
                        type="number"
                        value={vehicleForm.ano}
                        onChange={(e) => setVehicleForm(prev => ({ ...prev, ano: parseInt(e.target.value) }))}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Marca *</Label>
                      <Input
                        placeholder="Ej: Mercedes"
                        value={vehicleForm.marca}
                        onChange={(e) => setVehicleForm(prev => ({ ...prev, marca: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Modelo *</Label>
                      <Input
                        placeholder="Ej: Sprinter"
                        value={vehicleForm.modelo}
                        onChange={(e) => setVehicleForm(prev => ({ ...prev, modelo: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Matrícula *</Label>
                    <Input
                      placeholder="1234ABC"
                      value={vehicleForm.matricula}
                      onChange={(e) => setVehicleForm(prev => ({ ...prev, matricula: e.target.value.toUpperCase() }))}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Foto del Vehículo *</Label>
                      <div className="border-2 border-dashed rounded-lg p-3 text-center">
                        {vehicleForm.foto_vehiculo ? (
                          <div className="space-y-2">
                            <img src={vehicleForm.foto_vehiculo} alt="Vehículo" className="max-h-20 mx-auto rounded" />
                            <Button variant="outline" size="sm" onClick={() => setVehicleForm(prev => ({ ...prev, foto_vehiculo: '' }))}>
                              Cambiar
                            </Button>
                          </div>
                        ) : (
                          <label className="cursor-pointer">
                            <Car className="w-8 h-8 mx-auto text-gray-400 mb-1" />
                            <p className="text-xs text-gray-500">Subir foto</p>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, 'foto_vehiculo', 'vehicle')}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Foto de Matrícula *</Label>
                      <div className="border-2 border-dashed rounded-lg p-3 text-center">
                        {vehicleForm.foto_matricula ? (
                          <div className="space-y-2">
                            <img src={vehicleForm.foto_matricula} alt="Matrícula" className="max-h-20 mx-auto rounded" />
                            <Button variant="outline" size="sm" onClick={() => setVehicleForm(prev => ({ ...prev, foto_matricula: '' }))}>
                              Cambiar
                            </Button>
                          </div>
                        ) : (
                          <label className="cursor-pointer">
                            <FileText className="w-8 h-8 mx-auto text-gray-400 mb-1" />
                            <p className="text-xs text-gray-500">Subir foto</p>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e, 'foto_matricula', 'vehicle')}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                    onClick={submitVehicleVerification}
                    disabled={submitting}
                  >
                    {submitting ? 'Enviando...' : 'Enviar Verificación'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VerificationCenter;
