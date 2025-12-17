import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Star, User, Mail, Phone, Shield, CheckCircle } from 'lucide-react';
import VerificationCenter from '../components/VerificationCenter';
import NotificationBell from '../components/NotificationBell';

const Profile = ({ user, token, onLogout }) => {
  const navigate = useNavigate();
  const [ratings, setRatings] = useState([]);
  const [verificationStatus, setVerificationStatus] = useState(null);

  useEffect(() => {
    fetchRatings();
    fetchVerificationStatus();
  }, []);

  const fetchRatings = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/ratings/user/${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setRatings(data);
      }
    } catch (error) {
      console.error('Error fetching ratings:', error);
    }
  };

  const fetchVerificationStatus = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/verification/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setVerificationStatus(data);
      }
    } catch (error) {
      console.error('Error fetching verification:', error);
    }
  };

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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6">
          {/* Profile Info */}
          <Card className="border-0 shadow-md" data-testid="profile-card">
            <CardHeader>
              <CardTitle className="text-2xl">Mi Perfil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-full flex items-center justify-center">
                  <User className="w-10 h-10 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-gray-900">{user.nombre}</h2>
                    {verificationStatus?.is_identity_verified && (
                      <Badge className="bg-blue-500 text-white text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" /> Verificado
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    {user.roles.map(role => (
                      <Badge key={role} className="bg-emerald-100 text-emerald-700 border-0">
                        {role === 'cliente' ? 'Cliente' : 'Transportista'}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="text-gray-900">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Teléfono</p>
                    <p className="text-gray-900">{user.telefono}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Star className="w-5 h-5 text-yellow-400" />
                  <div>
                    <p className="text-sm text-gray-500">Calificación Promedio</p>
                    <p className="text-gray-900 font-semibold">
                      {user.rating > 0 ? `${user.rating} / 5.0` : 'Sin calificaciones'}
                      {user.num_ratings > 0 && (
                        <span className="text-sm text-gray-500 ml-2">({user.num_ratings} calificaciones)</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verification Center */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-500" />
                Centro de Verificación
              </CardTitle>
              <CardDescription>
                Verifica tu identidad y vehículo para aumentar la confianza
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VerificationCenter token={token} userRoles={user.roles} />
            </CardContent>
          </Card>

          {/* Ratings */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Calificaciones Recibidas ({ratings.length})</CardTitle>
              <CardDescription>Lo que otros usuarios dicen de ti</CardDescription>
            </CardHeader>
            <CardContent>
              {ratings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p>No has recibido calificaciones aún</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {ratings.map((rating) => (
                    <div 
                      key={rating.id} 
                      className="border border-gray-200 rounded-lg p-4"
                      data-testid={`rating-${rating.id}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{rating.from_user_nombre}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(rating.created_at).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`w-4 h-4 ${
                                i < rating.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {rating.comentario && (
                        <p className="text-sm text-gray-600">{rating.comentario}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
