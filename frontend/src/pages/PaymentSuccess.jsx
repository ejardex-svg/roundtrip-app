import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

const PaymentSuccess = ({ user, token }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [paymentInfo, setPaymentInfo] = useState(null);
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId && token) {
      pollPaymentStatus();
    }
  }, [sessionId, token]);

  const pollPaymentStatus = async (attempts = 0) => {
    const maxAttempts = 5;
    const pollInterval = 2000;

    if (attempts >= maxAttempts) {
      setStatus('timeout');
      return;
    }

    try {
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/payments/stripe/status/${sessionId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Error checking status');

      const data = await response.json();
      setPaymentInfo(data);

      if (data.payment_status === 'paid') {
        setStatus('success');
        return;
      } else if (data.status === 'expired') {
        setStatus('expired');
        return;
      }

      setTimeout(() => pollPaymentStatus(attempts + 1), pollInterval);
    } catch (error) {
      console.error('Error:', error);
      setStatus('error');
    }
  };

  const handleContinue = () => {
    if (user?.roles?.includes('cliente')) {
      navigate('/cliente');
    } else {
      navigate('/transportista');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-cyan-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0 rounded-3xl">
        <CardHeader className="text-center pb-2">
          {status === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mx-auto mb-4" />
              <CardTitle className="text-2xl">Verificando pago...</CardTitle>
            </>
          )}
          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <CardTitle className="text-2xl text-emerald-600">¡Pago Exitoso!</CardTitle>
            </>
          )}
          {(status === 'error' || status === 'expired' || status === 'timeout') && (
            <>
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <CardTitle className="text-2xl text-red-600">
                {status === 'expired' ? 'Sesión Expirada' : 'Error en el Pago'}
              </CardTitle>
            </>
          )}
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === 'success' && paymentInfo && (
            <div className="bg-emerald-50 p-4 rounded-xl">
              <p className="text-gray-600">Monto pagado:</p>
              <p className="text-3xl font-bold text-emerald-600">
                ${paymentInfo.amount?.toFixed(2)} {paymentInfo.currency?.toUpperCase()}
              </p>
            </div>
          )}
          
          {status === 'loading' && (
            <p className="text-gray-500">Por favor espera mientras confirmamos tu pago...</p>
          )}

          {status === 'success' && (
            <p className="text-gray-600">
              Tu pago ha sido procesado correctamente. Gracias por confiar en Round Trip.
            </p>
          )}

          {(status === 'error' || status === 'timeout') && (
            <p className="text-gray-600">
              Hubo un problema al verificar tu pago. Por favor contacta a soporte si el cargo fue realizado.
            </p>
          )}

          <Button 
            onClick={handleContinue}
            className="w-full bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-full"
          >
            Continuar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
