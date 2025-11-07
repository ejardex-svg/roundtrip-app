import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import { Truck, Package, Users, Shield, TrendingUp, MapPin } from 'lucide-react';

const LandingPage = ({ onLogin }) => {
  const [showAuth, setShowAuth] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Register form
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    nombre: '',
    telefono: '',
    roles: []
  });

  // Login form
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (registerData.roles.length === 0) {
      toast.error('Selecciona al menos un rol');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerData)
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success('Cuenta creada exitosamente');
        onLogin(data.token, data.user);
      } else {
        toast.error(data.detail || 'Error al registrar');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginData)
      });

      const data = await response.json();
      
      if (response.ok) {
        toast.success('Bienvenido de vuelta');
        onLogin(data.token, data.user);
      } else {
        toast.error(data.detail || 'Credenciales inválidas');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (role) => {
    setRegisterData(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
    }));
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-emerald-50 via-cyan-50 to-blue-50 overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgwLDAsMCwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="flex justify-between items-center mb-16">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Truck className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">TransportLink</span>
            </div>
            {!showAuth && (
              <Button 
                data-testid="login-button-header"
                onClick={() => setShowAuth(true)}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 rounded-full"
              >
                Iniciar Sesión
              </Button>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Conecta tu carga con transportistas disponibles
              </h1>
              <p className="text-base sm:text-lg text-gray-600 mb-8 leading-relaxed">
                La plataforma que une clientes con transportistas profesionales. Publica tu necesidad de transporte, recibe ofertas competitivas y cierra el trato perfecto.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button 
                  data-testid="get-started-button"
                  onClick={() => setShowAuth(true)}
                  size="lg"
                  className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8 rounded-full shadow-lg"
                >
                  Comenzar Ahora
                </Button>
                <Button 
                  data-testid="learn-more-button"
                  variant="outline" 
                  size="lg"
                  className="rounded-full border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                >
                  Saber Más
                </Button>
              </div>
            </div>

            {showAuth ? (
              <Card className="shadow-2xl border-0 rounded-3xl" data-testid="auth-card">
                <CardHeader>
                  <CardTitle className="text-2xl text-center">Únete a TransportLink</CardTitle>
                  <CardDescription className="text-center">Crea una cuenta o inicia sesión</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="login" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="login" data-testid="login-tab">Iniciar Sesión</TabsTrigger>
                      <TabsTrigger value="register" data-testid="register-tab">Registrarse</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="login">
                      <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="login-email">Email</Label>
                          <Input
                            id="login-email"
                            data-testid="login-email-input"
                            type="email"
                            placeholder="tu@email.com"
                            value={loginData.email}
                            onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="login-password">Contraseña</Label>
                          <Input
                            id="login-password"
                            data-testid="login-password-input"
                            type="password"
                            value={loginData.password}
                            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                            required
                          />
                        </div>
                        <Button 
                          data-testid="login-submit-button"
                          type="submit" 
                          className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-full" 
                          disabled={loading}
                        >
                          {loading ? 'Cargando...' : 'Iniciar Sesión'}
                        </Button>
                      </form>
                    </TabsContent>
                    
                    <TabsContent value="register">
                      <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="register-nombre">Nombre Completo</Label>
                          <Input
                            id="register-nombre"
                            data-testid="register-nombre-input"
                            placeholder="Juan Pérez"
                            value={registerData.nombre}
                            onChange={(e) => setRegisterData({ ...registerData, nombre: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="register-email">Email</Label>
                          <Input
                            id="register-email"
                            data-testid="register-email-input"
                            type="email"
                            placeholder="tu@email.com"
                            value={registerData.email}
                            onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="register-telefono">Teléfono</Label>
                          <Input
                            id="register-telefono"
                            data-testid="register-telefono-input"
                            placeholder="+34 600 123 456"
                            value={registerData.telefono}
                            onChange={(e) => setRegisterData({ ...registerData, telefono: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="register-password">Contraseña</Label>
                          <Input
                            id="register-password"
                            data-testid="register-password-input"
                            type="password"
                            value={registerData.password}
                            onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-3">
                          <Label>Registrarse como:</Label>
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="role-cliente" 
                                data-testid="role-cliente-checkbox"
                                checked={registerData.roles.includes('cliente')}
                                onCheckedChange={() => toggleRole('cliente')}
                              />
                              <label htmlFor="role-cliente" className="text-sm cursor-pointer">
                                Cliente (Necesito transportar carga)
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox 
                                id="role-transportista" 
                                data-testid="role-transportista-checkbox"
                                checked={registerData.roles.includes('transportista')}
                                onCheckedChange={() => toggleRole('transportista')}
                              />
                              <label htmlFor="role-transportista" className="text-sm cursor-pointer">
                                Transportista (Ofrezco servicios de transporte)
                              </label>
                            </div>
                          </div>
                        </div>
                        <Button 
                          data-testid="register-submit-button"
                          type="submit" 
                          className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 rounded-full" 
                          disabled={loading}
                        >
                          {loading ? 'Cargando...' : 'Crear Cuenta'}
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-cyan-400/20 rounded-3xl blur-3xl"></div>
                <img 
                  src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800&q=80" 
                  alt="Transporte"
                  className="relative rounded-3xl shadow-2xl w-full"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">¿Cómo funciona?</h2>
          <p className="text-base text-gray-600">Tres simples pasos para conectar clientes y transportistas</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <Card className="border-0 shadow-lg rounded-2xl card-hover">
            <CardHeader>
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                <Package className="w-7 h-7 text-white" />
              </div>
              <CardTitle className="text-xl">1. Publica tu Solicitud</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Los clientes publican sus necesidades de transporte con origen, destino y precio aproximado.</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg rounded-2xl card-hover">
            <CardHeader>
              <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-white" />
              </div>
              <CardTitle className="text-xl">2. Recibe Ofertas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Los transportistas revisan las solicitudes y hacen ofertas competitivas o contraofertas.</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg rounded-2xl card-hover">
            <CardHeader>
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-4">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <CardTitle className="text-xl">3. Cierra el Trato</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">Acepta la mejor oferta y coordina el transporte de forma segura y eficiente.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center text-white">
            <div>
              <div className="text-4xl font-bold mb-2">1,000+</div>
              <div className="text-sm opacity-90">Transportistas Activos</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">5,000+</div>
              <div className="text-sm opacity-90">Entregas Completadas</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">98%</div>
              <div className="text-sm opacity-90">Satisfacción del Cliente</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-3xl p-12 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            ¿Listo para optimizar tus transportes?
          </h2>
          <p className="text-base text-gray-600 mb-8 max-w-2xl mx-auto">
            Únete a miles de clientes y transportistas que ya confían en TransportLink para sus necesidades logísticas.
          </p>
          <Button 
            data-testid="cta-button"
            onClick={() => setShowAuth(true)}
            size="lg"
            className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8 rounded-full shadow-lg"
          >
            Comenzar Gratis
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <Truck className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">TransportLink</span>
            </div>
            <p className="text-sm text-gray-400">© 2025 TransportLink. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
